/*
 * free-practice — a grand staff with no exercise attached: it simply shows the
 * notes you are playing, named, with the interval or chord they spell.
 *
 * Play one note and it appears in the middle of the staff, named, large. Play
 * another and the first slides left to make room, so the staff reads as a
 * history of what you have played. Notes played together — held at the same
 * time, or within a couple of hundred milliseconds of each other — stay in one
 * group and are named as an interval or a chord instead of sliding apart.
 *
 * It renders its own staves from the notation primitives js/code.js exposes on
 * HTP.notation, so the geometry, glyphs, spelling and landmark markings are
 * exactly the ones the trainer uses.
 */
(function (window, document) {
	'use strict';

	/* Notes arriving within this window of the group's first note join it, so a
	 * rolled chord reads as one chord rather than three separate notes. A group
	 * also stays open for as long as any of its notes is still held. */
	var GROUP_WINDOW_MS = 220;

	/* Horizontal step between groups, and how many to keep before the oldest
	 * falls off the left. */
	var GROUP_SPACING_EM = 2.0;
	var GROUP_WIDTH_EM = 2.4;
	var MAX_GROUPS = 16;

	var CLEF_IDS = ['treble', 'bass'];

	/* Newest group first. Each is {sounds: [], startedAt, held: {}}. */
	var groups = [];
	var staves = {};               /* clef id -> jQuery .staff element */
	var readoutEl = null;
	var unsubscribe = null;

	function notation() {
		return window.HTP.notation;
	}

	/* --------------------------------------------------------------- staves */

	function buildStaves(root) {
		var container = $('<div class="staffsContainer htp-free__staves"></div>');

		CLEF_IDS.forEach(function (clefId) {
			var staff = $('<div class="staff"></div>').append('<div class="lines"></div>');
			$('<div class="staffContainer"></div>').append(staff).appendTo(container);
			staves[clefId] = staff;

			var clef = notation().buildClefSymbol(clefId);
			if (clef) staff.append(clef.css({left: '0.2em'}));
		});

		$(root).append(
			$('<div class="htp-free"></div>')
				.append(container)
				.append('<div class="htp-readout htp-free__readout"></div>')
		);

		readoutEl = $(root).find('.htp-free__readout');
	}

	/* Follow the same options the trainer honours. */
	function applyOptions() {
		CLEF_IDS.forEach(function (clefId) {
			notation().renderStaffMarkers(staves[clefId], clefId);
		});

		var lower = staves[CLEF_IDS[1]].closest('.staffContainer');
		lower.css('margin-top', window.HTP.settings.musicalClefDistance
			? notation().staffOffsetEm(CLEF_IDS[0], CLEF_IDS[1]) + 'em'
			: '');
	}

	/* ---------------------------------------------------------------- notes */

	/*
	 * Draw every group. Index 0 sits in the middle of the staff and each older
	 * group is one step further left, so a new note pushes the history along.
	 * A group that spans both staves uses the same offset on each, so its
	 * noteheads stay vertically aligned.
	 */
	function render() {
		CLEF_IDS.forEach(function (clefId) {
			staves[clefId].find('.htp-free-note').remove();
		});

		groups.forEach(function (group, index) {
			var offsetEm = (GROUP_WIDTH_EM / 2) + (index * GROUP_SPACING_EM);
			var left = 'calc(50% - ' + offsetEm + 'em)';

			var byClef = {};
			CLEF_IDS.forEach(function (id) { byClef[id] = []; });
			group.sounds.forEach(function (sound) {
				byClef[notation().bestClef(sound, CLEF_IDS)].push(sound);
			});

			CLEF_IDS.forEach(function (clefId) {
				if (!byClef[clefId].length) return;

				var symbol = $('<div class="symbol note visible htp-free-note"></div>')
					.css({left: left});
				if (index > 0) symbol.addClass('htp-free-note--past');

				var topLedgers = 0;
				var bottomLedgers = 0;

				byClef[clefId].forEach(function (sound) {
					var built = notation().buildNoteGlyph(clefId, sound);
					if (!built) return;
					symbol.append(built.glyph);
					var ledgers = notation().ledgerLineCount(built.shift);
					topLedgers = Math.max(topLedgers, ledgers);
					bottomLedgers = Math.min(bottomLedgers, ledgers);
				});

				notation().addLedgerLines(symbol, topLedgers);
				notation().addLedgerLines(symbol, bottomLedgers);
				staves[clefId].append(symbol);
			});
		});

		updateReadout(groups.length ? groups[0].sounds : []);
	}

	function updateReadout(sounds) {
		if (!readoutEl) return;

		if (!sounds.length) {
			readoutEl.html('<div class="htp-readout__secondary">Play a note — on the keyboard below, or on a connected piano.</div>');
			return;
		}


		var described = notation().describeSounds(sounds);
		var html = '<div class="htp-readout__primary">' + described.primary + '</div>';
		if (described.secondary)
			html += '<div class="htp-readout__secondary">' + described.secondary + '</div>';
		readoutEl.html(html);
	}

	/*
	 * A note joins the newest group while that group is still sounding, or while
	 * it is still within the grouping window — that is what makes a chord one
	 * group. Otherwise it starts a new group, pushing the history left.
	 */
	function noteOn(sound) {
		var now = new Date().getTime();
		var newest = groups[0];
		var stillHeld = newest && Object.keys(newest.held).length > 0;
		var withinWindow = newest && (now - newest.startedAt) < GROUP_WINDOW_MS;

		if (newest && (stillHeld || withinWindow)) {
			if (newest.sounds.indexOf(sound) === -1) newest.sounds.push(sound);
		} else {
			groups.unshift({sounds: [sound], startedAt: now, held: {}});
			while (groups.length > MAX_GROUPS) groups.pop();
		}

		groups[0].sounds.sort(function (a, b) { return a - b; });
		groups[0].held[sound] = true;
		render();
	}

	function noteOff(sound) {
		groups.forEach(function (group) { delete group.held[sound]; });
		render();
	}

	/* ------------------------------------------------------------- lifecycle */

	window.HTP.register({
		id: 'free-practice',
		title: 'Free practice',
		description: 'No exercise — just shows what you play, named.',

		init: function (root, api) {
			buildStaves(root);
			applyOptions();
			updateReadout([]);

			api.onSettingChange(function (key) {
				if (key === 'musicalClefDistance' || key === 'lineMarkers'
					|| key.indexOf('landmark') === 0)
					applyOptions();
			});
			api.onMarkersChanged(applyOptions);
		},

		onShow: function (root, api) {
			applyOptions();
			if (unsubscribe) return;
			unsubscribe = api.midi.subscribe(function (bytes) {
				var type = bytes[0] & 0xf0;
				if (type === 0x90 && bytes[2] > 0) noteOn(bytes[1]);
				else if (type === 0x80 || (type === 0x90 && bytes[2] === 0)) noteOff(bytes[1]);
			});
		},

		onHide: function () {
			if (unsubscribe) {
				unsubscribe();
				unsubscribe = null;
			}
			groups = [];
			render();
		}
	});
})(window, document);
