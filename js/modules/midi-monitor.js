/*
 * midi-monitor — reference implementation of a HackThePiano module.
 *
 * Copy this file as the starting point for a new module. It shows the whole
 * contract: register an id/title, build your UI into `root` on init, subscribe
 * to the shared MIDI bus, and clean up when hidden.
 *
 * It lists incoming MIDI messages from both the on-screen keyboard and any real
 * hardware, which makes it the quickest way to confirm a piano is talking to the
 * browser at all.
 */
(function (window, document) {
	'use strict';

	var NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
	var MAX_ROWS = 200;

	var listEl, emptyEl, unsubscribe = null, count = 0;

	function noteName(note) {
		return NOTE_NAMES[((note % 12) + 12) % 12] + (Math.floor(note / 12) - 1);
	}

	function describe(bytes) {
		var type = bytes[0] & 0xf0;
		var channel = (bytes[0] & 0x0f) + 1;
		if (type === 0x90 && bytes[2] > 0)
			return { label: 'Note on', detail: noteName(bytes[1]) + ' · vel ' + bytes[2] + ' · ch ' + channel, kind: 'on' };
		if (type === 0x80 || (type === 0x90 && bytes[2] === 0))
			return { label: 'Note off', detail: noteName(bytes[1]) + ' · ch ' + channel, kind: 'off' };
		if (type === 0xb0)
			return { label: 'Control', detail: 'cc ' + bytes[1] + ' = ' + bytes[2] + ' · ch ' + channel, kind: 'other' };
		return {
			label: '0x' + type.toString(16),
			detail: Array.prototype.slice.call(bytes).join(' '),
			kind: 'other'
		};
	}

	function addRow(bytes, source) {
		if (!listEl) return;
		var info = describe(bytes);

		var row = document.createElement('li');
		row.className = 'htp-monitor__row htp-monitor__row--' + info.kind;
		row.innerHTML =
			  '<span class="htp-monitor__label">' + info.label + '</span>'
			+ '<span class="htp-monitor__detail">' + info.detail + '</span>'
			+ '<span class="htp-monitor__source">' + (source === 'hardware' ? 'piano' : 'on-screen') + '</span>';

		listEl.insertBefore(row, listEl.firstChild);
		count++;
		if (emptyEl) emptyEl.style.display = 'none';
		while (listEl.childNodes.length > MAX_ROWS) listEl.removeChild(listEl.lastChild);
	}

	window.HTP.register({
		id: 'midi-monitor',
		title: 'MIDI monitor',
		description: 'Live view of every MIDI message reaching the browser.',

		init: function (root, api) {
			root.innerHTML =
				  '<div class="htp-monitor">'
				+   '<div class="htp-monitor__head">'
				+     '<h2 class="htp-monitor__title">MIDI monitor</h2>'
				+     '<button type="button" class="btn btn-default btn-sm htp-monitor__clear">Clear</button>'
				+   '</div>'
				+   '<p class="htp-monitor__empty">Play a key — on the drawer below or on a connected piano — and messages appear here.</p>'
				+   '<ol class="htp-monitor__list"></ol>'
				+ '</div>';

			listEl = root.querySelector('.htp-monitor__list');
			emptyEl = root.querySelector('.htp-monitor__empty');
			root.querySelector('.htp-monitor__clear').addEventListener('click', function () {
				listEl.innerHTML = '';
				count = 0;
				if (emptyEl) emptyEl.style.display = '';
			});
		},

		onShow: function (root, api) {
			if (unsubscribe) return;
			unsubscribe = api.midi.subscribe(addRow);
		},

		onHide: function () {
			if (!unsubscribe) return;
			unsubscribe();
			unsubscribe = null;
		}
	});
})(window, document);
