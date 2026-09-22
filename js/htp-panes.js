/*
 * htp-panes.js — turns registered modules into tabbed / split panes.
 *
 * MUST be the last script in index.html. jQuery runs ready handlers in
 * registration order, so by loading after js/code.js we guarantee the note
 * trainer has already measured its staff widths while its pane was still
 * visible. Hiding panes before that would make js/code.js read width() === 0
 * and place the first notes at the wrong x position.
 *
 * Layout model:
 *   single  — exactly one pane visible; tabs behave as tabs.
 *   split   — up to two panes visible, stacked vertically; tabs behave as
 *             toggles. Selecting a third pane drops the least recently added.
 *
 * The active module id is mirrored into location.hash so a pane is linkable.
 */
(function (window, document) {
	'use strict';

	var MAX_SPLIT_PANES = 2;
	var STORAGE_KEY = 'htp.panes.layout';

	var panesEl, tabsEl, splitButton;
	var visible = [];      /* module ids, oldest first */
	var layout = 'single';

	/* ------------------------------------------------------------- building */

	function ensurePane(module) {
		var existing = panesEl.querySelector('[data-module="' + module.id + '"]');
		if (existing) {
			module.root = existing;
			return existing;
		}
		var section = document.createElement('section');
		section.className = 'htp-pane';
		section.setAttribute('data-module', module.id);
		section.setAttribute('role', 'tabpanel');
		section.setAttribute('aria-label', module.title);
		panesEl.appendChild(section);
		module.root = section;
		return section;
	}

	function buildTabs(modules) {
		tabsEl.innerHTML = '';
		modules.forEach(function (module) {
			var tab = document.createElement('button');
			tab.type = 'button';
			tab.className = 'htp-tab';
			tab.setAttribute('data-module', module.id);
			tab.setAttribute('role', 'tab');
			if (module.description) tab.title = module.description;
			tab.textContent = module.title;
			tab.addEventListener('click', function () { selectModule(module.id); });
			tabsEl.appendChild(tab);
		});
	}

	/* ------------------------------------------------------------ lifecycle */

	function initialise(module) {
		if (module.initialised) return;
		module.initialised = true;
		if (typeof module.init === 'function') {
			try { module.init(module.root, window.HTP); }
			catch (e) { console.error('[HTP] module "' + module.id + '" failed to init', e); }
		}
	}

	function fire(module, hook) {
		if (typeof module[hook] !== 'function') return;
		try { module[hook](module.root, window.HTP); }
		catch (e) { console.error('[HTP] module "' + module.id + '" ' + hook + ' failed', e); }
	}

	/* -------------------------------------------------------------- display */

	function applyVisibility() {
		window.HTP.modules().forEach(function (module) {
			if (!module.root) return;
			var shouldShow = visible.indexOf(module.id) !== -1;
			var isShown = module.root.classList.contains('is-visible');
			if (shouldShow === isShown) return;

			if (shouldShow) {
				initialise(module);
				module.root.classList.add('is-visible');
				fire(module, 'onShow');
				fire(module, 'onResize');
			} else {
				module.root.classList.remove('is-visible');
				fire(module, 'onHide');
			}
		});

		Array.prototype.forEach.call(tabsEl.querySelectorAll('.htp-tab'), function (tab) {
			var on = visible.indexOf(tab.getAttribute('data-module')) !== -1;
			tab.classList.toggle('is-active', on);
			tab.setAttribute('aria-selected', on ? 'true' : 'false');
		});

		panesEl.setAttribute('data-layout', layout);
		panesEl.setAttribute('data-visible-count', String(visible.length));
	}

	function selectModule(id) {
		if (layout === 'single') {
			visible = [id];
		} else {
			var at = visible.indexOf(id);
			if (at !== -1) {
				/* Never leave the split empty. */
				if (visible.length > 1) visible.splice(at, 1);
			} else {
				visible.push(id);
				while (visible.length > MAX_SPLIT_PANES) visible.shift();
			}
		}
		applyVisibility();
		syncHash();
	}

	function setLayout(next) {
		layout = next === 'split' ? 'split' : 'single';
		if (layout === 'single') {
			visible = visible.slice(-1);
		} else if (visible.length < MAX_SPLIT_PANES) {
			/* Entering split: bring in the next module that is not already up. */
			window.HTP.modules().some(function (module) {
				if (visible.indexOf(module.id) !== -1) return false;
				visible.push(module.id);
				return true;
			});
		}
		if (splitButton) {
			splitButton.classList.toggle('is-active', layout === 'split');
			splitButton.setAttribute('aria-pressed', layout === 'split' ? 'true' : 'false');
		}
		try { window.localStorage.setItem(STORAGE_KEY, layout); } catch (e) { /* non-fatal */ }
		applyVisibility();
	}

	function syncHash() {
		if (!visible.length) return;
		var next = '#' + visible[visible.length - 1];
		if (window.location.hash !== next) {
			/* replaceState keeps the back button usable for real navigation. */
			if (window.history && window.history.replaceState)
				window.history.replaceState(null, '', next);
			else
				window.location.hash = next;
		}
	}

	function readStoredLayout() {
		try { return window.localStorage.getItem(STORAGE_KEY) === 'split' ? 'split' : 'single'; }
		catch (e) { return 'single'; }
	}

	/* --------------------------------------------------------------- options */

	/*
	 * The option controls are app chrome, not trainer chrome: they drive the
	 * staff markings, the notation size and the keyboard, so they live here and
	 * keep their state as you move between panes.
	 *
	 * Each checkbox is bound to one HTP setting, plus the js/code.js function
	 * that re-renders after it changes. js/code.js publishes those as
	 * HTP.applyStaffSpacing / HTP.applyLineMarkers once it has run.
	 *
	 * optShowClefTreble and optShowClefBass are missing from this list on
	 * purpose: the options bar promises at least one clef stays on, which the
	 * generic one-checkbox-one-setting binding below can't enforce. They are
	 * bound by bindClefChoice() instead.
	 */
	var OPTIONS = [
		{ id: 'optMusicalClefDistance', setting: 'musicalClefDistance', apply: 'applyStaffSpacing' },
		{ id: 'optShowNoteNames',       setting: 'showNoteNames',       apply: null },
		{ id: 'optLineMarkers',         setting: 'lineMarkers',         apply: 'applyLineMarkers' },
		{ id: 'optColourKeys',          setting: 'colourKeys',          apply: null },
		{ id: 'optColourNotes',         setting: 'colourNotes',         apply: 'applyNoteColours' },
		{ id: 'optQuarterNotes',        setting: 'quarterNotes',        apply: 'applyNoteShape' },
		{ id: 'optPianoSound',          setting: 'pianoSound',          apply: null },
		{ id: 'optKeyNames',            setting: 'keyNames',            apply: null },
		{ id: 'optShowFnKeys',          setting: 'showFnKeys',          apply: null },
		{ id: 'optOctaveNumbers',       setting: 'octaveNumbers',       apply: null },
		{ id: 'optLandmarkC',           setting: 'landmarkC',           apply: 'applyLineMarkers' },
		{ id: 'optLandmarkF',           setting: 'landmarkF',           apply: 'applyLineMarkers' },
		{ id: 'optLandmarkG',           setting: 'landmarkG',           apply: 'applyLineMarkers' },
		{ id: 'optLegendLines',         setting: 'legendLines',         apply: 'applyLineMarkers' },
		{ id: 'optLegendSpaces',        setting: 'legendSpaces',        apply: 'applyLineMarkers' },
		{ id: 'optShowKeyHint',         setting: 'showKeyHint',         apply: null },
		/* Handled locally below, alongside staffSize and scrollSpeed — it is
		 * app chrome (the <html> theme attribute), not something js/code.js
		 * re-renders. */
		{ id: 'optNightMode',           setting: 'nightMode',           apply: null }
	];

	/* Settings that also change how notes already on a staff are drawn, so the
	 * change shows on the notes already up rather than only on the next ones. */
	var RECOLOUR_ON = ['colourNotes', 'landmarkC', 'landmarkF', 'landmarkG'];

	var OPTIONS_OPEN_KEY = 'htp.options.open';

	/* The options are a drawer: open by default, and collapsed they give the
	 * whole row back to the staff. The handle lives in the tab bar, so hiding
	 * them costs no height of its own. */
	function setOptionsOpen(open) {
		var bar = document.getElementById('htpOptionsBar');
		var toggle = document.getElementById('htpOptionsToggle');
		if (bar) bar.setAttribute('data-open', open ? 'true' : 'false');
		if (toggle) {
			toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
			toggle.classList.toggle('is-active', open);
		}
		try { window.localStorage.setItem(OPTIONS_OPEN_KEY, open ? '1' : '0'); }
		catch (e) { /* non-fatal */ }
	}

	function optionsAreOpen() {
		var bar = document.getElementById('htpOptionsBar');
		return !bar || bar.getAttribute('data-open') !== 'false';
	}

	function readStoredOptionsOpen() {
		try {
			var stored = window.localStorage.getItem(OPTIONS_OPEN_KEY);
			return stored === null ? true : stored === '1';
		} catch (e) {
			return true;
		}
	}

	/* ----------------------------------------------------------- full screen */

	/*
	 * Fullscreen has to be asked for from a real user gesture, so this only ever
	 * runs from the button's own click handler. Prefixed names are still needed
	 * for Safari.
	 */
	/*
	 * WebKit has shipped three spellings of this API over the years and Safari
	 * still answers to the older ones, so try each in turn rather than assuming
	 * the unprefixed names exist.
	 */
	function fullscreenElement() {
		return document.fullscreenElement
			|| document.webkitFullscreenElement
			|| document.webkitCurrentFullScreenElement
			|| null;
	}

	/* Launched from the Home Screen (iOS) or installed as an app (everywhere
	 * else), which means there is no browser chrome to escape from. */
	function isStandalone() {
		return !!(window.navigator.standalone
			|| (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches));
	}

	function fullscreenSupported() {
		var root = document.documentElement;
		return !!(root.requestFullscreen || root.webkitRequestFullscreen
			|| root.webkitRequestFullScreen);
	}

	function toggleFullscreen() {
		if (fullscreenElement()) {
			var exit = document.exitFullscreen
				|| document.webkitExitFullscreen
				|| document.webkitCancelFullScreen;
			if (exit) exit.call(document);
			return;
		}

		var root = document.documentElement;
		var request = root.requestFullscreen
			|| root.webkitRequestFullscreen
			|| root.webkitRequestFullScreen;
		if (!request) return;

		/* Only the unprefixed call returns a promise; the WebKit ones return
		 * undefined and report failure through fullscreenerror instead. */
		var result = request.call(root);
		if (result && result.catch)
			result.catch(function (err) { console.warn('[HTP] full screen refused:', err); });
	}

	function syncFullscreenButton() {
		var button = document.getElementById('htpFullscreen');
		if (!button) return;
		var on = !!fullscreenElement();
		button.classList.toggle('is-active', on);
		button.setAttribute('aria-pressed', on ? 'true' : 'false');
		button.textContent = on ? 'Exit full screen' : 'Full screen';
	}

	var STAFF_SIZE_MIN = 24;
	var STAFF_SIZE_MAX = 110;
	var STAFF_SIZE_STEP = 6;

	/* Scroll speed, as a percentage of the original 35px/s. Down to a quarter,
	 * which is slow enough to read a ledger line you have never met, and up to
	 * three times, which is faster than anybody sight-reads. */
	var SPEED_MIN = 25;
	var SPEED_MAX = 300;
	var SPEED_STEP = 25;

	function clampSpeed(value) {
		var speed = parseInt(value, 10);
		if (isNaN(speed)) speed = 100;
		return Math.max(SPEED_MIN, Math.min(SPEED_MAX, speed));
	}

	/* The number shown in the control. The trainer reads the setting itself,
	 * every frame, so there is nothing else to apply. */
	function applyScrollSpeed() {
		var label = document.getElementById('optSpeedValue');
		if (label) label.textContent = clampSpeed(window.HTP.settings.scrollSpeed) + '%';
	}

	function nudgeSpeed(delta) {
		window.HTP.setSetting('scrollSpeed', clampSpeed(window.HTP.settings.scrollSpeed + delta));
	}

	/*
	 * js/htp-core.js already set the [data-htp-theme] attribute this setting
	 * drives, synchronously and before first paint, so a restored preference
	 * never flashes light. This is what keeps it in sync after that: the
	 * checkbox toggling at runtime, and the address-bar colour on mobile,
	 * which has to match or the theme looks like it stops at the page edge.
	 */
	function applyNightMode() {
		var on = !!window.HTP.settings.nightMode;
		document.documentElement.setAttribute('data-htp-theme', on ? 'dark' : 'light');
		var meta = document.querySelector('meta[name="theme-color"]');
		if (meta) meta.setAttribute('content', on ? '#14161a' : '#ffffff');
	}

	/*
	 * Turning a clef off removes its whole staff — lines and all — not just the
	 * glyph. js/code.js owns the trainer's staves; a module that draws its own
	 * follows the same setting from its own applyOptions().
	 *
	 * This is the boot-time call only. At boot js/code.js has already drawn the
	 * first level's notes in whatever clef(s) it started with, and staff
	 * visibility is all that needs syncing to the restored settings — there is
	 * nothing on the staff yet that was read in a clef that might be wrong.
	 * The running-exercise case is applyClefChoice() below.
	 */
	function applyClefVisibility() {
		if (typeof window.HTP.applyStaffVisibility === 'function')
			window.HTP.applyStaffVisibility();
	}

	/*
	 * The clefs in play have changed under the exercise, not just which
	 * staves are shown: whatever is on the staff was read in a clef that
	 * may be gone. The trainer clears it and re-clefs.
	 *
	 * Held off while the pair of switches is mid-write. Turning the last clef
	 * off writes both settings, and re-clefing on the first of them would
	 * build a staff for a clef choice that lasts one statement — which shows
	 * as a flash of the wrong staff before the right one arrives.
	 */
	var writingClefChoice = false;

	function applyClefChoice() {
		if (writingClefChoice) return;
		if (typeof window.HTP.applyClefChoice === 'function') window.HTP.applyClefChoice();
		else if (typeof window.HTP.applyStaffVisibility === 'function') window.HTP.applyStaffVisibility();
	}

	function clampStaffSize(value) {
		var size = parseInt(value, 10);
		if (isNaN(size)) size = 75;
		return Math.max(STAFF_SIZE_MIN, Math.min(STAFF_SIZE_MAX, size));
	}

	/*
	 * Everything the staff size drives: the CSS variable the notation is sized
	 * from, the number shown in the control, and a redraw of whatever is
	 * positioned against the staff.
	 *
	 * This runs from an HTP.onSettingChange listener rather than from the +/-
	 * buttons, so setting staffSize by any route — the buttons, a restored
	 * value, or HTP.setSetting() called directly — keeps all three in step.
	 */
	function applyStaffSize() {
		var size = clampStaffSize(window.HTP.settings.staffSize);
		document.documentElement.style.setProperty('--htp-staff-size', size + 'px');

		var label = document.getElementById('optStaffSize');
		if (label) label.textContent = String(size);

		if (typeof window.HTP.applyStaffSpacing === 'function') window.HTP.applyStaffSpacing();
		if (typeof window.HTP.applyLineMarkers === 'function') window.HTP.applyLineMarkers();
	}

	function nudgeStaffSize(delta) {
		/* setSetting notifies the listener, which does the applying. */
		window.HTP.setSetting('staffSize', clampStaffSize(window.HTP.settings.staffSize + delta));
	}

	/*
	 * Treble and Bass are bound here rather than through the generic OPTIONS
	 * loop, because the two checkboxes are not independent: the options bar
	 * keeps at least one of them on. Unchecking the only one that is on reads
	 * as "stop practising this clef", and the only way to honour that without
	 * leaving the exercise with nothing on the staff is to switch the other
	 * one on for you. So that is what happens — the click always does
	 * something, it is just not always the thing it looks like on its own.
	 *
	 * Both checkboxes are re-synced from window.HTP.settings after every
	 * change, which is what makes the box you clicked visibly revert and the
	 * other one visibly check. Setting .checked in script does not fire a
	 * change event, so this does not re-trigger itself.
	 */
	function bindClefChoice() {
		var treble = document.getElementById('optShowClefTreble');
		var bass = document.getElementById('optShowClefBass');
		if (!treble || !bass) return;

		function sync() {
			treble.checked = !!window.HTP.settings.showClefTreble;
			bass.checked = !!window.HTP.settings.showClefBass;
		}

		function bind(input, key, otherKey) {
			input.addEventListener('change', function () {
				writingClefChoice = true;
				try {
					/* The other clef goes on BEFORE this one goes off, so no
					 * listener anywhere ever sees a moment with no clef at
					 * all — only "both", then "the other one". */
					if (!input.checked && !window.HTP.settings[otherKey])
						window.HTP.setSetting(otherKey, true);
					window.HTP.setSetting(key, input.checked);
				} finally {
					writingClefChoice = false;
				}
				sync();
				applyClefChoice();
			});
		}

		bind(treble, 'showClefTreble', 'showClefBass');
		bind(bass, 'showClefBass', 'showClefTreble');
		sync();
	}

	function bindOptions() {
		OPTIONS.forEach(function (option) {
			var input = document.getElementById(option.id);
			if (!input) return;
			input.checked = !!window.HTP.settings[option.setting];
			input.addEventListener('change', function () {
				window.HTP.setSetting(option.setting, input.checked);
				if (option.apply && typeof window.HTP[option.apply] === 'function')
					window.HTP[option.apply]();
			});
		});

		bindClefChoice();

		var smaller = document.getElementById('optStaffSmaller');
		var bigger = document.getElementById('optStaffBigger');
		if (smaller) smaller.addEventListener('click', function () { nudgeStaffSize(-STAFF_SIZE_STEP); });
		if (bigger) bigger.addEventListener('click', function () { nudgeStaffSize(STAFF_SIZE_STEP); });

		var slower = document.getElementById('optSpeedSlower');
		var faster = document.getElementById('optSpeedFaster');
		if (slower) slower.addEventListener('click', function () { nudgeSpeed(-SPEED_STEP); });
		if (faster) faster.addEventListener('click', function () { nudgeSpeed(SPEED_STEP); });

		window.HTP.onSettingChange(function (key) {
			if (key === 'staffSize') applyStaffSize();
			if (key === 'scrollSpeed') applyScrollSpeed();
			if (key === 'nightMode') applyNightMode();
			if (key.indexOf('showClef') === 0) applyClefChoice();
			if (RECOLOUR_ON.indexOf(key) !== -1
				&& typeof window.HTP.applyNoteColours === 'function')
				window.HTP.applyNoteColours();
			/* The legend's landmark letters take their colour from the same
			 * switch as the noteheads, and are drawn with the markings. */
			if (key === 'colourNotes' && typeof window.HTP.applyLineMarkers === 'function')
				window.HTP.applyLineMarkers();
		});

		var fullscreenButton = document.getElementById('htpFullscreen');
		if (fullscreenButton) {
			if (fullscreenSupported()) {
				fullscreenButton.addEventListener('click', toggleFullscreen);
				document.addEventListener('fullscreenchange', syncFullscreenButton);
				document.addEventListener('webkitfullscreenchange', syncFullscreenButton);
				syncFullscreenButton();
			} else {
				/* Better an absent button than one that does nothing. An iPhone
				 * has no Fullscreen API for anything but a <video>, so point at
				 * the route that does work there — unless the app is already
				 * running that way, in which case it is full screen already. */
				fullscreenButton.hidden = true;
				var hint = document.getElementById('htpInstallHint');
				if (hint && !isStandalone()) hint.hidden = false;
			}
		}

		var optionsToggle = document.getElementById('htpOptionsToggle');
		if (optionsToggle)
			optionsToggle.addEventListener('click', function () { setOptionsOpen(!optionsAreOpen()); });
		setOptionsOpen(readStoredOptionsOpen());

		applyClefVisibility();
		applyScrollSpeed();
		applyNightMode();

		/* js/code.js has already drawn the first clef by now, so this both sets
		 * the restored size and re-applies everything positioned against it. */
		applyStaffSize();
	}

	/* ----------------------------------------------------------------- boot */

	$(function () {
		panesEl = document.getElementById('htpPanes');
		tabsEl = document.getElementById('htpTabs');
		splitButton = document.getElementById('htpSplit');
		if (!panesEl || !tabsEl) {
			console.error('[HTP] pane shell markup missing from index.html');
			return;
		}

		bindOptions();

		var modules = window.HTP.modules();
		if (!modules.length) {
			console.warn('[HTP] no modules registered');
			return;
		}

		modules.forEach(function (module) {
			ensurePane(module);
			/* A static pane owns markup that already exists and has already been
			 * wired up by its own script (the note trainer does this), so it
			 * counts as initialised from the start. */
			if (module.staticPane) module.initialised = true;
		});
		buildTabs(modules);

		var fromHash = (window.location.hash || '').replace(/^#/, '');
		var start = window.HTP.module(fromHash) ? fromHash : modules[0].id;
		visible = [start];

		if (splitButton) {
			splitButton.addEventListener('click', function () {
				setLayout(layout === 'split' ? 'single' : 'split');
			});
		}

		/* Tabs only earn their keep once there is more than one module. */
		document.body.classList.toggle('htp-multi-module', modules.length > 1);

		setLayout(modules.length > 1 ? readStoredLayout() : 'single');

		var resizeTimer = null;
		window.addEventListener('resize', function () {
			window.clearTimeout(resizeTimer);
			resizeTimer = window.setTimeout(function () {
				visible.forEach(function (id) {
					var module = window.HTP.module(id);
					if (module) fire(module, 'onResize');
				});
			}, 150);
		});
	});

	window.HTP.panes = {
		select: selectModule,
		setLayout: setLayout,
		layout: function () { return layout; },
		visible: function () { return visible.slice(); }
	};
})(window, document);
