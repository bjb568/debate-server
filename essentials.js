'use strict';
Object.prototype.replaceAll = function(find, replace) {
	let t = this.toString();
	if (typeof find == 'string') return t.split(find).join(replace);
	let i, j;
	while (typeof(i = find.shift()) == 'string' && typeof(j = replace.shift()) == 'string') t = t.replaceAll(i || '', j || '');
	return t;
};
Object.prototype.sanitize = function() {
	return this.toString().replaceAll(['“', '”', '‘', '’', 'U.S.'], ['"', '"', '\'', '\'', 'US']);
};
Object.defineProperty(Object.prototype, 'last', {get() {
	return this[this.length - 1];
}});
Object.prototype.html = function html() {
	return this.toString().replaceAll(['&', '<', '>', '"', '\t', '\n', '\r', '\b'], ['&amp;', '&lt;', '&gt;', '&quot;', '&#9;', '&#10;', '', '']);
};
function warning(message) {
	//console.log(message);
	//Ignore md warnings on server
}
Object.prototype.mdEscape = function mdEscape() {
	return this.toString().replace(/[`*_–\-+[(:"\\]/g, '\\$&');
};
function parseURL(url) {
	let match = url.match(/(?:([^:/?#]+):)?(?:\/\/([^/?#]*))?([^?#]*)(\\?(?:[^#]*))?(#(?:.*))?/);
	return {
		scheme: match[1] || '',
		host: match[2] || '',
		path: match[3] || '',
		query: match[4] || '',
		fragment: match[5] || ''
	};
}
Object.prototype.smd = function smd() {
	let input = this.html();
	while (/\^([\w^]+)/.test(input)) input = input.replace(/\^([\w^]+)/, '<sup>$1</sup>');
	return input
		.replaceAll('\u0001', '^')
		.replace(/\[(.+?)\|(.+?)]/g, '<abbr title="$2">$1</abbr>')
		.replaceAll('\u0002', '[')
		.replace(/\[\[\[(\d+)]]]/g, '<sup class="time-ref">[ $1 ]</sup>')
		.replace(/\[\[(\d+)](.*?)]/g, '<sup class="reference" title="$2">[$1]</sup>')
		.replace(/\[\[ !\[([^[\]]+?)]\(https?:\/\/([^\s("\\]+?\.[^\s"\\]+?)\) ]]/g, '<img alt="$1" class="center" src="https://$2" />')
		.replace(/!\[([^[\]]+?)]\(https?:\/\/([^\s("\\]+?\.[^\s"\\]+?)\)/g, '<img alt="$1" src="https://$2" />')
		.replace(/\[([^[\]]+)]\((https?:\/\/[^\s()"[\]]+?\.[^\s"\\[\]]+?)\)/g, '$1'.link('$2'))
		.replace(/(\s|^)https?:\/\/([^\s()"]+?\.[^\s"]+?\.(svg|png|tiff|jpg|jpeg)(\?[^\s"/]*)?)/g, '$1<img src="https://$2" alt="user image" />')
		.replace(/(\s|^)(https?:\/\/([^\s()"]+?\.[^\s"()]+))/g, function(m, p1, p2, p3) {
			let parsed = parseURL(p2.replace('youtu.be/', 'youtube.com/watch?v='));
			let i;
			if (
				/(^|.+\.)youtube\.com$/.test(parsed.host) && (i = parsed.query.match(/^\?(.+?&)?v=([^&]+)/))
			) return '<div class="max-width"><div class="iframe-16-9"><iframe src="https://www.youtube.com/embed/' + i[2] + '" frameborder="0" allowfullscreen=""></iframe></div></div>';
			return p1 + p3.link(p2);
		});
};
Object.prototype.imd = function imd() {
	let input = this.toString(),
		output = '',
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
			'[v]': 'let',
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
	outer: for (let i = 0; i < input.length; i++) {
		if (!['code', 'samp'].includes(current[current.length - 1])) {
			if (input[i] == '\\') span += input[++i].replace('^', '\u0001').replace('[', '\u0002');
			else {
				for (let l = 3; l > 0; l--) {
					if (typeof tags[input.substr(i, l)] == 'string') {
						output += span.smd();
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
				for (let j in stags) {
					for (let l = 5; l > 0; l--) {
						if (stags[j].start == input.substr(i, l)) {
							output += span.smd() + '<' + j + '>';
							span = '';
							current.push(j);
							i += l - 1;
							continue outer;
						} else if (stags[j].end == input.substr(i, l)) {
							if (stags[current[current.length - 1]] == stags[j]) {
								output += span.smd() + '</' + j + '>';
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
		} else output += input[i].html();
	}
	output += span.smd();
	if (current.length) warning('Unclosed tags. <' + current.join('>, <') + '>');
	for (let i = current.length - 1; i >= 0; i--) output += '</' + current[i] + '>';
	return output;
};
Object.prototype.md = function md() {
	let blockquote = '',
		ul = '',
		ol = '',
		li = '',
		code = '';
	return this.toString().split('\n').map(function(val, i, arr) {
		if (!val) return '';
		let f;
		if (val.substr(0, 2) == '> ') {
			val = val.substr(2);
			if (arr[i + 1] && arr[i + 1].substr(0, 2) == '> ') {
				blockquote += val + '\n';
				return '';
			} else {
				let arg = blockquote + val;
				blockquote = '';
				return '<blockquote>' + arg.md() + '</blockquote>';
			}
		} else if (val.substr(0, 3) == '>! ') {
			val = val.substr(3);
			if (arr[i + 1] && arr[i + 1].substr(0, 3) == '>! ') {
				blockquote += val + '\n';
				return '';
			} else {
				let arg = blockquote + val;
				blockquote = '';
				return '<blockquote class="spoiler">' + arg.md() + '</blockquote>';
			}
		} else if (val.substr(0, 2) == '- ' || val.substr(0, 2) == '* ') {
			if (!ul) ul = '<ul>';
			val = val.substr(2);
			if (li) {
				ul += '<li>' + li.md() + '</li>';
				li = '';
			}
			if (arr[i + 1] && (arr[i + 1].substr(0, 2) == '- ' || arr[i + 1].substr(0, 2) == '* ')) {
				ul += '<li>' + val.imd() + '</li>';
				return '';
			} else if (arr[i + 1] && (arr[i + 1][0] == '\t' || arr[i + 1].substr(0, 4) == '    ')) {
				li += val + '\n';
				return '';
			} else {
				let arg = ul + '<li>' + val.imd() + '</li>';
				ul = '';
				return arg + '</ul>';
			}
		} else if (f = val.match(/^(\d+|[A-z])[.)] /)) {
			if (!ol) ol = '<ol>';
			val = val.substr(f[0].length);
			if (li) {
				ol += '<li>' + li.md() + '</li>';
				li = '';
			}
			if (/^(\d+|[A-z])[.)] /.test(arr[i + 1])) {
				ol += '<li>' + val.imd() + '</li>';
				return '';
			} else if (arr[i + 1] && (arr[i + 1][0] == '\t' || arr[i + 1].substr(0, 4) == '    ')) {
				li += val + '\n';
				return '';
			} else {
				let arg = ol + '<li>' + val.imd() + '</li>';
				ol = '';
				return arg + '</ol>';
			}
		} else if (li && val[0] == '\t') {
			li += val.substr(1) + '\n';
			if (ul && (!arr[i + 1] || (arr[i + 1][0] != '\t' && arr[i + 1].substr(0, 4) != '    ' && arr[i + 1].substr(0, 2) != '- ' && arr[i + 1].substr(0, 2) != '* '))) {
				let arg = ul + '<li>' + li.md() + '</li>';
				li = '';
				return arg + '</ul>';
			} else if (ol && (!arr[i + 1] || (arr[i + 1][0] != '\t' && arr[i + 1].substr(0, 4) != '    '))) {
				let arg = ol + '<li>' + li.md() + '</li>';
				li = '';
				return arg + '</ol>';
			}
			return '';
		} else if (li && val.substr(0, 4) == '    ') {
			li += val.substr(4) + '\n';
			if (ul && (!arr[i + 1] || (arr[i + 1][0] != '\t' && arr[i + 1].substr(0, 4) != '    ' && arr[i + 1].substr(0, 2) != '- ' && arr[i + 1].substr(0, 2) != '* '))) {
				let arg = ul + '<li>' + li.md() + '</li>';
				li = '';
				return arg + '</ul>';
			} else if (ol && (!arr[i + 1] || (arr[i + 1][0] != '\t' && arr[i + 1].substr(0, 4) != '    '))) {
				let arg = ol + '<li>' + li.md() + '</li>';
				li = '';
				return arg + '</ol>';
			}
			return '';
		} else if (val[0] == '\t') {
			code += val.substr(1);
			if (!arr[i + 1] || (arr[i + 1].substr(0, 4) != '    ' && arr[i + 1][0] != '\t')) {
				let arg = code.html();
				code = '';
				return '<code class="blk">' + arg + '</code>';
			} else code += '\n';
			return '';
		} else if (val.substr(0, 4) == '    ') {
			code += val.substr(4);
			if (!arr[i + 1] || (arr[i + 1].substr(0, 4) != '    ' && arr[i + 1][0] != '\t')) {
				let arg = code.html();
				code = '';
				return '<code class="blk">' + arg + '</code>';
			} else code += '\n';
			return '';
		} else if ((f = val.match(/^#{1,6} /)) && (f = f[0].length - 1)) {
			return '<h' + f + '>' + val.substr(f + 1).imd() + '</h' + f + '>';
		} else if (/^[-–—]{12,}$/.test(val)) {
			return '<hr />';
		} else if (i = val.match(/^cite\[(\d+)]: /)) {
			return '<div><sup class="reference-list">' + i[1] + '</sup> ' + val.substr(i[0].length).imd() + '</div>';
		} else return '<p>' + val.imd() + '</p>';
	}).join('');
};