'use strict';
let timeout;
function request(uri, cb, params) {
	var i = new XMLHttpRequest();
	i.open('POST', uri, true);
	i.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
	i.send(params);
	i.onload = function() {
		cb(this.status == 204 ? 'Success' : this.responseText);
	};
	return i;
}
function sendUpdate(e) {
	request('/api/edit/', res => console.log(res), 'eid=' + encodeURIComponent(document.getElementById('editing').firstChild.nodeValue) + '&body=' + encodeURIComponent(e.value));
}
addEventListener('input', function() {
	if (document.activeElement.parentNode.classList.contains('ta-cont')) {
		document.activeElement.nextElementSibling.textContent = document.activeElement.value + '\n';
		document.activeElement.parentNode.style.height = document.activeElement.nextElementSibling.offsetHeight + 'px';
		clearTimeout(timeout);
		timeout = setTimeout(sendUpdate, 100, document.activeElement);
	}
});
addEventListener('keypress', function(e) {
	if (e.keyCode == 115 && e.metaKey) {
		if (document.getElementsByTagName('textarea')[0]) sendUpdate(document.getElementsByTagName('textarea')[0]);
		e.preventDefault();
	}
});
addEventListener('DOMContentLoaded', function() {
	const ta = document.getElementsByTagName('textarea')[0];
	if (ta) {
		ta.nextElementSibling.textContent = ta.value + '\n';
		ta.parentNode.style.height = ta.nextElementSibling.offsetHeight + 'px';
	}
});