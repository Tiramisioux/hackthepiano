/*
 * free-practice — a grand staff with no exercise attached: it shows the notes
 * you are playing, in the middle of the staff, named.
 *
 * Play a note and it appears dead centre, with ledger lines when it sits
 * outside the staff. Notes played together — held at the same time, or within a
 * couple of hundred milliseconds of each other — form one group and are named
 * as an interval or a chord. The group stays up until you play the next one, so
 * you can read back what you just played.
 *
 * Chord naming takes the note you struck FIRST as the root, which is what lets a
 * voicing keep its name: C-E-G spread across two hands is still C major as long
 * as the C came first.
 *
 * It renders its staves from the notation primitives js/code.js publishes on
 * HTP.notation, so the geometry, glyphs, spelling and landmark markings are
 * exactly the trainer's.
 */
(function (window, document) {
	'use strict';

	/* Notes arriving within this window of the group's first note join it, so a
	 * rolled chord reads as one chord rather than three separate notes. A group
	 * also stays open for as long as any of its notes is still held. */
	var GROUP_WINDOW_MS = 220;

	var CLEF_IDS = ['treble', 'bass'];

	var group = null;              /* {sounds, order, startedAt, held}  */
	var staves = {};               /* clef id -> jQuery .staff element  */
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

			notation().renderStaffLines(staff);

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
	 * Draw the current group in the middle of the staff. Its horizontal position
	 * is fixed in css/htp.css so the notehead lands exactly on centre; a group
	 * spanning both staves therefore lines up vertically for free.
	 */
	function render() {
		CLEF_IDS.forEach(function (clefId) {
			staves[clefId].find('.htp-free-note').remove();
		});

		if (!group || !group.sounds.length) {
			updateReadout(null);
			return;
		}

		var byClef = {};
		CLEF_IDS.forEach(function (id) { byClef[id] = []; });
		group.sounds.forEach(function (sound) {
			byClef[notation().bestClef(sound, CLEF_IDS)].push(sound);
		});

		CLEF_IDS.forEach(function (clefId) {
			if (!byClef[clefId].length) return;

			var symbol = $('<div class="symbol note visible htp-free-note"></div>');
			var topLedgers = 0;
			var bottomLedgers = 0;

			byClef[clefId].forEach(function (sound) {
				var built = notation().buildNoteGlyph(clefId, sound);
				if (!built) return;
				symbol.append(built.glyph);
				/* Ledger lines for anything sitting outside the staff. */
				var ledgers = notation().ledgerLineCount(built.shift);
				topLedgers = Math.max(topLedgers, ledgers);
				bottomLedgers = Math.min(bottomLedgers, ledgers);
			});

			notation().addLedgerLines(symbol, topLedgers);
			notation().addLedgerLines(symbol, bottomLedgers);
			staves[clefId].append(symbol);
		});

		updateReadout(group);
	}

	function updateReadout(current) {
		if (!readoutEl) return;

		if (!current || !current.sounds.length) {
			readoutEl.html('<div class="htp-readout__secondary">Play a note — on the keyboard below, or on a connected piano.</div>');
			return;
		}

		/* order[0] is the note struck first, which names the chord. */
		var described = notation().describeSounds(current.sounds.slice(), current.order[0]);
		var html = '<div class="htp-readout__primary">' + described.primary + '</div>';
		if (described.secondary)
			html += '<div class="htp-readout__secondary">' + described.secondary + '</div>';
		readoutEl.html(html);
	}

	/*
	 * A note joins the current group while that group is still sounding, or while
	 * it is still within the grouping window — that is what makes a chord one
	 * group. Otherwise it replaces it.
	 */
	function noteOn(sound) {
		var now = new Date().getTime();
		var stillHeld = group && Object.keys(group.held).length > 0;
		var withinWindow = group && (now - group.startedAt) < GROUP_WINDOW_MS;

		if (!group || !(stillHeld || withinWindow))
			group = {sounds: [], order: [], startedAt: now, held: {}};

		if (group.sounds.indexOf(sound) === -1) {
			group.sounds.push(sound);
			group.order.push(sound);
			group.sounds.sort(function (a, b) { return a - b; });
		}
		group.held[sound] = true;
		render();
	}

	function noteOff(sound) {
		if (!group) return;
		delete group.held[sound];
		/* The group stays on screen after release, until the next one replaces
		 * it, so you can read back what you just played. */
	}

	/* ------------------------------------------------------------- lifecycle */

	window.HTP.register({
		id: 'free-practice',
		title: 'Free practice',
		description: 'No exercise — just shows what you play, named.',

		init: function (root, api) {
			buildStaves(root);
			applyOptions();
			render();

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
			group = null;
			render();
		}
	});
})(window, document);
