/*
 * htp-journal — an optional recorder for what happens in a module.
 *
 * A module calls HTP.journal.event({...}) and HTP.journal.state({...}). If a
 * local sink is listening those calls reach disk; if one is not — which is the
 * case on the published site, and on any machine that has not set one up — they
 * are silently dropped. Nothing here can break practice, and nothing here is
 * ever required for the app to work.
 *
 * The sink is scripts/devserver-plugin.js on a local-only branch. GitHub Pages
 * serves static files and runs no request handler, so /__journal is a 404 there.
 * That is the privacy story in one line: the recording half cannot exist in the
 * published deployment, so there is no setting anyone can get wrong.
 *
 * Batched, because a drill answers every couple of seconds and one request per
 * answer would be absurd. Flushed on a timer, on a full buffer, and on the way
 * out of the page — the last one matters, since a practice session normally ends
 * by closing the tab.
 */
window.HTP = window.HTP || {};

(function (window, document) {
	'use strict';

	var BASE = '/__journal';
	var FLUSH_MS = 2500;         /* how long an event may sit unwritten        */
	var FLUSH_AT = 25;           /* ... or how many may queue up before we go  */
	var STATE_DEBOUNCE_MS = 4000;/* state is rewritten wholesale; do it rarely */

	var available = null;        /* null = not asked yet, then true/false      */
	var queue = [];
	var flushTimer = null;
	var stateTimer = null;
	var pendingState = null;
	var dropped = 0;

	function canFetch() {
		return typeof window.fetch === 'function';
	}

	/* Ask once whether anything is listening. Until the answer arrives events are
	 * still queued, so the first few of a session are not lost to the race. */
	function probe() {
		if (!canFetch()) {
			available = false;
			return;
		}
		window.fetch(BASE + '/ping', { method: 'GET', cache: 'no-store' })
			.then(function (res) { return res.ok ? res.json() : null; })
			.then(function (body) {
				available = !!(body && body.ok);
				if (available) {
					console.info('[journal] recording to ' + body.root);
					flush();
				} else {
					queue.length = 0;
				}
			})
			.catch(function () {
				available = false;
				queue.length = 0;
			});
	}

	function post(path, payload) {
		if (!canFetch()) return Promise.resolve(false);
		return window.fetch(BASE + path, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
			cache: 'no-store',
			keepalive: true          /* so a flush during pagehide still lands */
		}).then(function (res) { return res.ok; })
			.catch(function () { return false; });
	}

	function flush() {
		if (flushTimer) {
			window.clearTimeout(flushTimer);
			flushTimer = null;
		}
		if (available !== true || !queue.length) return;

		var batch = queue.splice(0, queue.length);
		post('/events', batch).then(function (ok) {
			/* A failed batch is dropped rather than retried. The journal is a
			 * record of practice, not a transaction log — losing a few answers to
			 * a dev server restart is not worth a retry queue that could grow
			 * without bound while someone plays. */
			if (!ok) dropped += batch.length;
		});
	}

	function scheduleFlush() {
		if (flushTimer || available === false) return;
		flushTimer = window.setTimeout(flush, FLUSH_MS);
	}

	function writeState() {
		if (stateTimer) {
			window.clearTimeout(stateTimer);
			stateTimer = null;
		}
		if (available !== true || pendingState === null) return;
		var snapshot = pendingState;
		pendingState = null;
		post('/state', snapshot);
	}

	window.HTP.journal = {
		/* true, false, or null while the probe is still in flight. */
		available: function () { return available; },

		/*
		 * Record one thing that happened. `kind` is 'answer', 'session' or
		 * 'stage' — see the piano-trainer skill's journal-format reference, which
		 * is the contract the reader parses.
		 */
		event: function (event) {
			if (available === false || !event) return;
			var record = {};
			Object.keys(event).forEach(function (key) { record[key] = event[key]; });
			record.v = record.v || 1;
			record.t = record.t || Date.now();
			queue.push(record);
			if (queue.length >= FLUSH_AT) flush();
			else scheduleFlush();
		},

		/* Replace the stored state snapshot. Debounced — callers may call this on
		 * every answer, and it is written whole each time. */
		state: function (snapshot) {
			if (available === false || !snapshot) return;
			pendingState = snapshot;
			if (stateTimer) return;
			stateTimer = window.setTimeout(writeState, STATE_DEBOUNCE_MS);
		},

		/* Read back the stored snapshot, for restoring after a cleared browser.
		 * Resolves to null when there is no sink or nothing saved. */
		restore: function () {
			if (!canFetch()) return Promise.resolve(null);
			return window.fetch(BASE + '/state', { method: 'GET', cache: 'no-store' })
				.then(function (res) { return res.ok ? res.json() : null; })
				.then(function (body) {
					return (body && Object.keys(body).length) ? body : null;
				})
				.catch(function () { return null; });
		},

		flush: function () { flush(); writeState(); },
		dropped: function () { return dropped; }
	};

	probe();

	/*
	 * A practice session usually ends by closing the tab, so this is the flush
	 * that matters most. visibilitychange fires where pagehide does not on iOS,
	 * and both are cheap, so take both.
	 */
	window.addEventListener('pagehide', function () { window.HTP.journal.flush(); });
	document.addEventListener('visibilitychange', function () {
		if (document.visibilityState === 'hidden') window.HTP.journal.flush();
	});
})(window, document);
