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

	/* ----------------------------------------------------------------- boot */

	$(function () {
		panesEl = document.getElementById('htpPanes');
		tabsEl = document.getElementById('htpTabs');
		splitButton = document.getElementById('htpSplit');
		if (!panesEl || !tabsEl) {
			console.error('[HTP] pane shell markup missing from index.html');
			return;
		}

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
