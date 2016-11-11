'use strict';
require('./essentials.js');
const http = require('http');
const path = require('path');
const url = require('url');
const querystring = require('querystring');
const fs = require('fs');
const o = require('yield-yield');
const readYaml = require('read-yaml');
const writeYaml = require('write-yaml');
const config = require('./config.js');
const dataFile = readYaml.sync(config.dataPath);
dataFile.resolution = dataFile.resolution || '';
dataFile.notes = dataFile.notes || '';
dataFile.aff = dataFile.aff || {};
dataFile.aff.dataMap = dataFile.aff.dataMap || [];
dataFile.aff.data = dataFile.aff.data || [];
dataFile.neg = dataFile.neg || {};
dataFile.neg.dataMap = dataFile.neg.dataMap || [];
dataFile.neg.data = dataFile.neg.data || [];
const mime = {
	'.html': 'text/html',
	'.css': 'text/css',
	'.js': 'text/javascript',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.mp3': 'audio/mpeg',
	'.ico': 'image/x-icon'
};
function formatData(sideName, sideData) {
	return '<h1>' + sideName.html() + '</h1>' + sideData.data.map((item, i) => (
		'<h' + sideData.dataMap[i].level + ' id="d' + i + '">' + sideData.dataMap[i].title + '</h' + sideData.dataMap[i].level + '>' +
		'<div class="first">' + (item[0] || '').markdown() + '</div><div class="second">' + (item[1] || '').markdown() + '</div>'
	)).join('');
}
function replaceBody(pathname, fdata) {
	const side = pathname.split('/')[1];
	const editing = pathname.split('/')[2] == 'edit';
	return fdata
		.toString()
		.replaceAll('$resolution', dataFile.resolution)
		.replace('$nav', side ?
				(editing ? '<a href="../">End Edit</a>' : '<a href="/">Home</a>') +
				'<span><a href="/' + side + '/edit/map">Map</a> <a href="#">#</a></span>' +
				dataFile[side].dataMap.map((item, i) => (
					' <span class="l' + item.level + '"><a href="/' + side + '/#d' + i + '">' + item.title + '</a> ' +
					'<a href="/' + side + '/edit/' + i + '">E</a></span>'
				)).join('') +
				dataFile[side].data.reduce((p, item) => (p + item[0].split(/\s+/).length), 0) + '/' +
				dataFile[side].data.reduce((p, item) => (p + item[1].split(/\s+/).length), 0) + ' words'
			: '<span><a href="aff/">Aff</a> <a href="neg/">Neg</a></span>'
		).replaceAll('$data', !fdata.includes('$data') ? '' : side ?
			formatData(side, dataFile[side])
			: '<h1>Notes</h1><div class="ta-cont"><textarea id="notes" autofocus="">' + dataFile.notes + '</textarea><pre></pre></div>'
		);
}
function getData(eid) {
	let sData = dataFile[eid[0]];
	if (!sData) return '';
	if (eid[1] == 'map') return sData.dataMap.map(item => item.level + ' ' + item.title).join('\n');
	return sData.data[eid[1]] || ['', ''];
}
function setData(eid, data1, data2) {
	console.log(eid);
	if (eid[0] == 'notes') dataFile.notes = data1;
	else {
		let sData = dataFile[eid[0]];
		if (!sData) return;
		if (eid[1] == 'map') sData.dataMap = data1.split('\n').map(item => ({level: parseInt(item[0]), title: item.substr(2)}));
		else sData.data[eid[1]] = [data1, data2];
	}
	writeYaml(config.dataPath, dataFile, (err) => {if (err) throw err;});
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
			setData(post.eid.split(' '), (post.body1 || '').sanitize(), (post.body2 || '').sanitize());
			res.writeHead(204);
			res.end();
		});
	} else if (req.url.pathname.match(/(aff|neg)\/edit\/(\d+|map)/)) {
		const eid = req.url.pathname.substr(1).replace('edit/', '').split('/');
		res.writeHead(200, {'Content-Type': 'application/xhtml+xml; charset=utf-8'});
		const data = getData(eid);
		const map = eid[1] == 'map';
		res.write(
			replaceBody(req.url.pathname, (yield fs.readFile('./html/head.html', yield)) + (yield fs.readFile('./html/edit.html', yield)))
			.replace('<body>', '<body class="editpage">')
			.replaceAll('$title', 'Edit ' + eid.join(' '))
			.replaceAll('$rawdata1', map ? data : data[0])
			.replaceAll('$rawdata2', data[1])
			.replaceAll('class="second"', map ? 'class="second" hidden=""' : 'class="second"')
			.replaceAll('$editing', eid.join(' '))
			.replaceAll('$htitle', map ? '' : dataFile[eid[0]].dataMap[eid[1]].title)
		);
		res.end(yield fs.readFile('./html/foot.html', yield));
	} else if (req.url.pathname.indexOf('/aff/') == 0 || req.url.pathname.indexOf('/neg/') == 0) {
		res.writeHead(303, {Location: req.url.pathname.substr(0, 5) + '#d' + req.url.pathname.substr(5).replaceAll('/', '')});
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