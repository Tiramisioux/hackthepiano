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

	/* Which clefs are switched on. Possibly none — the trainer goes empty in that
	 * case too, and silently overriding the setting would be worse than honouring
	 * it. render() draws nothing rather than guessing where a note should go. */
	function activeClefs() {
		return CLEF_IDS.filter(function (id) { return window.HTP.clefEnabled(id); });
	}

	/* Half a notehead, in em of the staff size, plus a little air. A note is only
	 * fully visible once its whole head is inside the box, not just its centre. */
	var NOTEHEAD_HALF_EM = 0.14;

	/* styles.css nudges `div.staff` down by this much with `top: 0.1em`. The
	 * container does not move with it, so the staff already hangs that far past
	 * the bottom edge it is clipped at — which has to be counted, or every note
	 * near the bottom is short by exactly this. */
	var STAFF_TOP_OFFSET_EM = 0.1;

	/*
	 * Open up the staff container so a note outside the staff is actually seen.
	 *
	 * The container clips to its padding box and is only as tall as the staff
	 * itself, so without this a note far above or below is drawn correctly and
	 * then cut off — which looks exactly like the note failing to register. The
	 * trainer has the same need and settles it once from the level's fixed range;
	 * here the range is whatever you just played, so the room is made per note.
	 *
	 * The amount comes from markerTopEm(), the same function that places the
	 * staff lines, the landmark markings and the noteheads themselves — so the
	 * room made is exactly the room needed. A note that already fits, however far
	 * outside the staff it looks, moves nothing.
	 */
	function makeRoomFor(container, highestShift, lowestShift) {
		var N = notation();
		var above = 0;
		var below = 0;

		if (highestShift !== null) {
			var topEm = N.markerTopEm(highestShift) - NOTEHEAD_HALF_EM + STAFF_TOP_OFFSET_EM;
			above = Math.max(0, -topEm);
		}
		if (lowestShift !== null) {
			var bottomEm = N.markerTopEm(lowestShift) + NOTEHEAD_HALF_EM + STAFF_TOP_OFFSET_EM;
			below = Math.max(0, bottomEm - N.staffHeightEm);
		}

		container.css({
			'padding-top': above ? above.toFixed(3) + 'em' : '',
			'padding-bottom': below ? below.toFixed(3) + 'em' : ''
		});
	}

	/* Follow the same options the trainer honours. */
	function applyOptions() {
		var active = activeClefs();

		CLEF_IDS.forEach(function (clefId) {
			var container = staves[clefId].closest('.staffContainer');
			var on = active.indexOf(clefId) !== -1;
			container.toggle(on);
			if (on) notation().renderStaffMarkers(staves[clefId], clefId);
		});

		/* Only meaningful with both staves up — the offset is the distance
		 * between them. */
		var lower = staves[CLEF_IDS[1]].closest('.staffContainer');
		lower.css('margin-top',
			(window.HTP.settings.musicalClefDistance && active.length === 2)
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

		/* Notes go only to staves that are actually showing, so switching the bass
		 * clef off reads everything on the treble staff with ledger lines rather
		 * than dropping the low notes. */
		var active = activeClefs();
		if (!active.length) {
			updateReadout(group);
			return;
		}
		var byClef = {};
		active.forEach(function (id) { byClef[id] = []; });

		/* "Both" shows a note wherever it can be written rather than only where
		 * it reads best — useful for seeing that middle C is the same note in
		 * either clef. It is off under Musical clef distance, which spaces the
		 * staves by true pitch so both copies would sit in the same place. */
		var onEveryClef = window.HTP.settings.bothClefs === true
			&& window.HTP.settings.musicalClefDistance !== true
			&& active.length > 1;

		group.sounds.forEach(function (sound) {
			if (onEveryClef) {
				var placed = active.filter(function (id) {
					return !!notation().buildNoteGlyph(id, sound);
				});
				if (placed.length) {
					placed.forEach(function (id) { byClef[id].push(sound); });
					return;
				}
			}
			byClef[notation().bestClef(sound, active)].push(sound);
		});

		active.forEach(function (clefId) {
			var container = staves[clefId].closest('.staffContainer');
			if (!byClef[clefId].length) {
				makeRoomFor(container, null, null);
				return;
			}

			var symbol = $('<div class="symbol note visible htp-free-note"></div>');
			var topLedgers = 0;
			var bottomLedgers = 0;
			var highest = null;
			var lowest = null;

			byClef[clefId].forEach(function (sound) {
				var built = notation().buildNoteGlyph(clefId, sound);
				if (!built) return;
				symbol.append(built.glyph);
				/* Ledger lines for anything sitting outside the staff. */
				var ledgers = notation().ledgerLineCount(built.shift);
				topLedgers = Math.max(topLedgers, ledgers);
				bottomLedgers = Math.min(bottomLedgers, ledgers);

				highest = (highest === null) ? built.shift : Math.max(highest, built.shift);
				lowest = (lowest === null) ? built.shift : Math.min(lowest, built.shift);
			});

			notation().addLedgerLines(symbol, topLedgers);
			notation().addLedgerLines(symbol, bottomLedgers);
			staves[clefId].append(symbol);
			makeRoomFor(container, highest, lowest);
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
				/* The trainer's readout refreshes on a timer; this one only
				 * redraws on a note, so it has to be told. */
				if (key === 'octaveNumbers')
					updateReadout(group);
				/* Note colour is baked into the glyph at build time, so redraw. */
				if (key === 'colourNotes' || key.indexOf('landmark') === 0)
					render();
				if (key.indexOf('showClef') === 0) {
					applyOptions();
					render();
				}
				if (key === 'bothClefs') render();
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
