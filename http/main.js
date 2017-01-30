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
let editing;
function sendUpdate() {
	request('/api/edit/', res => console.log(res), document.getElementById('ta').value);
}
addEventListener('click', function(e) {
	document.body.classList.toggle('speech1', document.getElementById('speech1').checked);
});
addEventListener('input', function() {
	if (document.activeElement.parentNode.classList.contains('ta-cont')) {
		document.activeElement.nextElementSibling.textContent = document.activeElement.value + '\n';
		document.activeElement.parentNode.style.height = document.activeElement.nextElementSibling.offsetHeight + 'px';
		clearTimeout(timeout);
		timeout = setTimeout(sendUpdate, 100);
	}
});
function formatTime(t) {
	t = Math.floor(t / 100) / 10;
	const s = t % 60;
	return Math.floor(t / 60) + ':' + (s < 10 ? '0' + s.toFixed(1) : s.toFixed(1));
}
const mainTimer = {time: 0};
const pTimer = {time: 0};
const oTimer = {time: 0};
function updateTimers() {
	const now = new Date().getTime();
	if (mainTimer.running) {
		mainTimer.time += now - mainTimer.lastTime;
		mainTimer.lastTime = now;
	}
	document.getElementById('maintime').firstChild.nodeValue = formatTime(mainTimer.time);
	if (pTimer.running) {
		pTimer.time += now - pTimer.lastTime;
		pTimer.lastTime = now;
	}
	document.getElementById('ptime').firstChild.nodeValue = formatTime(pTimer.time);
	if (oTimer.running) {
		oTimer.time += now - oTimer.lastTime;
		oTimer.lastTime = now;
	}
	document.getElementById('otime').firstChild.nodeValue = formatTime(oTimer.time);
	requestAnimationFrame(updateTimers);
}
addEventListener('keypress', function(e) {
	const now = new Date().getTime();
	if (e.keyCode == 115 && e.metaKey) {
		if (document.getElementById('ta')) sendUpdate();
		e.preventDefault();
	} else if (e.keyCode == 32 && document.activeElement == document.body) {
		if (mainTimer.lastTap > now - 300) mainTimer.running = mainTimer.time = 0;
		else mainTimer.running ^= 1;
		mainTimer.lastTap = mainTimer.lastTime = now;
		e.preventDefault();
	} else if (e.keyCode == 112 && document.activeElement == document.body) {
		if (pTimer.lastTap > now - 300) pTimer.running = pTimer.time = 0;
		else pTimer.running ^= 1;
		pTimer.lastTap = pTimer.lastTime = now;
		e.preventDefault();
	} else if (e.keyCode == 111 && document.activeElement == document.body) {
		if (oTimer.lastTap > now - 300) oTimer.running = oTimer.time = 0;
		else oTimer.running ^= 1;
		oTimer.lastTap = oTimer.lastTime = now;
		e.preventDefault();
	}
});
addEventListener('DOMContentLoaded', function() {
	document.getElementsByTagName('textarea').forEach((ta) => {
		ta.nextElementSibling.textContent = ta.value + '\n';
		ta.parentNode.style.height = ta.nextElementSibling.offsetHeight + 'px';
		requestAnimationFrame(() => {
			ta.parentNode.style.height = ta.nextElementSibling.offsetHeight + 'px';
		});
		ta.addEventListener('keyup', function() {
			textareaHandler.call(this, true);
		});
		ta.addEventListener('keydown', textareaHandler);
		ta.addEventListener('keypress', textareaHandler);
	});
	editing = document.getElementById('editing');
	updateTimers();
});
function textareaHandler(e, s) {
	if (this.noHandle) return delete this.nHandle;
	if (!this.hist) this.hist = [{
		body: this.value,
		start: this.selectionStart,
		end: this.selectionEnd
	}];
	if (!this.hIndex) this.hIndex = 0;
	if (!s && e.which == 9 && !e.ctrlKey && !e.altKey && !e.metaKey) {
		if (this.selectionStart == this.selectionEnd) {
			if (e.shiftKey) {
				var cS = this.selectionEnd - 1;
				while (this.value[cS] && this.value[cS] != '\n') {
					if (this.value[cS] == '\t') {
						this.value = this.value.substr(0, cS) + this.value.substr(++cS);
						break;
					} else cS--;
				}
			} else {
				var oS = this.selectionEnd;
				this.value = this.value.substr(0, oS) + '\t' + this.value.substr(oS);
				this.selectionStart = this.selectionEnd = ++oS;
			}
		} else {
			var lines = this.value.split('\n'),
				i = 0,
				start = 0;
			while ((i += lines[start].length) < this.selectionStart - start) start++;
			var end = start;
			i -= lines[start].length;
			while ((i += lines[end].length) < this.selectionEnd - end) end++;
			i = --start;
			while (++i <= end) {
				if (e.shiftKey) lines[i][0] != '\t' || (lines[i] = lines[i].substr(1));
				else lines[i] = '\t' + lines[i];
			}
			this.value = lines.join('\n');
			var nS = lines.slice(0, ++start).join('\n').length;
			this.selectionStart = (nS += nS ? 1 : 0);
			this.selectionEnd = nS + lines.slice(start, ++end).join('\n').length;
		}
		if (this.hist[this.hIndex].body == this.value) return;
		this.hist.push({
			body: this.value,
			start: this.selectionStart,
			end: this.selectionEnd
		});
		this.hIndex = this.hist.length - 1;
		e.preventDefault();
	} else if (e.which == 90 && e.metaKey && !e.altKey) {
		e.preventDefault();
		if (this.hIndex == this.hist.length - 1 && this.hist[this.hIndex].body != this.value) {
			this.hist.push({
				body: this.value,
				start: this.selectionStart,
				end: this.selectionEnd
			});
			this.hIndex = this.hist.length - 1;
		}
		var data = this.hist[e.shiftKey ? ++this.hIndex : --this.hIndex];
		if (data) {
			this.value = data.body;
			this.selectionStart = data.start;
			this.selectionEnd = data.end;
		} else e.shiftKey ? --this.hIndex : ++this.hIndex;
	} else {
		if (this.hist[this.hIndex].body != this.value) this.hist = this.hist.slice(0, this.hIndex + 1);
		if (this.timer) clearTimeout(this.timer);
		this.timer = setTimeout(function(e) {
			if (e.hIndex != e.hist.length - 1) return;
			if (e.hist[e.hIndex].body == e.value) return;
			e.hist.push({
				body: e.value,
				start: e.selectionStart,
				end: e.selectionEnd
			});
			e.hIndex = e.hist.length - 1;
		}, this.lastKeyCode == e.which || [8, 13].indexOf(e.which) == -1 ? 200 : e.metaKey || e.shiftKey ? 100 : 0, this);
	}
	this.lastKeyCode = e.which;
}