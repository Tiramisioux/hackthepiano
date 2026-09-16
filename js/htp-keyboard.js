/*
 * htp-keyboard.js — piano keyboard drawer pinned to the bottom of the screen.
 * It is app chrome, not a pane module: it stays available whatever module is up.
 *
 * It does three jobs:
 *   - plays notes (mouse / touch / computer keyboard) through HTP.midi, which the
 *     note trainer receives exactly as if they came from a real piano;
 *   - lights up keys pressed on real MIDI hardware, via the HTP.midi bus tap;
 *   - collapses and expands drawer-style, remembering its state.
 *
 * Key geometry follows an acoustic piano: a black key is 0.583 of a white key's
 * width and 0.64 of its length (≈13.7mm/23.5mm and ≈95mm/148mm).
 *
 * Range: MIDI 21 (A0) .. 108 (C8) == js/code.js keyIndex 0..87 (getSound).
 */
(function (window, document) {
	'use strict';

	/* Width steps: start at the C4 octave, then widen downwards, then both ways. */
	var RANGES = [
		{ label: 'C4',      low: 60,  high: 71  },   /* 1 octave   */
		{ label: 'C2–B4',   low: 36,  high: 71  },   /* 3 octaves  */
		{ label: 'C1–B5',   low: 24,  high: 83  },   /* 5 octaves  */
		{ label: '88 keys', low: 21,  high: 108 }    /* full piano */
	];
	var DEFAULT_RANGE = 1;

	/* The black-key width is a ratio of the white-key width, but it lives in
	 * css/htp.css as --htp-black-key-ratio so a media query can narrow it on a
	 * phone, where a full-width black key leaves too little white key to hit.
	 * JS publishes the white-key width; CSS does the multiplication. */
	var MAX_WHITE_KEY_PX = 58;          /* keep few-key ranges sane  */
	/* Below this a white key is too narrow to aim at, so instead of shrinking
	 * further the keyboard overflows and you scroll it to the part you want. */
	var MIN_WHITE_KEY_PX = 30;

	var STORAGE_OPEN = 'htp.keyboard.open';
	var STORAGE_RANGE = 'htp.keyboard.range';
	var BLACK_PITCH_CLASSES = { 1: true, 3: true, 6: true, 8: true, 10: true };
	var NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
	/* The function keys, at absolute pitches — A0 to G#1. Drawn in their own
	 * strip rather than left to the main keyboard, because the main keyboard only
	 * draws the range you have chosen and these have to be reachable from all of
	 * them. A real piano sends these notes whatever is on screen; this is how the
	 * on-screen one keeps up. */
	var FN_LOW = 21, FN_HIGH = 32;

	/* Computer-keyboard mapping, semitone offsets from the base octave's C. */
	var KEY_MAP = {
		a: 0,  w: 1,  s: 2,  e: 3,  d: 4,  f: 5,  t: 6,
		g: 7,  y: 8,  h: 9,  u: 10, j: 11, k: 12, o: 13,
		l: 14, p: 15, ';': 16
	};

	var keyElements = {};          /* midi note -> element           */
	/* A scale, chord or exercise a module wants shown ON the keys:
	 *   {midiNote: {rh: finger, lh: finger}}
	 * Kept here rather than written into the DOM by the module, because the keys
	 * are rebuilt from scratch on every range and octave change — anything drawn
	 * from outside would silently vanish the first time you moved the keyboard. */
	var keyHints = null;
	/* Told when the visible span changes, so a module drawing something ONTO the
	 * keys can re-place it — the scales tab puts its two hands in the outermost
	 * octaves of whatever is on screen. */
	var rangeListeners = [];
	var activeNotes = {};          /* midi note -> refcount          */
	/* pointerId -> the note that pointer is currently holding. A map rather than
	 * a single value because a touchscreen has as many pointers as fingers, and
	 * a chord played with three of them is three simultaneous pointer streams. */
	var pointerNotes = {};
	var computerHeld = {};
	var baseNote = 60;             /* C4, base of the computer octave */
	var rangeIndex = DEFAULT_RANGE;
	var drawer, keysEl, keysScroller, fnKeysEl, statusEl, octaveLabel, rangeLabel;

	function isBlack(note) {
		return !!BLACK_PITCH_CLASSES[((note % 12) + 12) % 12];
	}

	function noteName(note) {
		return NOTE_NAMES[((note % 12) + 12) % 12] + (Math.floor(note / 12) - 1);
	}

	function readStored(key, fallback) {
		try {
			var v = window.localStorage.getItem(key);
			return v === null ? fallback : v;
		} catch (e) {
			return fallback;
		}
	}

	function writeStored(key, value) {
		try { window.localStorage.setItem(key, String(value)); }
		catch (e) { /* non-fatal */ }
	}

	/* ------------------------------------------------------------ key layout */

	function buildKeys() {
		var range = RANGES[rangeIndex];
		keysEl.innerHTML = '';
		keyElements = {};
		releaseAllPointers();
		activeNotes = {};

		var whiteNotes = [];
		var note;
		for (note = range.low; note <= range.high; note++)
			if (!isBlack(note)) whiteNotes.push(note);

		var whiteCount = whiteNotes.length;
		var whiteWidth = 100 / whiteCount;           /* percent */

		/* Cap how wide a single key can get, and how narrow before scrolling. */
		keysEl.style.maxWidth = (whiteCount * MAX_WHITE_KEY_PX) + 'px';
		keysEl.style.minWidth = (whiteCount * MIN_WHITE_KEY_PX) + 'px';
		keysEl.style.setProperty('--htp-white-key-width', whiteWidth + '%');

		/* White keys first so the black ones stack above them. */
		whiteNotes.forEach(function (n, index) {
			var el = document.createElement('div');
			el.className = 'htp-key htp-key--white';
			el.setAttribute('data-note', String(n));
			el.style.left = (index * whiteWidth) + '%';
			var text = labelFor(n);
			if (text) {
				var label = document.createElement('span');
				label.className = 'htp-key__label';
				label.textContent = text;
				el.appendChild(label);
			}
			keysEl.appendChild(el);
			keyElements[n] = el;
		});

		/* Black keys sit on the seam after their preceding white key; CSS centres
		 * them on it with a translate, so their width can change without JS
		 * having to recompute any offsets. */
		var whiteIndex = 0;
		for (note = range.low; note <= range.high; note++) {
			if (!isBlack(note)) { whiteIndex++; continue; }
			var el = document.createElement('div');
			el.className = 'htp-key htp-key--black';
			el.setAttribute('data-note', String(note));
			el.style.left = (whiteIndex * whiteWidth) + '%';
			keysEl.appendChild(el);
			keyElements[note] = el;
		}
	}

	/*
	 * Which keys carry a printed name. C is always labelled — it is the anchor
	 * you count from. With the "Key names" option on, F and G are labelled the
	 * same way (F1, G1, ...), each following its own landmark switch.
	 */
	function labelFor(note) {
		var pitchClass = ((note % 12) + 12) % 12;
		if (pitchClass === 0) return noteName(note);
		if (!window.HTP.settings.keyNames) return null;
		if (pitchClass !== 5 && pitchClass !== 7) return null;
		return window.HTP.landmarkEnabled(pitchClass === 5 ? 'F' : 'G') ? noteName(note) : null;
	}

	/* Put middle C in view after a rebuild. A wide range is wider than the pane
	 * now, and opening on the bottom octaves of an 88-key board — nowhere near
	 * where anybody plays — would just mean scrolling every time. */
	function scrollToMiddle() {
		if (!keysScroller || !keyElements[60]) return;
		var key = keyElements[60];
		var target = key.offsetLeft - (keysScroller.clientWidth / 2) + (key.offsetWidth / 2);
		keysScroller.scrollLeft = Math.max(0, target);
	}

	function setRange(index) {
		rangeIndex = Math.max(0, Math.min(RANGES.length - 1, index));
		writeStored(STORAGE_RANGE, rangeIndex);
		buildKeys();
		applyKeyColours();
		applyKeyHints();
		clampBaseNote();
		updateRangeLabel();
		updateOctaveLabel();
		scrollToMiddle();
		rangeListeners.slice().forEach(function (fn) {
			try { fn(RANGES[rangeIndex]); }
			catch (e) { console.error('[HTP] keyboard range listener failed', e); }
		});
	}

	/* Tint the C, F and G keys to match the staff line markers. */
	function applyKeyColours() {
		var on = !!window.HTP.settings.colourKeys;
		Object.keys(keyElements).forEach(function (key) {
			var el = keyElements[key];
			el.classList.remove('is-landmark');
			el.style.removeProperty('--htp-key-tint');
			el.style.removeProperty('--htp-key-tint-soft');
			if (!on) return;
			var note = parseInt(key, 10);
			var landmark = window.HTP.landmarkForPitchClass(((note % 12) + 12) % 12,
				Math.floor(note / 12) - 1);
			if (!landmark) return;
			el.style.setProperty('--htp-key-tint', landmark.colour);
			/* A lightened version of the same colour, so pressing a landmark key
			 * highlights in its own hue instead of the generic blue. */
			el.style.setProperty('--htp-key-tint-soft', window.HTP.shade(landmark.colour, 0.55));
			el.classList.add('is-landmark');
		});
	}

	/*
	 * Draw the current hint set onto the keys: a tint, and the fingering for
	 * whichever hand plays that note. A key used by both hands — the note where
	 * the two octaves meet — carries both numbers, right hand above left, which
	 * is how they sit on the instrument.
	 */
	function finger(number, hand) {
		var el = document.createElement('b');
		el.className = 'htp-key__finger htp-key__finger--' + hand
			+ (number === 1 ? ' is-thumb' : '');
		el.textContent = number;
		return el;
	}

	function applyKeyHints() {
		Object.keys(keyElements).forEach(function (key) {
			var el = keyElements[key];
			var existing = el.querySelector('.htp-key__hint');
			if (existing) el.removeChild(existing);
			el.classList.remove('is-hinted');

			var hint = keyHints && keyHints[key];
			if (!hint) return;

			el.classList.add('is-hinted');
			var box = document.createElement('span');
			box.className = 'htp-key__hint';
			/* The thumb is drawn larger than the other fingers. In scale playing it
			 * is the one that matters: every thumb mark is a place the hand has to
			 * pass over or under, so being able to pick them out at a glance is
			 * the difference between reading fingering and using it. */
			if (hint.rh) box.appendChild(finger(hint.rh, 'rh'));
			if (hint.lh) box.appendChild(finger(hint.lh, 'lh'));
			el.appendChild(box);
		});
	}

	function updateRangeLabel() {
		if (rangeLabel) rangeLabel.textContent = RANGES[rangeIndex].label;
	}

	/* ------------------------------------------------------------- building */

	function build() {
		drawer = document.createElement('div');
		drawer.className = 'htp-keyboard';
		drawer.id = 'htpKeyboard';

		var bar = document.createElement('div');
		bar.className = 'htp-keyboard__bar';

		var toggle = document.createElement('button');
		toggle.type = 'button';
		toggle.className = 'htp-keyboard__toggle';
		toggle.setAttribute('aria-controls', 'htpKeyboardBody');
		toggle.innerHTML = '<span class="htp-keyboard__chevron" aria-hidden="true"></span>'
			+ '<span class="htp-keyboard__toggle-label">Keyboard</span>';
		toggle.addEventListener('click', function () { setOpen(!isOpen()); });

		var rangeControls = document.createElement('div');
		rangeControls.className = 'htp-keyboard__group';
		rangeControls.innerHTML =
			  '<span class="htp-keyboard__grouplabel">Range</span>'
			+ '<button type="button" class="htp-keyboard__btn" data-range="-1" title="Narrower">&minus;</button>'
			+ '<span class="htp-keyboard__value" id="htpRangeLabel"></span>'
			+ '<button type="button" class="htp-keyboard__btn" data-range="1" title="Wider">+</button>';
		rangeControls.addEventListener('click', function (e) {
			var delta = e.target && e.target.getAttribute('data-range');
			if (delta) setRange(rangeIndex + parseInt(delta, 10));
		});

		var octaveControls = document.createElement('div');
		octaveControls.className = 'htp-keyboard__group';
		octaveControls.innerHTML =
			  '<span class="htp-keyboard__grouplabel">Keys</span>'
			+ '<button type="button" class="htp-keyboard__btn" data-delta="-12" title="Octave down (z)">&minus;</button>'
			+ '<span class="htp-keyboard__value" id="htpOctaveLabel">C4</span>'
			+ '<button type="button" class="htp-keyboard__btn" data-delta="12" title="Octave up (x)">+</button>';
		octaveControls.addEventListener('click', function (e) {
			var delta = e.target && e.target.getAttribute('data-delta');
			if (delta) shiftOctave(parseInt(delta, 10));
		});

		statusEl = document.createElement('span');
		statusEl.className = 'htp-keyboard__status';

		bar.appendChild(toggle);
		bar.appendChild(rangeControls);
		bar.appendChild(octaveControls);
		bar.appendChild(statusEl);

		var body = document.createElement('div');
		body.className = 'htp-keyboard__body';
		body.id = 'htpKeyboardBody';

		fnKeysEl = document.createElement('div');
		fnKeysEl.className = 'htp-fnkeys';
		fnKeysEl.title = 'Function keys — hold one to name a key, then play a chord';
		for (var fnNote = FN_LOW; fnNote <= FN_HIGH; fnNote++) {
			var fnKeyEl = document.createElement('button');
			fnKeyEl.type = 'button';
			fnKeyEl.className = 'htp-fnkey htp-key'
				+ (isBlack(fnNote) ? ' htp-fnkey--black' : '');
			fnKeyEl.setAttribute('data-note', String(fnNote));
			fnKeyEl.textContent = NOTE_NAMES[((fnNote % 12) + 12) % 12].replace('#', '\u266f');
			fnKeysEl.appendChild(fnKeyEl);
		}
		body.appendChild(fnKeysEl);

		var scroller = document.createElement('div');
		scroller.className = 'htp-keyboard__scroller';

		keysEl = document.createElement('div');
		keysEl.className = 'htp-keys';
		scroller.appendChild(keysEl);
		body.appendChild(scroller);
		keysScroller = scroller;

		drawer.appendChild(bar);
		drawer.appendChild(body);
		document.body.appendChild(drawer);

		octaveLabel = document.getElementById('htpOctaveLabel');
		rangeLabel = document.getElementById('htpRangeLabel');

		rangeIndex = parseInt(readStored(STORAGE_RANGE, DEFAULT_RANGE), 10);
		if (isNaN(rangeIndex)) rangeIndex = DEFAULT_RANGE;
		setRange(rangeIndex);

		bindPointer(keysEl);
		bindPointer(fnKeysEl);
		bindComputerKeyboard();
		setOpen(readStored(STORAGE_OPEN, '1') === '1');
	}

	/* -------------------------------------------------------- note plumbing */

	function highlight(note, on) {
		/* Both surfaces: the key in the main keyboard if that range draws it, and
		 * the function strip if the note is one of its twelve. A function key is
		 * often the only one of the two on screen, and holding it with no feedback
		 * at all reads as the press not registering. */
		var targets = [];
		if (keyElements[note]) targets.push(keyElements[note]);
		if (fnKeysEl) {
			var fn = fnKeysEl.querySelector('[data-note="' + note + '"]');
			if (fn) targets.push(fn);
		}
		if (!targets.length) return;           /* outside every visible surface */

		if (on) {
			activeNotes[note] = (activeNotes[note] || 0) + 1;
			targets.forEach(function (el) { el.classList.add('is-active'); });
		} else {
			activeNotes[note] = Math.max(0, (activeNotes[note] || 0) - 1);
			if (!activeNotes[note])
				targets.forEach(function (el) { el.classList.remove('is-active'); });
		}
	}

	function play(note) {
		if (note < 21 || note > 108) return;
		window.HTP.midi.noteOn(note, 0x64);
	}

	function release(note) {
		if (note < 21 || note > 108) return;
		window.HTP.midi.noteOff(note);
	}

	/* --------------------------------------------------------------- input */

	function noteFromEvent(e) {
		var el = e.target;
		while (el && el !== keysEl) {
			var n = el.getAttribute && el.getAttribute('data-note');
			if (n) return parseInt(n, 10);
			el = el.parentNode;
		}
		return null;
	}

	/* Let go of every finger at once — for losing the window, or rebuilding the
	 * keys under whatever is still held. */
	function releaseAllPointers() {
		Object.keys(pointerNotes).forEach(function (id) {
			release(pointerNotes[id]);
			delete pointerNotes[id];
		});
	}

	function bindPointer(el) {
		el.addEventListener('pointerdown', function (e) {
			var note = noteFromEvent(e);
			if (note === null) return;
			e.preventDefault();

			pointerNotes[e.pointerId] = note;
			play(note);

			/* Captured per pointer, so each finger keeps sending to us even once
			 * it slides off the key it started on. */
			if (el.setPointerCapture) {
				try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
			}
		});

		el.addEventListener('pointermove', function (e) {
			var held = pointerNotes[e.pointerId];
			if (held === undefined) return;

			/* Pointer capture retargets events to keysEl, so hit-test manually. */
			var under = document.elementFromPoint(e.clientX, e.clientY);
			var raw = under && under.getAttribute && under.getAttribute('data-note');
			if (raw === null || raw === undefined) return;

			var note = parseInt(raw, 10);
			if (note !== held) {
				/* Slide one finger along the keys and it plays them in turn,
				 * without disturbing any other finger. */
				release(held);
				pointerNotes[e.pointerId] = note;
				play(note);
			}
		});

		function endPointer(e) {
			var held = pointerNotes[e.pointerId];
			if (held === undefined) return;

			release(held);
			delete pointerNotes[e.pointerId];
			if (el.releasePointerCapture) {
				try { el.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
			}
		}
		el.addEventListener('pointerup', endPointer);
		el.addEventListener('pointercancel', endPointer);
		window.addEventListener('blur', releaseAllPointers);
	}

	function isTypingTarget(el) {
		if (!el) return false;
		var tag = el.tagName;
		return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
	}

	function bindComputerKeyboard() {
		document.addEventListener('keydown', function (e) {
			if (e.metaKey || e.ctrlKey || e.altKey) return;
			if (isTypingTarget(e.target)) return;

			var key = (e.key || '').toLowerCase();
			if (key === 'z') { shiftOctave(-12); e.preventDefault(); return; }
			if (key === 'x') { shiftOctave(12);  e.preventDefault(); return; }

			if (!(key in KEY_MAP) || computerHeld[key] !== undefined) return;
			var note = baseNote + KEY_MAP[key];
			computerHeld[key] = note;
			play(note);
			e.preventDefault();
		});

		document.addEventListener('keyup', function (e) {
			var key = (e.key || '').toLowerCase();
			if (computerHeld[key] === undefined) return;
			release(computerHeld[key]);
			delete computerHeld[key];
		});

		/* Alt-tabbing away must not leave notes stuck on. */
		window.addEventListener('blur', function () {
			Object.keys(computerHeld).forEach(function (key) {
				release(computerHeld[key]);
				delete computerHeld[key];
			});
		});
	}

	/* Keep the computer-keyboard octave inside the visible range. */
	function clampBaseNote() {
		var range = RANGES[rangeIndex];
		var lowestC = Math.ceil(range.low / 12) * 12;
		var highestC = Math.floor((range.high - 11) / 12) * 12;
		if (highestC < lowestC) highestC = lowestC;
		baseNote = Math.max(lowestC, Math.min(highestC, baseNote));
	}

	function shiftOctave(delta) {
		var before = baseNote;
		baseNote = baseNote + delta;
		clampBaseNote();
		if (baseNote !== before) updateOctaveLabel();
	}

	function updateOctaveLabel() {
		if (octaveLabel) octaveLabel.textContent = noteName(baseNote);
	}

	/* --------------------------------------------------------------- drawer */

	function isOpen() {
		return drawer.getAttribute('data-open') === 'true';
	}

	function setOpen(open) {
		drawer.setAttribute('data-open', open ? 'true' : 'false');
		drawer.querySelector('.htp-keyboard__toggle')
			.setAttribute('aria-expanded', open ? 'true' : 'false');
		document.body.classList.toggle('htp-keyboard-open', open);
		writeStored(STORAGE_OPEN, open ? '1' : '0');
	}

	/* --------------------------------------------------------------- status */

	function updateStatus() {
		var state = window.HTP.midi.state;
		if (state.hardwareInputs.length)
			statusEl.textContent = 'MIDI: ' + state.hardwareInputs.join(', ');
		else if (!state.supported)
			statusEl.textContent = 'No Web MIDI in this browser — on-screen keys only';
		else if (state.error)
			/* Permission refused is the common one, and silently falling back to
			 * the on-screen keys reads as "the piano is broken". Say so. */
			statusEl.textContent = 'MIDI blocked: ' + state.error;
		else
			statusEl.textContent = 'No MIDI device — play with mouse or keys A–J';
	}

	/* ----------------------------------------------------------------- boot */

	$(function () {
		build();

		/* Light up keys for everything, on-screen and real hardware alike. */
		window.HTP.midi.subscribe(function (bytes) {
			var type = bytes[0] & 0xf0;
			if (type === 0x90) highlight(bytes[1], bytes[2] > 0);
			else if (type === 0x80) highlight(bytes[1], false);
		});

		window.HTP.onSettingChange(function (key) {
			/* colourKeys is the master switch; landmarkC/F/G pick which of them
			 * are drawn, on the keys and on the staff alike. */
			if (key === 'keyNames' || key.indexOf('landmark') === 0) {
				buildKeys();          /* labels are baked in at build time */
				applyKeyHints();
			}
			if (key === 'colourKeys' || key === 'keyNames' || key.indexOf('landmark') === 0)
				applyKeyColours();
		});

		/* The device list is not fixed at load — Bluetooth pianos connect late
		 * and cables come and go — so track it rather than sampling it once. */
		window.HTP.midi.onPortChange(updateStatus);

		/* js/code.js requests MIDI access on ready; give it a tick to resolve. */
		window.setTimeout(updateStatus, 600);
	});

	window.HTP.keyboard = {
		open: function () { setOpen(true); },
		close: function () { setOpen(false); },
		toggle: function () { setOpen(!isOpen()); },
		isOpen: isOpen,
		play: play,
		release: release,
		ranges: RANGES,
		setRange: setRange,
		range: function () { return rangeIndex; },
		setBaseNote: function (n) { baseNote = n; clampBaseNote(); updateOctaveLabel(); },
		/*
		 * Show a scale, chord or exercise on the keys.
		 *   HTP.keyboard.setHints({60: {rh: 1}, 48: {lh: 5}})
		 * Pass null to clear. Survives range and octave changes.
		 */
		setHints: function (map) { keyHints = map || null; applyKeyHints(); },
		clearHints: function () { keyHints = null; applyKeyHints(); },
		/* The lowest and highest note currently drawn, so a caller can tell
		 * whether what it is hinting is actually on screen. */
		visibleRange: function () {
			return { low: RANGES[rangeIndex].low, high: RANGES[rangeIndex].high };
		},
		onRangeChange: function (fn) { rangeListeners.push(fn); }
	};
})(window, document);
