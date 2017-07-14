'use strict';
require('./essentials.js');
const http = require('http');
const path = require('path');
const url = require('url');
const querystring = require('querystring');
const fs = require('fs');
const crypto = require('crypto');
const o = require('yield-yield');
const diff = require('diff');
const config = require('./config.js');
const mime = {
	'.html': 'text/html',
	'.css': 'text/css',
	'.js': 'text/javascript',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.mp3': 'audio/mpeg',
	'.ico': 'image/x-icon'
};
const nameSort = (a, b) => {
	if (a.name < b.name) return -1;
	if (a.name > b.name) return 1;
	return 0;
};
const createDir = o(function*(p, cb) {
	console.log('Creating dir ', p);
	yield fs.mkdir(p, yield);
	yield createFileR(path.join(p, 'index'), yield);
	cb(null);
});
const createDirR = o(function*(p, cb) {
	try {
		yield fs.stat(path.dirname(p), yield);
		yield fs.mkdir(p, yield);
	} catch (e) {
		yield createDirR(path.dirname(p), yield);
	}
	try {
		yield fs.stat(p, yield);
	} catch (e) {
		yield createDir(p, yield);
	}
	cb(null);
});
const createFileR = o(function*(p, cb) {
	try {
		yield fs.stat(path.dirname(p), yield);
	} catch (e) {
		yield createDir(path.dirname(p), yield);
	}
	try {
		yield fs.stat(p, yield);
	} catch (e) {
		console.log('Creating file ', p);
		yield fs.writeFile(p, '', yield);
	}
	cb(null);
});
const read = o(function*(p, prop, cb) {
	try {
		return cb(null, (yield fs.readFile(p, yield))[prop]());
	} catch (e) {
		return cb(null, '');
	}
});
const readNearest = o(function*(p, prop, cb) {
	if (path.dirname(p) == '/') return cb(null, '');
	return cb(null, (yield read(p, prop, yield)) || (yield readNearest(path.join(path.dirname(p), '..', path.basename(p)), prop, yield)));
});
const endReadDir = function(indexFile, ret, cb) {
	ret.sub = ret.sub.sort(nameSort);
	(indexFile || '').toString().split('\n').forEach((itemName, i) => {
		const replaceRegex = /^- |\s*\d*$/g;
		itemName = itemName.replace(replaceRegex, '');
		let j = -1;
		for (let k = 0; k < ret.sub.length; k++) {
			if (ret.sub[k].name.replace(replaceRegex, '') == itemName) {
				j = k;
				break;
			}
		}
		if (j != -1) {
			const subI = ret.sub[i];
			ret.sub[i] = ret.sub[j];
			ret.sub[j] = subI;
		}
	});
	ret.jump += '<div>';
	ret.sub.forEach((subp) => ret.jump += subp.jump);
	ret.jump += '</div>';
	return cb(null, ret);
};
const readDir = o(function*(p, cb) {
	const fullP = p;
	let stat;
	try {
		stat = yield fs.stat(fullP, yield);
	} catch (e) {}
	const extname = path.extname(p);
	let ret = {p, extname, name: path.basename(p, extname)};
	ret.jump = `<span class="'${
		ret.name.length == 1 ? 'inline' : ''}${
		extname ? ' nav' + extname.substr(1) : ''
		}">${ret.name}</span> `;
	if (stat && stat.isDirectory()) {
		const list = yield fs.readdir(fullP, yield);
		ret.sub = [];
		let pending = list.length;
		if (!pending) return cb(null, ret);
		let indexFile;
		try {
			indexFile = yield fs.readFile(path.join(fullP, 'index'), yield);
		} catch (e) {
			yield createFileR(path.join(fullP, 'index'), yield);
		}
		list.forEach(o(function*(subp) {
			if (['index', 'resolution'].includes(subp) || subp[0] == '.') {
				if (!--pending) return cb(null, yield endReadDir(indexFile, ret, yield));
				return;
			}
			readDir(path.join(p, subp), o(function*(err, ps) {
				if (err && pending > 0) return (pending = 0) || cb(err);
				ret.sub.push(ps);
				if (!--pending) return cb(null, yield endReadDir(indexFile, ret, yield));
			}));
		}));
	} else return cb(null, ret);
});
const writeHead = o(function*(res, tree, cb) {
	res.writeHead(200, {'Content-Type': 'application/xhtml+xml; charset=utf-8'});
	const resolution = yield readNearest(path.join(tree.p, 'resolution'), 'imd', yield);
	res.write(
		(yield fs.readFile('./html/head.html', yield))
		.replaceAll(
			['$title', '$resolution', '$jumps'],
			['Debate', resolution, yield writeJumps(tree, yield)]
		)
	);
	cb();
});
const writeFoot = o(function*(res, cb) {
	res.end(yield fs.readFile('./html/foot.html', yield));
	cb();
});
const writeCard = o(function*(res, p, cb) {
	let data = yield read(p, 'toString', yield),
		c = data.indexOf('\n#-\n'),
		o = c == -1 ? '' : data.substr(c + 3),
		n = c == -1 ? data : data.substr(0, c),
		d = diff.diffWordsWithSpace(o, n, {ignoreCase: true}),
		r = '';
	for (let i = 0; i < d.length; i++) {
		if (d[i].added) r += '<ins>' + d[i].value.imd() + '</ins>';
		else if (d[i].removed) r += '<del class="source">' + d[i].value.imd() + '</del>';
		else r += d[i].value.imd();
	}
	res.write(`
		<a class="right controls edit-button">Edit</a>
		<div class="edit" data-path="${path.relative(config.dataPath, p).html()}" hidden="">
			<div class="ta-cont">
				<textarea id="ta" autofocus="">${o.html()}</textarea>
				<pre></pre>
			</div>
			<div class="ta-cont">
				<textarea id="ta" autofocus="">${n.html()}</textarea>
				<pre></pre>
			</div>
		</div>
		<div class="card" id="jump-${path.relative(config.dataPath, p)}">${r}</div>
	`);
	cb();
});
const writeCase = o(function*(req, res, tree, cb) {
	if (!tree.sub) yield writeCard(res, tree.p, yield);
	else {
		res.write(`<div class="folder" id="jump-${path.relative(config.dataPath, tree.p)}">`);
		const p = path.relative(path.join(config.dataPath, req.url.pathname), tree.p);
		res.write('<a class="controls" href="' + p + '/">' + p.html() + '</a>');
		for (let i = 0; i < tree.sub.length; i++) {
			yield writeCase(req, res, tree.sub[i], yield);
		}
		res.write(`
			<a class="right controls edit-button">+</a>
			<div class="edit" hidden="">
				<div class="ta-cont">
					<textarea id="ta"></textarea>
					<pre></pre>
				</div>
				<div class="ta-cont">
					<textarea id="ta"></textarea>
					<pre></pre>
				</div>
			</div>
		`);
		res.write('</div>');
	}
	cb();
});
const writeJumps = o(function*(tree, cb) {
	let r = `<a class="jump${tree.sub ? ' jump-folder' : ''}" data-jump="${path.relative(config.dataPath, tree.p.html())}">${path.basename(tree.p)}</a>`;
	if (tree.sub) {
		for (let i = 0; i < tree.sub.length; i++) {
			r += `<div>${yield writeJumps(tree.sub[i], yield)}</div>`;
		}
	}
	cb(null, r);
});
http.createServer(o(function*(req, res) {
	req.url = url.parse(req.url, true);
	console.log(req.method, req.url.pathname);
	if (req.url.pathname == '/api/edit/') {
		if (req.method != 'POST') return res.writeHead(405) || res.end('Error: Method not allowed. Use POST.');
		let post = '';
		req.on('data', data => post += data);
		yield req.on('end', yield);
		const p = path.join(config.dataPath, decodeURIComponent(req.url.query.path));
		post = post.sanitize();
		console.log(post.replace('\n#-\n', ''), post.replace('\n#-\n', '').length);
		if (post.replace('\n#-\n', '')) yield fs.writeFile(p, post, yield);
		else yield fs.unlink(p, yield);
		res.writeHead(204);
		res.end();
	} else {
		const p = path.join(config.dataPath, decodeURIComponent(req.url.pathname));
		let stats;
		try {
			stats = yield fs.stat(p, yield);
		} catch (e) {}
		if (!stats) {
			try {
				stats = yield fs.stat('./http/' + req.url.pathname, yield);
			} catch (e) {
				return res.writeHead(404) || res.end('404');
			}
			if (!stats.isFile()) return res.writeHead(404) || res.end('404');
			res.writeHead(200, {'Content-Type': mime[path.extname('./http/' + req.url.pathname)] || 'text/plain'});
			return fs.createReadStream('./http/' + req.url.pathname).pipe(res);
		}
		const tree = yield readDir(p, yield);
		yield writeHead(res, tree, yield);
		if (req.url.pathname != '/') res.write('<a class="controls" href="..">..</a>');
		yield writeCase(req, res, tree, yield);
		yield writeFoot(res, yield);
	}
})).listen(config.port);
console.log('Debate server running on port ' + config.port + ' over plain HTTP.');