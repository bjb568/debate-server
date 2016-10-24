'use strict';
String.prototype.replaceAll = function(find, replace) {
	if (typeof find == 'string') return this.split(find).join(replace);
	let t = this, i, j;
	while (typeof(i = find.shift()) == 'string' && typeof(j = replace.shift()) == 'string') t = t.replaceAll(i || '', j || '');
	return t;
};
String.prototype.html = function() {
	return html(this);
};
function html(input) {
	return input.toString().replaceAll(['&', '<', '>', '"', '\t', '\n', '\r', '\b'], ['&amp;', '&lt;', '&gt;', '&quot;', '&#9;', '&#10;', '', '']);
}
function warning(message) {
	//console.log(message);
	//Ignore markdown warnings on server
}
function parseURL(url) {
	var match = url.match(/(?:([^:/?#]+):)?(?:\/\/([^/?#]*))?([^?#]*)(\\?(?:[^#]*))?(#(?:.*))?/);
	return {
		scheme: match[1] || '',
		host: match[2] || '',
		path: match[3] || '',
		query: match[4] || '',
		fragment: match[5] || ''
	};
}
function spanMarkdown(input) {
	input = html(input);
	while (/\^([\w\^]+)/.test(input)) input = input.replace(/\^([\w\^]+)/, '<sup>$1</sup>');
	return input
		.replaceAll('\u0001', '^')
		.replace(/\[(.+?)\|(.+?)\]/g, '<abbr title="$2">$1</abbr>')
		.replaceAll('\u0002', '[')
		.replace(/\[\[(\d+)\](.*?)\]/g, '<sup class="reference" title="$2">[$1]</sup>')
		.replace(/\[\[ !\[([^\[\]]+?)]\(https?:\/\/([^\s("\\]+?\.[^\s"\\]+?)\) \]\]/g, '<img alt="$1" class="center" src="https://$2" />')
		.replace(/!\[([^\[\]]+?)]\(https?:\/\/([^\s("\\]+?\.[^\s"\\]+?)\)/g, '<img alt="$1" src="https://$2" />')
		.replace(/\[([^\[\]]+)]\((https?:\/\/[^\s()"\[\]]+?\.[^\s"\\\[\]]+?)\)/g, '$1'.link('$2'))
		.replace(/(\s|^)https?:\/\/([^\s()"]+?\.[^\s"]+?\.(svg|png|tiff|jpg|jpeg)(\?[^\s"\/]*)?)/g, '$1<img src="https://$2" alt="user image" />')
		.replace(/(\s|^)(https?:\/\/([^\s()"]+?\.[^\s"()]+))/g, function(m, p1, p2, p3) {
			var parsed = parseURL(p2.replace('youtu.be/', 'youtube.com/watch?v='));
			var i;
			if (
				/(^|.+\.)youtube\.com$/.test(parsed.host) && (i = parsed.query.match(/^\?(.+?&)?v=([^&]+)/))
			) return '<div class="max-width"><div class="iframe-16-9"><iframe src="https://www.youtube.com/embed/' + i[2] + '" frameborder="0" allowfullscreen=""></iframe></div></div>';
			return p1 + p3.link(p2);
		});
}
function inlineMarkdown(input) {
	var output = '',
		span = '',
		current = [],
		tags = {
			'`': 'code',
			'``': 'samp',
			'*': 'em',
			'**': 'strong',
			'_': 'i',
			'–––': 's',
			'+++': 'ins',
			'---': 'del',
			'[c]': 'cite',
			'[m]': 'mark',
			'[u]': 'u',
			'[v]': 'var',
			'::': 'kbd',
			'"': 'q'
		},
		stags = {
			sup: {
				start: '^(',
				end: ')^'
			},
			sub: {
				start: 'v(',
				end: ')v'
			},
			small: {
				start: '[sm]',
				end: '[/sm]'
			}
		};
	outer: for (var i = 0; i < input.length; i++) {
		if (!['code', 'samp'].includes(current[current.length - 1])) {
			if (input[i] == '\\') span += input[++i].replace('^', '\u0001').replace('[', '\u0002');
			else {
				for (var l = 3; l > 0; l--) {
					if (tags[input.substr(i, l)]) {
						output += spanMarkdown(span);
						span = '';
						if (current[current.length - 1] == tags[input.substr(i, l)]) output += '</' + current.pop() + '>';
						else {
							if (current.includes(tags[input.substr(i, l)])) warning('Illegal nesting of "' + input.substr(i, l) + '"');
							output += '<' + tags[input.substr(i, l)] + '>';
							current.push(tags[input.substr(i, l)]);
						}
						i += l - 1;
						continue outer;
					}
				}
				for (var j in stags) {
					for (var l = 5; l > 0; l--) {
						if (stags[j].start == input.substr(i, l)) {
							output += spanMarkdown(span) + '<' + j + '>';
							span = '';
							current.push(j);
							i += l - 1;
							continue outer;
						} else if (stags[j].end == input.substr(i, l)) {
							if (stags[current[current.length - 1]] == stags[j]) {
								output += spanMarkdown(span) + '</' + j + '>';
								span = '';
								current.pop();
								i += l - 1;
								continue outer;
							} else warning('Illegal close tag "' + stags[j].end + '" found');
						}
					}
				}
				span += input[i];
			}
		} else if (current[current.length - 1] == 'code' && input[i] == '`') {
			current.pop();
			output += '</code>';
		} else if (current[current.length - 1] == 'samp' && input.substr(i, 2) == '``') {
			current.pop();
			output += '</samp>';
			i++;
		} else output += html(input[i]);
	}
	output += spanMarkdown(span);
	if (current.length) warning('Unclosed tags. <' + current.join('>, <') + '>');
	for (var i = current.length - 1; i >= 0; i--) output += '</' + current[i] + '>';
	return output;
}
function markdown(input) {
	var blockquote = '',
		ul = '',
		ol = '',
		li = '',
		code = '';
	return input.split('\n').map(function(val, i, arr) {
		if (!val) return '';
		var f;
		if (val.substr(0, 2) == '> ') {
			val = val.substr(2);
			if (arr[i + 1] && arr[i + 1].substr(0, 2) == '> ') {
				blockquote += val + '\n';
				return '';
			} else {
				var arg = blockquote + val;
				blockquote = '';
				return '<blockquote>' + markdown(arg) + '</blockquote>';
			}
		} else if (val.substr(0, 3) == '>! ') {
			val = val.substr(3);
			if (arr[i + 1] && arr[i + 1].substr(0, 3) == '>! ') {
				blockquote += val + '\n';
				return '';
			} else {
				var arg = blockquote + val;
				blockquote = '';
				return '<blockquote class="spoiler">' + markdown(arg) + '</blockquote>';
			}
		} else if (val.substr(0, 2) == '- ' || val.substr(0, 2) == '* ') {
			if (!ul) ul = '<ul>';
			val = val.substr(2);
			if (li) {
				ul += '<li>' + markdown(li) + '</li>';
				li = '';
			}
			if (arr[i + 1] && (arr[i + 1].substr(0, 2) == '- ' || arr[i + 1] && arr[i + 1].substr(0, 2) == '* ')) {
				ul += '<li>' + inlineMarkdown(val) + '</li>';
				return '';
			} else if (arr[i + 1] && (arr[i + 1][0] == '\t' || arr[i + 1] && arr[i + 1].substr(0, 4) == '    ')) {
				li += val + '\n';
				return '';
			} else {
				var arg = ul + '<li>' + inlineMarkdown(val) + '</li>';
				ul = '';
				return arg + '</ul>';
			}
		} else if (f = val.match(/^(\d+|[A-z])[.)] /)) {
			if (!ol) ol = '<ol>';
			val = val.substr(f[0].length);
			if (li) {
				ol += '<li>' + markdown(li) + '</li>';
				li = '';
			}
			if (/^(\d+|[A-z])[.)] /.test(arr[i + 1])) {
				ol += '<li>' + inlineMarkdown(val) + '</li>';
				return '';
			} else if (arr[i + 1] && (arr[i + 1][0] == '\t' || arr[i + 1] && arr[i + 1].substr(0, 4) == '    ')) {
				li += val + '\n';
				return '';
			} else {
				var arg = ol + '<li>' + inlineMarkdown(val) + '</li>';
				ol = '';
				return arg + '</ol>';
			}
		} else if (li && val[0] == '\t') {
			li += val.substr(1) + '\n';
			if (ul && (!arr[i + 1] || (arr[i + 1][0] != '\t' && arr[i + 1].substr(0, 4) != '    ' && arr[i + 1].substr(2) != '- ' && arr[i + 1].substr(2) != '* '))) {
				var arg = ul + '<li>' + markdown(li) + '</li>';
				li = '';
				return arg + '</ul>';
			} else if (ol && (!arr[i + 1] || (arr[i + 1][0] != '\t' && arr[i + 1].substr(0, 4) != '    '))) {
				var arg = ol + '<li>' + markdown(li) + '</li>';
				li = '';
				return arg + '</ol>';
			}
			return '';
		} else if (li && val.substr(0, 4) == '    ') {
			li += val.substr(4) + '\n';
			if (ul && (!arr[i + 1] || (arr[i + 1][0] != '\t' && arr[i + 1].substr(0, 4) != '    ' && arr[i + 1].substr(2) != '- ' && arr[i + 1].substr(2) != '* '))) {
				var arg = ul + '<li>' + markdown(li) + '</li>';
				li = '';
				return arg + '</ul>';
			} else if (ol && (!arr[i + 1] || (arr[i + 1][0] != '\t' && arr[i + 1].substr(0, 4) != '    '))) {
				var arg = ol + '<li>' + markdown(li) + '</li>';
				li = '';
				return arg + '</ol>';
			}
			return '';
		} else if (val[0] == '\t') {
			code += val.substr(1);
			if (!arr[i + 1] || (arr[i + 1].substr(0, 4) != '    ' && arr[i + 1][0] != '\t')) {
				var arg = html(code);
				code = '';
				return '<code class="blk">' + arg + '</code>';
			} else code += '\n';
			return '';
		} else if (val.substr(0, 4) == '    ') {
			code += val.substr(4);
			if (!arr[i + 1] || (arr[i + 1].substr(0, 4) != '    ' && arr[i + 1][0] != '\t')) {
				var arg = html(code);
				code = '';
				return '<code class="blk">' + arg + '</code>';
			} else code += '\n';
			return '';
		} else if ((f = val.match(/^#{1,6} /)) && (f = f[0].length - 1)) {
			return '<h' + f + '>' + inlineMarkdown(val.substr(f + 1)) + '</h' + f + '>';
		} else if (/^[-–—]{12,}$/.test(val)) {
			return '<hr />';
		} else if (i = val.match(/^cite\[(\d+)\]: /)) {
			return '<div><sup class="reference-list">' + i[1] + '</sup> ' + inlineMarkdown(val.substr(i[0].length)) + '</div>';
		} else return '<p>' + inlineMarkdown(val) + '</p>';
	}).join('');
}
String.prototype.markdown = function() {
	return markdown(this);
};
const http = require('http');
const path = require('path');
const url = require('url');
const querystring = require('querystring');
const fs = require('fs');
const o = require('yield-yield');
const config = require('./config.js');
const dataFile = JSON.parse(fs.readFileSync(config.dataPath));
dataFile.resolution = dataFile.resolution || '';
dataFile.aff = dataFile.aff || {};
dataFile.aff.intro = dataFile.aff.intro || '';
dataFile.aff.conts = dataFile.aff.conts || [];
dataFile.neg = dataFile.neg || {};
dataFile.neg.intro = dataFile.neg.intro || '';
dataFile.neg.conts = dataFile.neg.conts || [];
const mime = {
	'.html': 'text/html',
	'.css': 'text/css',
	'.js': 'text/javascript',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.mp3': 'audio/mpeg',
	'.ico': 'image/x-icon'
};
function formatData(side, data) {
	return '<h1>' + side.html() + '</h1><div id="intro">' + data.intro.markdown() + '</div>' + data.conts.map((cont, i) => (
		'<h2 id="cont' + ++i + '">contention ' + i + '</h2>' + cont.markdown()
	)).join('');
}
function replaceBody(pathname, data) {
	pathname = pathname.replaceAll(['/', 'edit'], ['', '']);
	let pathnum = parseInt(pathname.match(/\d+/));
	return data
		.toString()
		.replaceAll('$resolution', dataFile.resolution)
		.replace('$nav', !data.includes('$nav') ? '' : pathname ?
			'<a href="/">Home</a>' + dataFile[pathname].conts.map((contention, i) => (' <a href="' + ++i + '/">Contention ' + i + '</a>')).join('') + '<a href="edit">Edit</a>'
			: '<a href="aff/">Aff</a> <a href="neg/">Neg</a>')
		.replace('$enext', pathnum > 0 ? '../' + (pathnum + 1) + '/edit' : '1/edit')
		.replace('$eprev', pathnum > 1 ? '../' + (pathnum - 1) + '/edit' : '/' + pathname.match(/\D+/) + '/edit')
		.replaceAll('$data', !data.includes('$data') ? '' : pathname ?
			formatData(pathname, dataFile[pathname])
			: (formatData('aff', dataFile.aff) + formatData('neg', dataFile.neg)).replace(/ id=".+?"/g, '')
		);
}
function getData(eid) {
	eid = eid.split(' ');
	let sData = dataFile[eid[0]];
	if (!sData) return '';
	if (eid.length == 2) return sData.intro;
	return sData.conts[--eid[2]] || '';
}
function setData(eid, data) {
	eid = eid.split(' ');
	let sData = dataFile[eid[0]];
	if (!sData) return;
	if (eid.length == 2) sData.intro = data;
	else sData.conts[--eid[2]] = data;
	fs.writeFile(config.dataPath, JSON.stringify(dataFile));
}
http.createServer(o(function*(req, res) {
	req.url = url.parse(req.url, true);
	console.log(req.method, req.url.pathname);
	if (req.url.pathname == '/' || req.url.pathname == '/aff/' || req.url.pathname == '/neg/') {
		res.writeHead(200, {'Content-Type': 'application/xhtml+xml; charset=utf-8'});
		res.write((yield fs.readFile('./html/head.html', yield)).toString().replaceAll('$title', req.url.pathname.replaceAll('/', '') || 'Debate'));
		res.write(replaceBody(req.url.pathname, yield fs.readFile('./html/home.html', yield)));
		res.end(yield fs.readFile('./html/foot.html', yield));
	} else if (req.url.pathname == '/api/edit/') {
		if (req.method != 'POST') return res.writeHead(405) || res.end('Error: Method not allowed. Use POST.');
		let post = '';
		req.on('data', data => post += data);
		req.on('end', () => {
			post = querystring.parse(post);
			setData(post.eid, post.body);
			res.writeHead(204);
			res.end();
		});
	} else if (req.url.pathname.includes('/edit') && !req.url.pathname.includes('/edit/')) {
		const ps = req.url.pathname.split('/');
		const side = ps[1];
		const type = ps[2] == 'edit' ? 'intro' : 'contention ' + ps[2];
		const eid = side + ' ' + type;
		res.write(
			replaceBody(req.url.pathname, (yield fs.readFile('./html/head.html', yield)) + (yield fs.readFile('./html/edit.html', yield)))
			.replaceAll('$title', 'Edit ' + eid)
			.replaceAll('$rawdata', getData(eid))
			.replaceAll('$editing', eid)
		);
		res.end(yield fs.readFile('./html/foot.html', yield));
	} else if (req.url.pathname.indexOf('/aff/') == 0 || req.url.pathname.indexOf('/neg/') == 0) {
		res.writeHead(303, {Location: req.url.pathname.substr(0, 5) + '#cont' + req.url.pathname.substr(5).replaceAll('/', '')});
		res.end();
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