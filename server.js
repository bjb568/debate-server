'use strict';
require('./essentials.js');
const http = require('http');
const path = require('path');
const url = require('url');
const querystring = require('querystring');
const fs = require('fs');
const crypto = require('crypto');
const o = require('yield-yield');
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
function hash(p) {
	return crypto.createHash('md5').update(p).digest('base64').substr(0, 10);
}
const nameSort = (a, b) => {
	if (a.name < b.name) return -1;
	if (a.name > b.name) return 1;
	return 0;
};
const createDir = o(function*(p, cb) {
	console.log('Creating dir ', p);
	yield fs.mkdir(p, yield);
	if (path.extname(p) == '.card') yield createFileR(path.join(p, 'card.h'), yield);
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
	p = path.join(config.dataPath, p);
	yield createFileR(p, yield);
	cb(null, (yield fs.readFile(p, yield))[prop]());
});
const endReadDir = function(indexFile, ret, cb) {
	ret.sub.sort(nameSort);
	(indexFile || '').toString().split('\n').forEach((itemName, i) => {
		itemName = itemName.replace(/^- |\d+$/g, '');
		let j = -1;
		for (let k = 0; k < ret.sub.length; k++) {
			if (ret.sub[k].name == itemName) {
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
	ret.sub.forEach((subp) => (ret.cards = ret.cards.concat(subp.cards)));
	ret.cards = ret.cards.sort(nameSort);
	return cb(null, ret);
};
const readDir = o(function*(p, prefix, cb) {
	const fullP = path.join(config.dataPath, p);
	let stat;
	try {
		stat = yield fs.stat(fullP, yield);
	} catch (e) {}
	const extname = path.extname(p);
	let ret = {p, extname, name: path.basename(p, extname), hash: hash(p), cards: []};
	ret.jump = `<span class="'${
		ret.name.length == 1 ? 'inline' : ''}${
		extname ? ' nav' + extname.substr(1) : ''
		}"><a href="${prefix}#${ret.hash}">${ret.name}</a></span> `;
	if (extname == '.card') ret.cards.push({jump: ret.jump, name: ret.name});
	if (stat && stat.isDirectory()) {
		ret.isDir = true;
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
			if (['index', 'resolution', 'card.h'].includes(subp) || subp[0] == '.') {
				if (!--pending) return cb(null, yield endReadDir(indexFile, ret, yield));
				return;
			}
			readDir(path.join(p, subp), prefix + (['aff', 'neg'].includes(subp) ? '/' + subp + '/' : ''), o(function*(err, ps) {
				if (err && pending > 0) return (pending = 0) || cb(err);
				ret.sub.push(ps);
				if (!--pending) return cb(null, yield endReadDir(indexFile, ret, yield));
			}));
		}));
	} else return cb(null, ret);
});
const writeHead = o(function*(res, options, cb) {
	res.writeHead(200, {'Content-Type': 'application/xhtml+xml; charset=utf-8'});
	const resolution = yield read('resolution', 'imd', yield);
	const jumps = options.jumps || '';
	const cards = options.cards || options.tree.cards.map(c => c.jump).join(' ');
	const other = options.other || options.tree.other || '';
	res.write(
		(yield fs.readFile('./html/head.html', yield)).toString()
		.replaceAll(
			['$title', '$resolution', '$jumps', '$cards', '$other', '<body>'],
			['Debate', resolution, jumps, cards, other, options.editpage ? '<body class="editpage">' : '<body>']
		)
	);
	cb();
});
const writeFoot = o(function*(res, cb) {
	res.end(yield fs.readFile('./html/foot.html', yield));
	cb();
});
const className = {
	'a': 'speech1',
	'q': 'question',
	'q.master': 'question question-master'
};
const writeCase = o(function*(res, p, cb) {
	console.log(path.basename(p));
	res.write(`<div id="${hash(p)}" class="cont">
		<div class="leaf ${className[path.basename(p)] || ''}">
			<a href="/edit/${encodeURIComponent(p)}" class="right">Edit</a>
			${yield read(p, 'md', yield)}
		</div>
	</div>`);
	cb();
});
const writeCardH = o(function*(res, p, cb) {
	const card = (yield fs.readFile(path.join(config.dataPath, p, 'card.h'), yield)).toString().split('\n', 2);
	res.write(`
		<article id="${hash(p)}" class="cont card">
		<div>
			<div class="leaf card-h">
				<a href="/edit/${encodeURIComponent(path.join(p, 'card.h'))}" class="right">Edit</a>
				<h1><a href="${card[0].html()}">${path.basename(p, '.card')}</a></h1>
				${(card[1] || '').md()}
			</div>`
	);
	cb();
});
const writeCaseR = o(function*(res, tree, cb) {
	if (!tree.isDir) yield writeCase(res, tree.p, yield);
	else if (path.extname(tree.p) == '.card') yield writeCardH(res, tree.p, yield);
	else res.write('<div id="' + hash(tree.p) + '" class="cont">');
	if (tree.sub) {
		for (let i = 0; i < tree.sub.length; i++) {
			yield writeCaseR(res, tree.sub[i], yield);
		}
	}
	if (tree.isDir) res.write('</div>');
	if (path.extname(tree.p) == '.card') res.write('</article>');
	cb();
});
function pathPrefix(p) {
	if (!p.indexOf('/aff/')) return '/aff/';
	if (!p.indexOf('/neg/')) return '/neg/';
	return '/';
}
http.createServer(o(function*(req, res) {
	req.url = url.parse(req.url, true);
	console.log(req.method, req.url.pathname);
	let navLoc = pathPrefix(req.url.pathname);
	const tree = yield readDir(navLoc, '', yield);
	if (req.url.pathname == '/') {
		yield writeHead(res, {
			jumps: '<span><a href="/aff/">Aff</a> <a class="right" href="/neg/">Neg</a></span>' + tree.jump,
			tree
		}, yield);
		yield writeCase(res, 'notes', yield);
		yield writeFoot(res, yield);
	} else if (req.url.pathname == '/aff/' || req.url.pathname == '/neg/') {
		yield writeHead(res, {
			jumps: '<span><a href="/">Home</a></span><h1>' + req.url.pathname.replaceAll('/', '') + '</h1>' + tree.jump,
			tree
		}, yield);
		yield writeCaseR(res, tree, yield);
		yield writeFoot(res, yield);
	} else if (req.url.pathname == '/api/edit/') {
		if (req.method != 'POST') return res.writeHead(405) || res.end('Error: Method not allowed. Use POST.');
		let post = '';
		req.on('data', data => post += data);
		yield req.on('end', yield);
		const p = path.join(config.dataPath, decodeURIComponent((url.parse(req.headers.referer || '').pathname || '').substr(6)));
		yield fs.writeFile(p, post, yield);
		res.writeHead(204);
		res.end();
	} else if (req.url.pathname.substr(0, 6) == '/edit/') {
		yield writeHead(res, {
			jumps: '<span><a href="/">Home</a><br/><a href="/aff/">Aff</a> <a class="right" href="/neg/">Neg</a></span>' + tree.jump,
			tree,
			editpage: true
		}, yield);
		const p = decodeURIComponent(req.url.pathname.substr(6));
		const data = yield read(p, 'html', yield);
		res.write(`<h1><a href="${pathPrefix(p)}#${hash(p)}">${p} <del class="right">Edit</del></a></h1><div class="ta-cont">
			<textarea id="ta" autofocus="">${data}</textarea>
			<pre></pre>
		</div>`);
		yield writeFoot(res, yield);
	} else {
		let stats;
		try {
			stats = yield fs.stat('./http/' + req.url.pathname, yield);
		} catch (e) {
			return res.writeHead(404) || res.end('404');
		}
		if (!stats.isFile()) return res.writeHead(404) || res.end('404');
		res.writeHead(200, {'Content-Type': mime[path.extname('./http/' + req.url.pathname)] || 'text/plain'});
		fs.createReadStream('./http/' + req.url.pathname).pipe(res);
	}
})).listen(config.port);
console.log('Debate server running on port ' + config.port + ' over plain HTTP.');