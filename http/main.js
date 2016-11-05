'use strict';
HTMLCollection.prototype.forEach = NodeList.prototype.forEach = Array.prototype.forEach;
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
function sendUpdate() {
	request('/api/edit/', res => console.log(res),
		'eid=' + encodeURIComponent(document.getElementById('editing').firstChild.nodeValue) +
		'&body1=' + encodeURIComponent(document.getElementById('ta1').value) +
		'&body2=' + encodeURIComponent(document.getElementById('ta2').value)
	);
}
addEventListener('click', function(e) {
	document.body.classList.toggle('grey1', document.getElementById('grey1').checked);
	document.body.classList.toggle('grey2', document.getElementById('grey2').checked);
	document.body.classList.toggle('hide1', document.getElementById('hide1').checked);
	document.body.classList.toggle('hide2', document.getElementById('hide2').checked);
});
addEventListener('input', function() {
	if (document.activeElement.parentNode.classList.contains('ta-cont')) {
		document.activeElement.nextElementSibling.textContent = document.activeElement.value + '\n';
		document.activeElement.parentNode.style.height = document.activeElement.nextElementSibling.offsetHeight + 'px';
		clearTimeout(timeout);
		timeout = setTimeout(sendUpdate, 100);
	}
});
addEventListener('keypress', function(e) {
	if (e.keyCode == 115 && e.metaKey) {
		if (document.getElementsByTagName('textarea')[0]) sendUpdate();
		e.preventDefault();
	}
});
addEventListener('DOMContentLoaded', function() {
	document.getElementsByTagName('textarea').forEach((ta) => {
		ta.nextElementSibling.textContent = ta.value + '\n';
		ta.parentNode.style.height = ta.nextElementSibling.offsetHeight + 'px';
	});
});