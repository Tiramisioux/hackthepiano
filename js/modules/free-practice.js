/*
 * free-practice — a grand staff with no exercise attached: it simply shows the
 * notes you are playing, named, with the interval or chord they spell.
 *
 * Play one note and its name appears, large. Hold it and add another and the
 * interval appears underneath; a third and it is named as a chord. Notes linger
 * briefly after release, so a rolled chord still reads as one chord rather than
 * three separate notes.
 *
 * It renders its own staves from the notation primitives js/code.js exposes on
 * HTP.notation, so the geometry, glyphs, spelling and landmark markings are
 * exactly the ones the trainer uses.
 */
(function (window, document) {
	'use strict';

	/* How long a released note keeps sounding, so notes played in quick
	 * succession still group into one interval or chord. */
	var RELEASE_LINGER_MS = 220;

	var CLEF_IDS = ['treble', 'bass'];

	var held = {};                 /* midi note -> true while sounding   */
	var releaseTimers = {};        /* midi note -> pending removal timer */
	var staves = {};               /* clef id  -> jQuery .staff element  */
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

	function sounding() {
		return Object.keys(held).map(Number).sort(function (a, b) { return a - b; });
	}

	function render() {
		var sounds = sounding();

		/* Group the sounding notes onto whichever staff reads them best. */
		var byClef = {};
		CLEF_IDS.forEach(function (id) { byClef[id] = []; });
		sounds.forEach(function (sound) {
			byClef[notation().bestClef(sound, CLEF_IDS)].push(sound);
		});

		CLEF_IDS.forEach(function (clefId) {
			staves[clefId].find('.htp-free-note').remove();
			if (!byClef[clefId].length) return;

			var symbol = $('<div class="symbol note visible htp-free-note"></div>');
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

		updateReadout(sounds);
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

	function noteOn(sound) {
		if (releaseTimers[sound]) {
			window.clearTimeout(releaseTimers[sound]);
			delete releaseTimers[sound];
		}
		held[sound] = true;
		render();
	}

	function noteOff(sound) {
		if (releaseTimers[sound]) return;
		releaseTimers[sound] = window.setTimeout(function () {
			delete releaseTimers[sound];
			delete held[sound];
			render();
		}, RELEASE_LINGER_MS);
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
			held = {};
			Object.keys(releaseTimers).forEach(function (sound) {
				window.clearTimeout(releaseTimers[sound]);
				delete releaseTimers[sound];
			});
			render();
		}
	});
})(window, document);
