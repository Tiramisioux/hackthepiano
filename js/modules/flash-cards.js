/*
 * flash-cards — the note trainer's exercise with nothing moving.
 *
 * One card at a time, held on screen until you play it. A card is either a
 * note drawn on the staff, or a note named in letters for you to find on the
 * keyboard. A wrong key is shown in red where it landed and the card waits; a
 * right one is shown in green until you let it go, and the next card comes up.
 *
 * The pool is the trainer's own level table: "Beginner 1" here asks exactly
 * the notes "Beginner 1" asks there, on the same staves, in the same clefs and
 * keys, with the clef set and key changing every ten cards as they do there.
 * The only differences are that nothing scrolls and nothing expires.
 *
 * It renders its staves from the notation primitives js/code.js publishes on
 * HTP.notation, so the geometry, glyphs, spelling and markings are the
 * trainer's own.
 */
(function (window, document) {
	'use strict';

	/* Cards between a change of clef set and key — the trainer's notesPerClef. */
	var CARDS_PER_CLEF = 10;
	/* After you lift the key from a right answer: long enough that the green
	 * is a beat rather than a flicker, short enough not to feel like waiting. */
	var RELEASE_MS = 170;
	/* A right answer whose key is already up when it is judged — a quick
	 * on-screen click — still gets its moment of green. */
	var FEEDBACK_MS = 480;
	/* A note-off can go missing: a MIDI hiccup, a pointer lost off the edge of
	 * an on-screen key. Do not wait for it forever. */
	var STUCK_NOTE_MS = 4000;
	var STORAGE_LEVEL = 'htp.flashCards.level';
	var STORAGE_MODE = 'htp.flashCards.mode';
	var STAFF_IDS = ['staff1', 'staff2'];
	var MODE_STAFF = 'staff', MODE_NAME = 'name';

	var staves = {};              /* staff id -> jQuery .staff             */
	var stavesEl, nameEl, feedbackEl, statsEl, levelEl, modeEl, noLabelsEl;
	var level = null, levelKey = null;
	var mode = MODE_STAFF;
	var round = null;             /* {clefSet, key, count}                 */
	var card = null;              /* the prompt up now                     */
	var stats = null;
	var held = {};                /* midi note -> true while the key is down */
	var ghosts = {};              /* midi note -> elements drawn for it     */
	var unsubscribe = null;

	function notation() { return window.HTP.notation; }
	function randomOf(list) { return list[Math.floor(Math.random() * list.length)]; }
	function now() { return (window.performance || Date).now(); }

	function readStored(key, fallback) {
		try {
			var v = window.localStorage.getItem(key);
			return v === null ? fallback : v;
		} catch (e) { return fallback; }
	}
	function writeStored(key, value) {
		try { window.localStorage.setItem(key, String(value)); } catch (e) { /* non-fatal */ }
	}

	/* ------------------------------------------------------------------ UI */

	function buildUI(el) {
		el.innerHTML =
			  '<div class="htp-fc">'
			+   '<header class="htp-fc__head">'
			+     '<label class="htp-fc__field"><span class="htp-fc__label">Level</span>'
			+       '<select class="htp-fc__level" title="The note trainer\'s levels: the same notes, staves, clefs and keys"></select></label>'
			+     '<label class="htp-fc__field"><span class="htp-fc__label">Show</span>'
			+       '<select class="htp-fc__mode" title="How the card asks: drawn on the staff, or named for you to find on the keyboard">'
			+         '<option value="staff">Note on the staff</option>'
			+         '<option value="name">Note by name</option>'
			+       '</select></label>'
			+     '<span class="htp-fc__stats"></span>'
			+   '</header>'
			+   '<div class="htp-fc__prompt">'
			+     '<div class="htp-fc__staves staffsContainer"></div>'
			+     '<div class="htp-fc__name" hidden></div>'
			+   '</div>'
			+   '<div class="htp-fc__feedback"></div>'
			+   '<footer class="htp-fc__foot">'
			+     '<label class="htp-fc__opt" title="Blank the note names printed on the on-screen keys, so a by-name card cannot be answered by reading the keyboard">'
			+       '<input type="checkbox" class="htp-fc__nolabels"> Hide key labels'
			+     '</label>'
			+     '<button type="button" class="btn btn-default btn-sm htp-fc__skip" title="Put this card away and draw the next">Skip</button>'
			+   '</footer>'
			+ '</div>';

		stavesEl = el.querySelector('.htp-fc__staves');
		nameEl = el.querySelector('.htp-fc__name');
		feedbackEl = el.querySelector('.htp-fc__feedback');
		statsEl = el.querySelector('.htp-fc__stats');
		levelEl = el.querySelector('.htp-fc__level');
		modeEl = el.querySelector('.htp-fc__mode');
		noLabelsEl = el.querySelector('.htp-fc__nolabels');

		/* Two staves, as the trainer has: a level names which it uses. */
		STAFF_IDS.forEach(function (id) {
			var staff = $('<div class="staff"></div>').append('<div class="lines"></div>');
			$('<div class="staffContainer"></div>').append(staff).appendTo(stavesEl);
			staves[id] = staff;
			notation().renderStaffLines(staff);
		});

		var levels = notation().levels;
		Object.keys(levels).forEach(function (key) {
			var option = document.createElement('option');
			option.value = key;
			option.textContent = levels[key].name;
			levelEl.appendChild(option);
		});
		levelEl.addEventListener('change', function () {
			setLevel(levelEl.value);
			/* Hand the keys back: while the select has focus the computer-
			 * keyboard note mapping types into it instead of playing. */
			levelEl.blur();
		});
		modeEl.addEventListener('change', function () {
			setMode(modeEl.value);
			modeEl.blur();
		});
		noLabelsEl.addEventListener('change', function () {
			document.body.classList.toggle('htp-nolabels', noLabelsEl.checked);
		});
		el.querySelector('.htp-fc__skip').addEventListener('click', function () {
			forgetAnswer();
			nextCard();
		});
	}

	function setLevel(key) {
		var levels = notation().levels;
		if (!levels[key]) key = Object.keys(levels)[0];
		levelKey = key;
		level = levels[key];
		levelEl.value = key;
		writeStored(STORAGE_LEVEL, key);
		stats = { correct: 0, wrong: 0, timeSum: 0, timed: 0 };
		updateStats();
		round = null;
		forgetAnswer();
		nextCard();
	}

	function setMode(next) {
		mode = next === MODE_NAME ? MODE_NAME : MODE_STAFF;
		modeEl.value = mode;
		writeStored(STORAGE_MODE, mode);
		/* The card stays; only how it is asked changes. */
		render();
	}

	/* ------------------------------------------------------------- staves */

	/* Which of the round's staves can carry a card: the clef has to be on. */
	function usableStaves() {
		if (!round) return [];
		return round.ids.filter(function (id) {
			return window.HTP.clefEnabled(round.clefSet[id]);
		});
	}

	/*
	 * Draw the clefs and the markings for the current round. A staff is shown
	 * only when the level uses it and its clef is switched on, exactly as the
	 * trainer decides; with the musical clef distance on, two different clefs
	 * are spaced by their true pitch distance.
	 */
	function shownClefs() {
		return STAFF_IDS.map(function (id) {
			var inRound = round && round.ids.indexOf(id) !== -1;
			var clefId = inRound ? round.clefSet[id] : null;
			return (clefId && window.HTP.clefEnabled(clefId)) ? clefId : null;
		});
	}

	function drawStaves() {
		var shown = shownClefs();
		/* The gap between musically continuous staves is real staff positions,
		 * and the upper staff's legend and markings run on down through it. */
		var pair = notation().pairOptions((shown[0] && shown[1]) ? notation().gapBetween(shown[0], shown[1]) : 0);

		STAFF_IDS.forEach(function (id, i) {
			var staff = staves[id];
			var container = staff.closest('.staffContainer');
			staff.find('.symbol.clef').remove();
			staff.find('.htp-markers').remove();

			var clefId = shown[i];
			container.toggle(!!clefId);
			if (!clefId) return;

			/* Clef first — with the key signature — then the markings and the
			 * legend, which are placed beside it. */
			var clef = notation().buildClefSymbol(clefId, round.key);
			if (clef) staff.append(clef.css({ left: '0.2em' }));
			notation().renderStaffMarkers(staff, clefId, undefined, pair[i]);
		});
		applySpacing();
	}

	/* Two different clefs, musically spaced. Re-applied whenever the ledger
	 * room changes, because that room is padding and lies in the gap. */
	function applySpacing() {
		var shown = shownClefs();
		var upper = staves[STAFF_IDS[0]].closest('.staffContainer');
		var lower = staves[STAFF_IDS[1]].closest('.staffContainer');
		lower.css('margin-top',
			(window.HTP.settings.musicalClefDistance && shown[0] && shown[1] && shown[0] !== shown[1])
				? notation().staffOffsetEm(shown[0], shown[1], upper, lower) + 'em'
				: '');
	}

	/* Open the container up so a card outside the staff is actually seen. The
	 * room covers the level's whole range, as the trainer's padding does, so a
	 * wrong note a step or two off the card is not cut away either. */
	function makeRoom(staffId, shifts) {
		var highest = Math.max.apply(null, shifts.concat([level.shiftTo])) + 2;
		var lowest = Math.min.apply(null, shifts.concat([level.shiftFrom])) - 2;
		var room = notation().roomForShiftsEm(highest, lowest);
		STAFF_IDS.forEach(function (id) {
			var container = staves[id].closest('.staffContainer');
			var mine = id === staffId;
			container.css({
				'padding-top': mine && room.above ? room.above.toFixed(3) + 'em' : '',
				'padding-bottom': mine && room.below ? room.below.toFixed(3) + 'em' : ''
			});
		});
		applySpacing();
	}

	/* -------------------------------------------------------------- cards */

	/* The clef sets a round may draw from. Which clef a level is read in is
	 * the user's choice in the options bar — the Treble/Bass switches — not
	 * a property of the level itself, so a card has to ask the same question
	 * the trainer would rather than reading level.clefSets straight. Guarded
	 * because the trainer is only just growing this API. */
	function clefSetsFor(lvl) {
		var n = notation();
		return (n && typeof n.clefSetsFor === 'function') ? n.clefSetsFor(lvl) : lvl.clefSets;
	}

	/*
	 * A round fixes the clef set and key for the next few cards, as the trainer
	 * does every ten notes.
	 *
	 * Two staves carrying the SAME clef are two copies of one staff here. The
	 * trainer can use both, because it has notes flowing along each; a card
	 * sits on one staff at a time, so the other is an empty duplicate — two
	 * bass clefs one above the other, with nothing to put on the second, and a
	 * gap between them that no clef distance explains. One staff, then.
	 */
	function newRound() {
		var clefSet = randomOf(clefSetsFor(level));
		var ids = level.staffs.map(function (staff) { return staff.id; })
			.filter(function (id) { return !!clefSet[id]; });
		if (ids.length === 2 && clefSet[ids[0]] === clefSet[ids[1]])
			ids = [randomOf(ids)];

		round = { clefSet: clefSet, key: randomOf(level.keys), ids: ids, count: 0 };
		drawStaves();
	}

	function nextCard() {
		if (!level) return;
		clearTimers();
		if (!round || round.count >= CARDS_PER_CLEF) newRound();

		var usable = usableStaves();
		if (!usable.length) {
			card = null;
			render();
			setFeedback('', 'Turn a clef on to practise this level.');
			return;
		}

		var staffId = randomOf(usable);
		var clefId = round.clefSet[staffId];
		var entries = [];
		/* The picker can come back empty when a schema does not fit the
		 * level's range; the trainer draws a blank in that case, this tries
		 * again. */
		for (var attempt = 0; attempt < 8 && !entries.length; attempt++)
			entries = notation().pickNotes(level, clefId, round.key);
		if (!entries.length) {
			card = null;
			render();
			setFeedback('', 'This level has nothing to ask on that staff.');
			return;
		}

		round.count++;
		card = {
			staffId: staffId,
			clefId: clefId,
			entries: entries,
			sounds: entries.map(function (e) { return e.sound; }),
			shownAt: now(),
			wrong: false,
			judged: false,
			timer: null,
			stuckTimer: null
		};
		render();
	}

	/*
	 * Light up the key the card is asking for, if that option is on. It is the
	 * same switch the trainer follows, so a card and a scrolling note behave
	 * alike; each pane hints its own target and clears up after itself.
	 */
	function applyKeyHint() {
		var keyboard = window.HTP.keyboard;
		if (!keyboard || !keyboard.setHints) return;
		if (!window.HTP.settings.showKeyHint || !card) {
			keyboard.clearHints();
			return;
		}
		var hints = {};
		card.sounds.forEach(function (sound) { hints[sound] = { target: true }; });
		keyboard.setHints(hints);
	}

	function render() {
		STAFF_IDS.forEach(function (id) { staves[id].find('.htp-fc-note').remove(); });
		ghosts = {};
		nameEl.innerHTML = '';
		applyKeyHint();

		if (!card) {
			stavesEl.hidden = mode !== MODE_STAFF;
			nameEl.hidden = true;
			return;
		}

		if (mode === MODE_NAME) {
			stavesEl.hidden = true;
			nameEl.hidden = false;
			var names = card.entries.map(nameFor);
			nameEl.innerHTML = '<span class="htp-fc__nameval">' + names.join('&nbsp;&nbsp;') + '</span>'
				+ '<span class="htp-fc__namehint">'
				+ (names.length > 1 ? 'Play them together, without looking down' : 'Play it without looking down')
				+ '</span>';
			setFeedback('', names.length > 1 ? 'Find them on the keyboard.' : 'Find it on the keyboard.');
			return;
		}

		stavesEl.hidden = false;
		nameEl.hidden = true;

		var staff = staves[card.staffId];
		var symbol = $('<div class="symbol note visible htp-fc-note"></div>');
		var topLedgers = 0, bottomLedgers = 0;
		var shifts = [];
		card.entries.forEach(function (entry) {
			var built = notation().buildEntryGlyph(card.clefId, entry);
			if (!built) return;
			symbol.append(built.glyph);
			var ledgers = notation().ledgerLineCount(built.shift);
			topLedgers = Math.max(topLedgers, ledgers);
			bottomLedgers = Math.min(bottomLedgers, ledgers);
			shifts.push(built.shift);
		});
		/* The heads are all in, so they can agree on a stem direction. */
		notation().applyStems($('svg', symbol));
		notation().addLedgerLines(symbol, topLedgers);
		notation().addLedgerLines(symbol, bottomLedgers);
		staff.append(symbol);
		card.symbol = symbol;
		makeRoom(card.staffId, shifts);

		setFeedback('', card.entries.length > 1 ? 'Play them together.' : 'Play it.');
	}

	/*
	 * How a card names a note. The entry's decorator is the accidental the key
	 * signature left to print, so a note the key already sharpens or flattens
	 * comes back as "none" — it is spelled the key's way.
	 */
	function nameFor(entry) {
		var d = notation().decorators;
		var preference = entry.decorator === d.none ? round.key.decorator : entry.decorator;
		return notation().nameForSound(entry.sound, preference);
	}

	/* -------------------------------------------------------- the answer */

	/* Names with no octave number ask for any C, not this one. A card on the
	 * staff always shows its octave, so there it is the exact key. */
	function looseOctaves() {
		return mode === MODE_NAME && window.HTP.settings.octaveNumbers === false;
	}
	function matches(sound, target) {
		if (sound === target) return true;
		return looseOctaves() && ((sound % 12) + 12) % 12 === ((target % 12) + 12) % 12;
	}
	function isTarget(sound) {
		return card.sounds.some(function (t) { return matches(sound, t); });
	}
	/* All of a card's notes down at once — the trainer's rule for an interval
	 * or a chord. */
	function allTargetsHeld() {
		var down = Object.keys(held).map(Number);
		return card.sounds.every(function (t) {
			return down.some(function (s) { return matches(s, t); });
		});
	}
	function anyTargetHeld() {
		return Object.keys(held).map(Number).some(isTarget);
	}

	/*
	 * The note you actually played, drawn over the card on the staff — red for
	 * a miss, green for a hit — for as long as the key is down. The trainer's
	 * own "played" ghost, and its stylesheet: appended into the card's symbol,
	 * it lands right on the notehead it answers.
	 */
	function showGhost(sound, isCorrect) {
		hideGhost(sound);
		if (mode !== MODE_STAFF || !card || !card.symbol) return;
		var built = notation().buildNoteGlyph(card.clefId, sound);
		if (!built) return;

		var added = [];
		var ghost = built.glyph.addClass('played').addClass(isCorrect ? 'correct' : 'wrong').css('fill', '');
		card.symbol.append(ghost);
		added.push(ghost);

		/* Ledger lines, so a note just outside the staff is still readable.
		 * Capped, as the trainer caps them, so a note octaves away does not
		 * fill the staff with lines. */
		var extra = notation().ledgerLineCount(built.shift);
		if (extra > 3) extra = 3;
		if (extra < -3) extra = -3;
		if (extra) {
			var lines = $('<div></div>');
			notation().addLedgerLines(lines, extra);
			lines.children().each(function () {
				var line = $(this).addClass('played').addClass(isCorrect ? 'correct' : 'wrong');
				card.symbol.append(line);
				added.push(line);
			});
		}
		ghosts[sound] = added;
	}
	function hideGhost(sound) {
		if (!ghosts[sound]) return;
		ghosts[sound].forEach(function (el) { el.remove(); });
		delete ghosts[sound];
	}

	function setFeedback(kind, html) {
		feedbackEl.className = 'htp-fc__feedback' + (kind ? ' htp-fc__feedback--' + kind : '');
		feedbackEl.innerHTML = html;
	}

	function updateStats() {
		if (!stats) return;
		var answered = stats.correct + stats.wrong;
		var accuracy = answered ? Math.round(100 * stats.correct / answered) + '%' : '--';
		var pace = stats.timed ? (stats.timeSum / stats.timed / 1000).toFixed(1) + 's' : '--';
		statsEl.innerHTML =
			  '<span title="Cards answered">' + stats.correct + ' right</span>'
			+ '<span title="Wrong keys pressed">' + stats.wrong + ' wrong</span>'
			+ '<span title="Right answers over every key pressed, as the trainer counts it">' + accuracy + '</span>'
			+ '<span title="Average time to a right answer">' + pace + '</span>';
	}

	function succeed() {
		var latency = now() - card.shownAt;
		card.judged = true;
		stats.correct++;
		stats.timeSum += latency;
		stats.timed++;
		updateStats();

		var value = nameEl.querySelector('.htp-fc__nameval');
		if (value) value.classList.add('is-correct');
		setFeedback('good', 'Yes. <small>' + (latency / 1000).toFixed(1) + 's</small>');

		/* Hold the answer on screen while the key is down: the point of the
		 * green is to see the note you played confirmed where you read it. */
		if (anyTargetHeld()) {
			card.stuckTimer = window.setTimeout(function () { advance(0); }, STUCK_NOTE_MS);
			return;
		}
		advance(FEEDBACK_MS);
	}

	function advance(delay) {
		if (!card || card.timer) return;
		window.clearTimeout(card.stuckTimer);
		var mine = card;
		mine.timer = window.setTimeout(function () {
			if (card === mine) nextCard();
		}, delay);
	}

	function clearTimers() {
		if (!card) return;
		window.clearTimeout(card.timer);
		window.clearTimeout(card.stuckTimer);
		card.timer = null;
		card.stuckTimer = null;
	}

	/* The keys that answered the card are done with, whether or not their
	 * key-ups ever arrive. */
	function forgetAnswer() {
		if (!card) return;
		card.sounds.forEach(function (s) { delete held[s]; });
		Object.keys(ghosts).forEach(function (s) { hideGhost(Number(s)); });
	}

	function onNoteOn(sound) {
		if (!card) return;

		if (card.judged) {
			/* Still waiting for you to let go of a right answer and you have
			 * played something else: you have moved on, so move on with you.
			 * This is also what heals a lost note-off. */
			if (!isTarget(sound)) {
				forgetAnswer();
				advance(0);
			}
			return;
		}

		var hit = isTarget(sound);
		showGhost(sound, hit);
		if (!hit) {
			stats.wrong++;
			card.wrong = true;
			updateStats();
			setFeedback('bad', 'You played <b>' + notation().nameForSound(sound) + '</b>.'
				+ (mode === MODE_NAME ? ' Try again.' : ''));
			return;
		}
		if (allTargetsHeld()) succeed();
		else setFeedback('', 'Good — and the rest, together.');
	}

	function onNoteOff(sound) {
		hideGhost(sound);
		if (card && card.judged && !anyTargetHeld()) advance(RELEASE_MS);
	}

	/* ---------------------------------------------------------- lifecycle */

	window.HTP.register({
		id: 'flash-cards',
		title: 'Flash cards',
		description: 'One note at a time, nothing moving: read it and play it — drawn on the staff, or named for you to find.',

		init: function (el, api) {
			buildUI(el);
			setMode(readStored(STORAGE_MODE, MODE_STAFF));
			setLevel(readStored(STORAGE_LEVEL, Object.keys(notation().levels)[0]));

			api.onSettingChange(function (key) {
				if (key === 'showKeyHint') applyKeyHint();
				if (key === 'lineMarkers' || key.indexOf('landmark') === 0
					|| key.indexOf('legend') === 0 || key === 'colourNotes'
					|| key === 'musicalClefDistance' || key === 'staffSize'
					|| key === 'quarterNotes' || key === 'octaveNumbers') {
					drawStaves();
					render();
				}
				if (key.indexOf('showClef') === 0) {
					/* The clefs on now decide which clef sets a level can use
					 * at all, not just which staff is visible — so this is a
					 * new round, not a card whose staff quietly went away.
					 * Throw it out and ask again, the way a level change
					 * does, short of resetting the stats: nextCard() rebuilds
					 * the round from the clefs now on and redraws. */
					round = null;
					forgetAnswer();
					nextCard();
				}
			});
			api.onMarkersChanged(function () {
				if (round) drawStaves();
			});
		},

		onShow: function (el, api) {
			/* Everything beside the clef is placed from its measured width,
			 * which was 0 while the pane was hidden. */
			if (round) drawStaves();
			if (!card) nextCard();
			else render();
			if (noLabelsEl) noLabelsEl.checked = document.body.classList.contains('htp-nolabels');
			if (unsubscribe) return;
			unsubscribe = api.midi.subscribe(function (bytes) {
				var type = bytes[0] & 0xf0;
				/* `held` is updated BEFORE the handler runs, so succeed() can
				 * see whether the key answering the card is still down. */
				if (type === 0x90 && bytes[2] > 0) {
					held[bytes[1]] = true;
					onNoteOn(bytes[1]);
				} else if (type === 0x80 || (type === 0x90 && bytes[2] === 0)) {
					delete held[bytes[1]];
					onNoteOff(bytes[1]);
				}
			});
		},

		onHide: function () {
			if (unsubscribe) { unsubscribe(); unsubscribe = null; }
			/* The hints are this tab's; left on the keys they would follow you
			 * into the next one and read as part of its exercise. */
			if (window.HTP.keyboard && window.HTP.keyboard.clearHints)
				window.HTP.keyboard.clearHints();
			/* Key-ups while the pane is hidden never reach us, so a note held
			 * at the moment you switched away would look held forever. A card
			 * already answered is finished with. */
			held = {};
			clearTimers();
			if (card && card.judged) card = null;
		},

		onResize: function () {
			if (round) drawStaves();
			render();
		}
	});
})(window, document);
