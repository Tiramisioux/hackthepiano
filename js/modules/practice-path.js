/*
 * practice-path — a step-by-step course that schedules itself around what you
 * actually know.
 *
 * The note trainer asks a random note from the whole level pool, on a clock that
 * speeds up as you improve, and forgets the result when you change level. Three
 * properties, each of which rewards guessing: the pool is too big to have learnt,
 * the countdown makes a half-believed answer better than no answer, and nothing
 * you get wrong is ever asked again.
 *
 * This module inverts all three.
 *
 *   - At most MAX_IN_FLIGHT items are being learnt at once. A new one is
 *     introduced only when there is room for it.
 *   - Nothing scrolls and nothing expires. The prompt sits there until you play
 *     it. The clock runs, but only to grade you — it never ends a question.
 *   - Every item carries a memory state, persisted, and comes back on a schedule
 *     derived from how well you actually knew it.
 *
 * Scheduling is FSRS-6 (see the block below), graded from what you played and
 * how long you took rather than from a self-rating — your hands are on the keys,
 * so there is nobody to press "Good".
 *
 * Slice 1 covers rungs 1-7: the five landmark anchors, steps and skips read from
 * them, both staves filled in, and the first ledger lines. Chords, scales, both
 * hands and real phrases are rungs 8-14 and are not here yet.
 */
(function (window, document) {
	'use strict';

	/* ==================================================== FSRS-6 scheduling */

	/*
	 * Transcribed from open-spaced-repetition/py-fsrs (fsrs/scheduler.py), which
	 * is the reference implementation. These are the published defaults, fitted
	 * on text flashcards — a stumbled scale is not a forgotten fact, so expect to
	 * retune W against a real log rather than trusting them forever. Keeping the
	 * vector in one named constant is what makes that possible later.
	 *
	 * The model gives every item three numbers:
	 *   D  difficulty    1..10, how hard this item is for you
	 *   S  stability     days until recall probability falls to 90%
	 *   R  retrievability probability you could play it right now
	 */
	var W = [
		0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722,
		0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425,
		0.0912, 0.0658, 0.1542
	];
	var DECAY = -W[20];
	var FACTOR = Math.pow(0.9, 1 / DECAY) - 1;
	var RETENTION = 0.9;          /* desired probability of recall at review     */
	var MIN_D = 1, MAX_D = 10, MIN_S = 0.001, MAX_INTERVAL_DAYS = 36500;
	var DAY_MS = 86400000;

	/* Grades. There are no buttons for these — gradeFor() derives one. */
	var AGAIN = 1, HARD = 2, GOOD = 3, EASY = 4;

	function clampD(d) { return Math.min(Math.max(d, MIN_D), MAX_D); }
	function clampS(s) { return Math.max(s, MIN_S); }

	function initialStability(grade) { return clampS(W[grade - 1]); }
	function initialDifficulty(grade, clamp) {
		var d = W[4] - Math.exp(W[5] * (grade - 1)) + 1;
		return clamp ? clampD(d) : d;
	}

	/* R(t,S) — the forgetting curve. Power law, not exponential. */
	function retrievability(elapsedDays, stability) {
		return Math.pow(1 + FACTOR * elapsedDays / stability, DECAY);
	}

	/* At RETENTION = 0.9 this returns exactly S, which is what stability means. */
	function nextIntervalDays(stability) {
		var days = (stability / FACTOR) * (Math.pow(RETENTION, 1 / DECAY) - 1);
		return Math.min(Math.max(Math.round(days), 1), MAX_INTERVAL_DAYS);
	}

	/* Difficulty moves by the grade, damped near the ceiling, then reverts toward
	 * the difficulty an Easy first answer would have given it. Mean reversion is
	 * the reason to prefer this over SM-2: one bad day does not mark an item
	 * permanently hard. */
	function nextDifficulty(difficulty, grade) {
		var delta = -(W[6] * (grade - 3));
		var damped = difficulty + (10 - difficulty) * delta / 9;
		return clampD(W[7] * initialDifficulty(EASY, false) + (1 - W[7]) * damped);
	}

	/* Same-day repeat: the learning-step path. */
	function shortTermStability(stability, grade) {
		var increase = Math.exp(W[17] * (grade - 3 + W[18])) * Math.pow(stability, -W[19]);
		if (grade >= HARD) increase = Math.max(increase, 1.0);
		return clampS(stability * increase);
	}

	function recallStability(difficulty, stability, r, grade) {
		var hardPenalty = (grade === HARD) ? W[15] : 1;
		var easyBonus = (grade === EASY) ? W[16] : 1;
		return clampS(stability * (1
			+ Math.exp(W[8])
			* (11 - difficulty)
			* Math.pow(stability, -W[9])
			* (Math.exp((1 - r) * W[10]) - 1)
			* hardPenalty * easyBonus));
	}

	function forgetStability(difficulty, stability, r) {
		var longTerm = W[11]
			* Math.pow(difficulty, -W[12])
			* (Math.pow(stability + 1, W[13]) - 1)
			* Math.exp((1 - r) * W[14]);
		var shortTerm = stability / Math.exp(W[17] * W[18]);
		return clampS(Math.min(longTerm, shortTerm));
	}

	/* ============================================================= behaviour */

	var MAX_IN_FLIGHT = 5;        /* unlearnt items being juggled at once        */
	/* Intervening items before the next look. The first step is 1, not 0: asking
	 * again the instant you have corrected it is not recall, it is copying — you
	 * still have the answer in your hands. When there is genuinely nothing else
	 * ripe the scheduler falls through and shows it anyway. */
	var LEARNING_STEPS = [1, 3, 8];
	var NEW_ITEM_GAP = 3;         /* reviews between introductions               */
	var FEEDBACK_MS = 480;        /* the only timer in the module                */
	/* Where a prompt sits along the staff, in percent. A lone note is centred; a
	 * step pair straddles the centre, so both kinds of prompt land in the same
	 * place on the page and the eye does not have to go looking. */
	var SINGLE_LEFT_PCT = 50, STEP_LEFT_PCT = 41, STEP_RIGHT_PCT = 59;
	var PACE_SAMPLES = 20;
	var PACE_SEED = { read: 3500, find: 3800, step: 5200 };
	var HARD_FACTOR = 2.0, EASY_FACTOR = 0.6;
	/*
	 * Pace is self-calibrating, which means it can calibrate itself into
	 * nonsense. Two guards:
	 *
	 *   - only plausible answers are recorded. Under a quarter second is not a
	 *     retrieval — nobody reads a notehead and finds a key that fast — and
	 *     over fifteen seconds you had left the room. Either would drag the
	 *     median somewhere no real answer can reach.
	 *   - the pace itself has a floor. Without one a streak of quick answers
	 *     ratchets the target down until every honest answer grades Hard, and
	 *     the schedule quietly stops believing you know anything.
	 */
	var MIN_PLAUSIBLE_MS = 250, MAX_PLAUSIBLE_MS = 15000, PACE_FLOOR_MS = 900;
	var ELO_START = 1200, K_USER = 24, K_ITEM = 8, ELO_SHRINK = 0.02;

	/* =================================================== diatonic arithmetic */

	/*
	 * Stages 1-7 are naturals only, so a note is fully described by its diatonic
	 * index: 7 per octave, counting C D E F G A B. That makes "one step up" an
	 * increment, which is the whole point — the curriculum is built out of steps
	 * and skips from a landmark, not out of semitones.
	 *
	 * Staff shift is linear in that index. B4 (diatonic 34) is shift 0 on the
	 * treble staff, and each clef adds its own offset, so:
	 *     shift = (diatonic - 34) + clefs[clef].shift
	 * Verified against the music: F3 in bass -> 2, the fourth line; G4 in treble
	 * -> -2, the second line; C4 -> -6 in treble and 6 in bass, one ledger either
	 * side of middle.
	 */
	var LETTER_FOR_PC = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 };
	var PC_FOR_LETTER = [0, 2, 4, 5, 7, 9, 11];
	var LETTER_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
	var B4_DIATONIC = 34;
	var LANDMARK_LETTERS = { 0: 'C', 3: 'F', 4: 'G' };

	function diatonicOf(sound) {
		var letter = LETTER_FOR_PC[((sound % 12) + 12) % 12];
		if (letter === undefined) return null;          /* a black key */
		return 7 * (Math.floor(sound / 12) - 1) + letter;
	}
	function soundForDiatonic(d) {
		var octave = Math.floor(d / 7);
		return (octave + 1) * 12 + PC_FOR_LETTER[d - 7 * octave];
	}
	function octaveOf(sound) { return Math.floor(sound / 12) - 1; }
	function nameOf(sound) {
		var letter = LETTER_FOR_PC[((sound % 12) + 12) % 12];
		if (letter === undefined) return '?';
		return LETTER_NAMES[letter] + octaveOf(sound);
	}
	function clefShift(clefId) {
		var clef = window.HTP.notation.clefs[clefId];
		return clef ? clef.shift : 0;
	}
	function shiftFor(clefId, sound) {
		var d = diatonicOf(sound);
		return d === null ? null : (d - B4_DIATONIC) + clefShift(clefId);
	}
	function soundForShift(clefId, shift) {
		return soundForDiatonic(shift - clefShift(clefId) + B4_DIATONIC);
	}

	/* ============================================================ curriculum */

	/*
	 * The five landmark anchors. These are the fork's own C/F/G landmark system:
	 * the markings already drawn on the staff and tinted onto the keys are
	 * exactly what rungs 1 and 2 teach, so the curriculum starts by naming what
	 * the app already shows you.
	 */
	var ANCHORS = [
		{ sound: 60, label: 'Middle C', clefs: ['treble', 'bass'], mark: 'C' },
		{ sound: 53, label: 'Bass F',   clefs: ['bass'],           mark: 'F' },
		{ sound: 67, label: 'Treble G', clefs: ['treble'],         mark: 'G' },
		{ sound: 48, label: 'Bass C',   clefs: ['bass'],           mark: 'C' },
		{ sound: 72, label: 'Treble C', clefs: ['treble'],         mark: 'C' }
	];

	function readItem(clefId, sound) {
		return { id: 'read:' + clefId + ':' + sound, type: 'read', clef: clefId, sounds: [sound] };
	}
	function findItem(sound) {
		return { id: 'find:' + sound, type: 'find', clef: null, sounds: [sound] };
	}
	function stepItem(clefId, from, to) {
		return {
			id: 'step:' + clefId + ':' + from + ':' + to,
			type: 'step', clef: clefId, sounds: [from, to]
		};
	}

	/* Items reading `distance` diatonic steps either way from each anchor. */
	function fromAnchors(anchors, distance) {
		var out = [];
		anchors.forEach(function (anchor) {
			anchor.clefs.forEach(function (clefId) {
				[-distance, distance].forEach(function (delta) {
					var to = soundForDiatonic(diatonicOf(anchor.sound) + delta);
					if (to >= 21 && to <= 108) out.push(stepItem(clefId, anchor.sound, to));
				});
			});
		});
		return out;
	}

	/* Every staff position in a shift range, minus the ones already taught. */
	function fillClef(clefId, from, to) {
		var out = [];
		for (var shift = from; shift <= to; shift++)
			out.push(readItem(clefId, soundForShift(clefId, shift)));
		return out;
	}

	function anchorItems(anchors) {
		var out = [];
		anchors.forEach(function (anchor) {
			anchor.clefs.forEach(function (clefId) { out.push(readItem(clefId, anchor.sound)); });
			out.push(findItem(anchor.sound));
		});
		return out;
	}

	var STAGES = [
		{
			n: 1, name: 'Three anchors',
			detail: 'Middle C, bass F and treble G — on the staff, and by name.',
			gate: 1.0,
			build: function () { return anchorItems(ANCHORS.slice(0, 3)); }
		},
		{
			n: 2, name: 'Five anchors',
			detail: 'Bass C and treble C complete the classic guide-note set.',
			gate: 1.0,
			build: function () { return anchorItems(ANCHORS.slice(3, 5)); }
		},
		{
			n: 3, name: 'Steps from an anchor',
			detail: 'One step either way. Read the distance, not the letter.',
			gate: 0.8,
			build: function () { return fromAnchors(ANCHORS, 1); }
		},
		{
			n: 4, name: 'Skips from an anchor',
			detail: 'A third either way — the other half of intervallic reading.',
			gate: 0.8,
			build: function () { return fromAnchors(ANCHORS, 2); }
		},
		{
			n: 5, name: 'Treble staff filled in',
			detail: 'Every line and space between the outer lines.',
			gate: 0.8,
			build: function () { return fillClef('treble', -4, 4); }
		},
		{
			n: 6, name: 'Bass staff filled in',
			detail: 'The same below, interleaved so the clefs never block.',
			gate: 0.8,
			build: function () { return fillClef('bass', -4, 4); }
		},
		{
			n: 7, name: 'First ledger lines',
			detail: 'Two ledgers either way, counted from the nearest anchor.',
			gate: 0.8,
			build: function () {
				return fillClef('treble', 5, 8).concat(fillClef('treble', -8, -5))
					.concat(fillClef('bass', 5, 8)).concat(fillClef('bass', -8, -5));
			}
		}
	];

	/*
	 * Item definitions, indexed by id. A later stage may name an item an earlier
	 * one already introduced — middle C falls inside every shift range that
	 * covers it — and the first stage to claim it owns it.
	 *
	 * Built on init() rather than here, because every stage resolves staff shifts
	 * through HTP.notation.clefs, and js/code.js only publishes HTP.notation from
	 * its DOM-ready handler. A module file runs the moment it is parsed, which is
	 * well before that.
	 */
	var ITEMS = {};
	var STAGE_ITEMS = [];
	function buildCurriculum() {
		ITEMS = {};
		STAGE_ITEMS = [];
		STAGES.forEach(function (stage, i) {
			var ids = [];
			stage.build().forEach(function (item) {
				if (ITEMS[item.id]) return;
				item.stage = i;
				ITEMS[item.id] = item;
				ids.push(item.id);
			});
			STAGE_ITEMS[i] = ids;
		});
	}

	/* ================================================================= store */

	var STORE_KEY = 'htp.practicePath.v1';
	var store = null;

	function blankStore() {
		return {
			v: 1,
			stage: 0,
			items: {},
			user: { elo: ELO_START },
			pace: { read: [], find: [], step: [] }
		};
	}

	function loadStore() {
		try {
			var raw = window.localStorage.getItem(STORE_KEY);
			var parsed = raw ? JSON.parse(raw) : null;
			if (!parsed || parsed.v !== 1) return blankStore();
			/* Trust nothing that came out of storage: a curriculum edit can leave
			 * behind ids that no longer exist. */
			Object.keys(parsed.items).forEach(function (id) {
				if (!ITEMS[id]) delete parsed.items[id];
			});
			parsed.user = parsed.user || { elo: ELO_START };
			parsed.pace = parsed.pace || { read: [], find: [], step: [] };
			parsed.stage = Math.min(Math.max(parsed.stage | 0, 0), STAGES.length - 1);
			return parsed;
		} catch (e) {
			console.warn('[practice-path] could not read saved progress', e);
			return blankStore();
		}
	}

	function saveStore() {
		try { window.localStorage.setItem(STORE_KEY, JSON.stringify(store)); }
		catch (e) { console.warn('[practice-path] could not save progress', e); }
		var bridge = journal();
		if (bridge) bridge.state(journalState());
	}

	/*
	 * The journal is the other half of this module: localStorage is what the app
	 * reads back, and the journal is what a person (or Claude, through the
	 * piano-trainer skill) reads back. Both are written from the same place, so
	 * they cannot disagree.
	 *
	 * Every call here is a no-op unless a local sink is listening — on the
	 * published site js/htp-journal.js finds nothing and drops everything, which
	 * is why practice never depends on it.
	 */
	function journal() {
		return window.HTP && window.HTP.journal;
	}

	function median(values) {
		if (!values || !values.length) return null;
		var sorted = values.slice().sort(function (a, b) { return a - b; });
		var mid = Math.floor(sorted.length / 2);
		return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
	}

	/* Shaped to the journal-format contract rather than to our storage: the
	 * reader should not have to know how this module happens to keep pace. */
	function journalState() {
		return {
			v: 1,
			stage: store.stage + 1,          /* rungs are 1-based to a reader */
			updated: new Date().toISOString(),
			user: {
				elo: Math.round(store.user.elo),
				pace: {
					read: median(store.pace.read),
					find: median(store.pace.find),
					step: median(store.pace.step)
				}
			},
			items: store.items
		};
	}

	function journalAnswer(current, correct, grade, latency) {
		var bridge = journal();
		if (!bridge) return;
		var st = store.items[current.id] || {};
		var item = current.item;
		bridge.event({
			kind: 'answer',
			item: current.id,
			type: item.type,
			clef: item.clef || null,
			stage: store.stage + 1,
			sounds: item.sounds.slice(),
			played: current.played.slice(),
			correct: !!correct,
			ms: Math.round(latency),
			grade: grade,
			reps: st.reps, lapses: st.lapses,
			s: st.s, d: st.d,
			due: st.due ? new Date(st.due).toISOString() : null,
			scaffold: !!current.scaffold
		});
	}

	function stateOf(id) {
		if (!store.items[id])
			store.items[id] = {
				s: null, d: null, due: null, last: null,
				reps: 0, lapses: 0, step: 0, elo: ELO_START
			};
		return store.items[id];
	}
	function seen(id) { return !!store.items[id]; }
	/* Learnt means graduated out of the learning steps onto a day-scale schedule.
	 * That is the only sense in which this module claims you "know" something. */
	function learnt(id) { return seen(id) && store.items[id].due !== null; }

	/* ============================================================= scheduler */

	var session = null;

	function newSession() {
		return {
			learning: [], current: null, lastType: null, lastClef: null,
			sinceNew: NEW_ITEM_GAP, answered: 0,
			ahead: false        /* set by "Practice anyway" on the caught-up screen */
		};
	}

	function inLearning(id) {
		return session.learning.some(function (e) { return e.id === id; });
	}

	function stageProgress(index) {
		var ids = STAGE_ITEMS[index] || [];
		var done = ids.filter(learnt).length;
		return { done: done, total: ids.length, ratio: ids.length ? done / ids.length : 1 };
	}

	function stageCleared(index) {
		return stageProgress(index).ratio >= STAGES[index].gate;
	}

	/* The next item of the current stage that has never been shown — advancing
	 * the stage when this one is both exhausted and cleared. */
	function nextNewId() {
		for (var guard = 0; guard < STAGES.length; guard++) {
			var ids = STAGE_ITEMS[store.stage];
			for (var i = 0; i < ids.length; i++)
				if (!seen(ids[i])) return ids[i];
			if (store.stage >= STAGES.length - 1) return null;
			if (!stageCleared(store.stage)) return null;   /* exhausted but not cleared */
			var from = store.stage;
			store.stage++;
			var bridge = journal();
			if (bridge) bridge.event({
				kind: 'stage', from: from + 1, to: store.stage + 1,
				cleared: stageProgress(from).total
			});
			saveStore();
		}
		return null;
	}

	/*
	 * Pick what to ask next.
	 *
	 * Tier A is everything that is actually due — learning items whose wait has
	 * elapsed, and reviews past their date. Tier B introduces something new, but
	 * only on a trickle, so introductions never starve the reviews. Tiers C and D
	 * exist so a session cannot dead-end: take a learning item early, or pull the
	 * nearest future review forward, rather than showing nothing.
	 */
	function pickNext() {
		var now = Date.now();
		var tierA = [];

		session.learning.forEach(function (entry) {
			if (entry.wait <= 0) tierA.push(entry.id);
		});
		Object.keys(store.items).forEach(function (id) {
			if (!ITEMS[id] || inLearning(id)) return;
			var st = store.items[id];
			if (st.due !== null && st.due <= now) tierA.push(id);
		});

		/* Introduce when there is room and either nothing is ripe (otherwise a
		 * single cooling-off item would be shown over and over at the start of a
		 * session) or the trickle is due. */
		var roomForNew = session.learning.length < MAX_IN_FLIGHT;
		if (roomForNew && (!tierA.length || session.sinceNew >= NEW_ITEM_GAP)) {
			var fresh = nextNewId();
			if (fresh) return fresh;
		}
		if (tierA.length) return interleave(tierA);

		if (session.learning.length) {
			/* Nothing is ripe. Take whichever is closest to ripe. */
			var soonest = session.learning.slice().sort(function (a, b) { return a.wait - b.wait; })[0];
			return soonest.id;
		}

		/*
		 * Nothing is due, nothing is being learnt, and the ladder has nothing new
		 * to introduce — so the honest answer is to stop, and say so.
		 *
		 * Pulling tomorrow's reviews forward instead would never end: each one
		 * answered early resets its clock from today, so the queue refills itself
		 * and the session has no natural finish. It also quietly degrades the
		 * schedule, because the interval FSRS chose assumed you would answer at
		 * the end of it, not at the start. Practising ahead stays available, but
		 * as something you ask for.
		 */
		if (!session.ahead) return null;

		var future = Object.keys(store.items).filter(function (id) {
			return ITEMS[id] && store.items[id].due !== null;
		}).sort(function (a, b) { return store.items[a].due - store.items[b].due; });
		return future.length ? future[0] : null;
	}

	/*
	 * Contextual interference: alternating item type and clef learns better than
	 * drilling one of them in a block, even though the block feels easier at the
	 * time. So among everything that is equally due, prefer the one that differs
	 * from what you just did.
	 */
	function interleave(ids) {
		var scored = ids.map(function (id) {
			var item = ITEMS[id];
			var score = 0;
			if (item.type !== session.lastType) score += 2;
			if (item.clef && item.clef !== session.lastClef) score += 1;
			return { id: id, score: score, elo: store.items[id] ? store.items[id].elo : ELO_START };
		});
		scored.sort(function (a, b) {
			if (b.score !== a.score) return b.score - a.score;
			return b.elo - a.elo;        /* your hardest first, among equals */
		});
		return scored[0].id;
	}

	/* ------------------------------------------------------------- grading */

	function paceFor(type) {
		var samples = store.pace[type] || [];
		if (samples.length < 5) return PACE_SEED[type];
		var sorted = samples.slice().sort(function (a, b) { return a - b; });
		return Math.max(sorted[Math.floor(sorted.length / 2)], PACE_FLOOR_MS);
	}

	/*
	 * The grade, without asking. Thresholds are multiples of your own rolling
	 * median for this item type, so they move as you get faster — an absolute
	 * millisecond target would punish a beginner and bore everyone else.
	 */
	function gradeFor(type, correct, latency) {
		if (!correct) return AGAIN;
		var pace = paceFor(type);
		if (latency > HARD_FACTOR * pace) return HARD;
		if (latency < EASY_FACTOR * pace) return EASY;
		return GOOD;
	}

	function recordPace(type, latency) {
		if (latency < MIN_PLAUSIBLE_MS || latency > MAX_PLAUSIBLE_MS) return;
		var samples = store.pace[type] || (store.pace[type] = []);
		samples.push(latency);
		while (samples.length > PACE_SAMPLES) samples.shift();
	}

	/*
	 * Elo, so the module finds YOUR confusions rather than assuming the textbook
	 * ones. Item ratings are shrunk back toward the starting rating on every
	 * update: rating items and selecting items adaptively at the same time
	 * inflates the variance and never converges otherwise.
	 */
	function updateElo(st, correct) {
		var expected = 1 / (1 + Math.pow(10, (st.elo - store.user.elo) / 400));
		var outcome = correct ? 1 : 0;
		store.user.elo += K_USER * (outcome - expected);
		st.elo -= K_ITEM * (outcome - expected);
		st.elo += ELO_SHRINK * (ELO_START - st.elo);
	}

	function applyGrade(id, grade, latency) {
		var st = stateOf(id);
		var item = ITEMS[id];
		var now = Date.now();

		if (st.s === null) {
			st.s = initialStability(grade);
			st.d = initialDifficulty(grade, true);
		} else {
			var elapsedDays = st.last === null ? 0 : (now - st.last) / DAY_MS;
			if (st.due === null || elapsedDays < 1) {
				st.s = shortTermStability(st.s, grade);
			} else {
				var r = retrievability(elapsedDays, st.s);
				st.s = (grade === AGAIN)
					? forgetStability(st.d, st.s, r)
					: recallStability(st.d, st.s, r, grade);
			}
			st.d = nextDifficulty(st.d, grade);
		}

		st.last = now;
		st.reps++;
		if (grade === AGAIN) st.lapses++;
		updateElo(st, grade !== AGAIN);
		if (grade !== AGAIN) recordPace(item.type, latency);

		/* Learning steps, counted in intervening items rather than in minutes: a
		 * drill answers in about two seconds, so a ten-minute step is nonsense. */
		if (grade === AGAIN) {
			st.step = 0;
			st.due = null;
			enterLearning(id, LEARNING_STEPS[0]);
		} else {
			if (grade !== HARD) st.step++;
			if (st.step >= LEARNING_STEPS.length) {
				st.step = LEARNING_STEPS.length;
				st.due = now + nextIntervalDays(st.s) * DAY_MS;
				leaveLearning(id);
			} else {
				st.due = null;
				enterLearning(id, LEARNING_STEPS[st.step]);
			}
		}
		saveStore();
	}

	function enterLearning(id, wait) {
		var entry = null;
		session.learning.forEach(function (e) { if (e.id === id) entry = e; });
		if (!entry) session.learning.push({ id: id, wait: wait });
		else entry.wait = wait;
	}
	function leaveLearning(id) {
		session.learning = session.learning.filter(function (e) { return e.id !== id; });
	}
	function tickLearning(shownId) {
		session.learning.forEach(function (e) {
			if (e.id !== shownId) e.wait--;
		});
	}

	/* ============================================================= rendering */

	var root = null, staffEl = null, staffContainer = null, stavesEl = null;
	var stageNumEl, stageNameEl, stageDetailEl, barEl, progressEl;
	var promptNameEl, feedbackEl, statsEl, doneEl, promptEl;
	var unsubscribe = null;

	function notation() { return window.HTP.notation; }

	function buildUI(el) {
		el.innerHTML =
			  '<div class="htp-pp">'
			+   '<header class="htp-pp__head">'
			+     '<div class="htp-pp__stage">'
			+       '<span class="htp-pp__stagenum"></span>'
			+       '<span class="htp-pp__stagename"></span>'
			+       '<span class="htp-pp__stagedetail"></span>'
			+     '</div>'
			+     '<div class="htp-pp__progress">'
			+       '<div class="htp-pp__bar"><i></i></div>'
			+       '<span class="htp-pp__count"></span>'
			+     '</div>'
			+   '</header>'
			+   '<div class="htp-pp__prompt">'
			+     '<div class="htp-pp__staves"></div>'
			+     '<div class="htp-pp__name" hidden></div>'
			+     '<div class="htp-pp__done" hidden></div>'
			+   '</div>'
			+   '<div class="htp-pp__feedback"></div>'
			+   '<footer class="htp-pp__foot">'
			+     '<span class="htp-pp__stats"></span>'
			+     '<label class="htp-pp__opt" title="Blank the note names printed on the on-screen keys, so a by-name prompt cannot be answered by reading the keyboard">'
			+       '<input type="checkbox" class="htp-pp__nolabels"> Hide key labels'
			+     '</label>'
			+     '<button type="button" class="btn btn-default btn-sm htp-pp__reset">Reset progress</button>'
			+   '</footer>'
			+ '</div>';

		stavesEl = el.querySelector('.htp-pp__staves');
		promptEl = el.querySelector('.htp-pp__prompt');
		promptNameEl = el.querySelector('.htp-pp__name');
		doneEl = el.querySelector('.htp-pp__done');
		feedbackEl = el.querySelector('.htp-pp__feedback');
		statsEl = el.querySelector('.htp-pp__stats');
		stageNumEl = el.querySelector('.htp-pp__stagenum');
		stageNameEl = el.querySelector('.htp-pp__stagename');
		stageDetailEl = el.querySelector('.htp-pp__stagedetail');
		barEl = el.querySelector('.htp-pp__bar i');
		progressEl = el.querySelector('.htp-pp__count');

		var container = $('<div class="staffContainer"></div>');
		var staff = $('<div class="staff"></div>').append('<div class="lines"></div>');
		container.append(staff);
		$(stavesEl).addClass('staffsContainer').append(container);
		staffEl = staff;
		staffContainer = container;
		notation().renderStaffLines(staff);

		el.querySelector('.htp-pp__reset').addEventListener('click', resetProgress);

		var noLabels = el.querySelector('.htp-pp__nolabels');
		noLabels.addEventListener('change', function () {
			document.body.classList.toggle('htp-pp-nolabels', noLabels.checked);
		});
	}

	function resetProgress() {
		if (!window.confirm('Forget everything Practice Path has learnt about you and start from stage 1?'))
			return;
		store = blankStore();
		saveStore();
		session = newSession();
		advance();
	}

	/* ------------------------------------------------------------ the staff */

	/*
	 * Landmark markings are scaffolding, so they come down as you stop needing
	 * them: a marking is hidden once the note it sits on has graduated in this
	 * clef. Everything still unlearnt keeps its marking, which turns the staff
	 * into a readout of what you know.
	 *
	 * The module renders its own layer rather than writing to HTP.settings — the
	 * landmark switches are app chrome shared with the trainer and free practice,
	 * and fading one here must not change them there. Your switches stay the
	 * ceiling: renderStaffMarkers honours them, and this only ever hides more.
	 */
	function renderScaffold(clefId) {
		notation().renderStaffMarkers(staffEl, clefId);
		staffEl.find('.htp-markers .htp-marker').each(function () {
			var marker = $(this);
			var shift = parseFloat(marker.attr('data-htp-marker-shift'));
			if (!isFinite(shift)) return;
			var sound = soundForShift(clefId, shift);
			if (learnt('read:' + clefId + ':' + sound)) marker.addClass('htp-pp-marker--retired');
		});
	}

	function clearStaff() {
		staffEl.find('.symbol').remove();
		staffEl.find('.htp-markers').remove();
	}

	/* Draw one notehead as its own symbol at a fixed place along the staff. */
	function drawNote(clefId, sound, leftPercent, classes) {
		var built = notation().buildNoteGlyph(clefId, sound);
		if (!built) return null;

		/* A landmark hue would BE the answer on a note you have already learnt —
		 * you could read "that is a C" off the colour without reading its
		 * position at all. So scaffolding colour survives only while an item is
		 * still being introduced. The given note of a step pair keeps its colour
		 * either way: it is the anchor you read FROM, not the question.
		 */
		var given = (classes || '').indexOf('htp-pp-note--given') !== -1;
		if (!given && learnt('read:' + clefId + ':' + sound))
			built.glyph.css('fill', '');

		var symbol = $('<div class="symbol note visible htp-pp-note"></div>')
			.addClass(classes || '')
			.css({ left: leftPercent + '%' })
			.append(built.glyph);

		var ledgers = notation().ledgerLineCount(built.shift);
		if (ledgers) notation().addLedgerLines(symbol, ledgers);
		staffEl.append(symbol);
		return built.shift;
	}

	function makeRoom(shifts) {
		var real = shifts.filter(function (s) { return s !== null && isFinite(s); });
		var room = notation().roomForShiftsEm(
			real.length ? Math.max.apply(null, real) : null,
			real.length ? Math.min.apply(null, real) : null);
		staffContainer.css({
			'padding-top': room.above ? room.above.toFixed(3) + 'em' : '',
			'padding-bottom': room.below ? room.below.toFixed(3) + 'em' : ''
		});
	}

	function showStaff(on) {
		stavesEl.hidden = !on;
		promptNameEl.hidden = on;
	}

	/* -------------------------------------------------------- the readouts */

	var DIATONIC_NAMES = ['', 'one step', 'a third', 'a fourth', 'a fifth',
		'a sixth', 'a seventh', 'an octave'];

	function landmarkChip(sound) {
		var pc = ((sound % 12) + 12) % 12;
		var landmark = window.HTP.landmarkForPitchClass(pc, octaveOf(sound));
		var name = nameOf(sound);
		if (!landmark) return '<b>' + name + '</b>';
		return '<b class="htp-pp-mark" style="color:' + landmark.colour + '">' + name + '</b>';
	}

	/*
	 * Say where a note is, the way the method actually reads it: as a route from
	 * the nearest landmark, not as a bare letter. The distance is the difference
	 * of two diatonic indices, which is the same number the staff shift is built
	 * from — so this needs no clef, and a by-name prompt gets the same hint a
	 * staff prompt does.
	 */
	function routeTo(sound) {
		var d = diatonicOf(sound);
		if (d === null) return nameOf(sound);

		var best = null;
		for (var candidate = 21; candidate <= 108; candidate++) {
			var cd = diatonicOf(candidate);
			if (cd === null) continue;
			var letter = cd - 7 * Math.floor(cd / 7);
			var mark = LANDMARK_LETTERS[letter];
			if (!mark || !window.HTP.landmarkEnabled(mark)) continue;
			var delta = d - cd;
			if (Math.abs(delta) > 7) continue;
			if (!best || Math.abs(delta) < Math.abs(best.delta)) best = { sound: candidate, delta: delta };
		}

		if (!best) return landmarkChip(sound);
		if (best.delta === 0) {
			var letter = LETTER_FOR_PC[((sound % 12) + 12) % 12];
			return landmarkChip(sound) + ' &mdash; the ' + LANDMARK_LETTERS[letter] + ' landmark';
		}
		return landmarkChip(sound) + ' &mdash; ' + DIATONIC_NAMES[Math.abs(best.delta)]
			+ (best.delta > 0 ? ' above ' : ' below ') + landmarkChip(best.sound);
	}

	function setFeedback(kind, html) {
		feedbackEl.className = 'htp-pp__feedback' + (kind ? ' htp-pp__feedback--' + kind : '');
		feedbackEl.innerHTML = html;
	}

	/* How many reviews have come due. Shared by the header and the session
	 * record, so the number a reader sees in the journal is the number that was
	 * on screen. */
	function countDue() {
		var now = Date.now();
		var due = 0;
		Object.keys(store.items).forEach(function (id) {
			if (ITEMS[id] && store.items[id].due !== null && store.items[id].due <= now) due++;
		});
		return due;
	}

	function updateHeader() {
		var stage = STAGES[store.stage];
		var progress = stageProgress(store.stage);
		stageNumEl.textContent = 'Stage ' + stage.n;
		stageNameEl.textContent = stage.name;
		stageDetailEl.textContent = stage.detail;
		barEl.style.width = Math.round(progress.ratio * 100) + '%';
		progressEl.textContent = progress.done + ' of ' + progress.total + ' learnt';

		var due = countDue();
		statsEl.innerHTML =
			  '<span>' + session.learning.length + ' in flight</span>'
			+ '<span>' + due + ' due</span>'
			+ '<span>' + Object.keys(store.items).filter(learnt).length + ' learnt</span>';
	}

	/* ============================================================= the drill */

	var PHASE_ASK = 'ask', PHASE_FIX = 'fix', PHASE_DONE = 'done';

	function present(id) {
		var item = ITEMS[id];
		session.current = {
			id: id, item: item, phase: PHASE_ASK, progress: 0,
			shownAt: (window.performance || Date).now(), missed: false,
			/* Every note that arrives, in order. Recording only right/wrong would
			 * throw away the most useful thing in the log: WHICH wrong note, every
			 * time. That is what a confusion is made of. */
			played: [], scaffold: false
		};

		clearStaff();
		doneEl.hidden = true;
		promptEl.hidden = false;

		if (item.type === 'find') {
			showStaff(false);
			promptNameEl.innerHTML = '<span class="htp-pp__nameval">' + nameOf(item.sounds[0]) + '</span>'
				+ '<span class="htp-pp__namehint">Play it without looking down</span>';
			setFeedback('', 'Find it on the keyboard.');
		} else {
			showStaff(true);
			renderScaffold(item.clef);
			var clef = notation().buildClefSymbol(item.clef);
			if (clef) staffEl.append(clef.css({ left: '0.2em' }));

			var shifts = [];
			if (item.type === 'step') {
				/* The first note is given — it is the anchor you read FROM. The
				 * second is the question. */
				shifts.push(drawNote(item.clef, item.sounds[0], STEP_LEFT_PCT, 'htp-pp-note--given'));
				shifts.push(drawNote(item.clef, item.sounds[1], STEP_RIGHT_PCT, ''));
				setFeedback('', 'Play both, in order.');
			} else {
				shifts.push(drawNote(item.clef, item.sounds[0], SINGLE_LEFT_PCT, ''));
				setFeedback('', seen(id) ? 'Play it.' : 'New note. Play it — take as long as you like.');
			}
			makeRoom(shifts);
		}

		/* Measured from the ink, not from the setting: whether a marking is up
		 * depends on the landmark having faded as well as on the option. */
		session.current.scaffold = staffEl.find('.htp-marker').length > 0;

		updateHeader();
	}

	function advance() {
		var id = pickNext();
		if (!id) {
			showRested();
			return;
		}
		/* sinceNew paces the trickle of new items, so it is counted where an item
		 * is actually introduced rather than in the answer handlers — a missed
		 * item is not a new one however many times it comes back. */
		if (seen(id)) session.sinceNew++;
		else session.sinceNew = 0;
		tickLearning(id);
		present(id);
	}

	function showRested() {
		session.current = null;
		clearStaff();
		showStaff(false);
		promptNameEl.hidden = true;
		promptEl.hidden = false;
		doneEl.hidden = false;

		var next = null;
		Object.keys(store.items).forEach(function (id) {
			var due = store.items[id].due;
			if (ITEMS[id] && due !== null && (next === null || due < next)) next = due;
		});

		var when = 'Nothing is waiting.';
		if (next !== null) {
			var hours = Math.max(1, Math.round((next - Date.now()) / 3600000));
			when = hours < 48
				? 'Next review in about ' + hours + ' hour' + (hours === 1 ? '' : 's') + '.'
				: 'Next review in about ' + Math.round(hours / 24) + ' days.';
		}
		doneEl.innerHTML = '<div class="htp-pp__donetitle">Caught up.</div>'
			+ '<div class="htp-pp__donetext">' + when
			+ ' Coming back then is worth more than pushing on now — spacing is what the schedule is for.</div>'
			+ (next === null ? ''
				: '<div><button type="button" class="btn btn-default btn-sm htp-pp__ahead">Practice anyway</button></div>');
		setFeedback('', '');
		updateHeader();

		var ahead = doneEl.querySelector('.htp-pp__ahead');
		if (ahead) ahead.addEventListener('click', function () {
			session.ahead = true;
			advance();
		});
	}

	function succeed() {
		var current = session.current;
		var latency = ((window.performance || Date).now()) - current.shownAt;
		var grade = current.missed ? AGAIN : gradeFor(current.item.type, true, latency);

		if (!current.missed) {
			applyGrade(current.id, grade, latency);
			journalAnswer(current, true, grade, latency);
			var label = grade === EASY ? 'Yes — quick.' : grade === HARD ? 'Yes.' : 'Yes.';
			setFeedback('good', label + ' <small>' + (latency / 1000).toFixed(1) + 's</small>');
		} else {
			/* The correction landed. The miss was already graded and journalled;
			 * recording this too would count one prompt twice. */
			setFeedback('good', 'That is the one. It will come back soon.');
		}

		session.lastType = current.item.type;
		session.lastClef = current.item.clef;
		session.answered++;
		current.phase = PHASE_DONE;
		updateHeader();

		window.setTimeout(function () {
			if (session.current === current) advance();
		}, FEEDBACK_MS);
	}

	function miss(played) {
		var current = session.current;
		if (!current.missed) {
			current.missed = true;
			var latency = ((window.performance || Date).now()) - current.shownAt;
			applyGrade(current.id, AGAIN, 0);
			/* The real latency goes to the journal even though the grade ignores
			 * it: a wrong answer that came back instantly is a guess, and one that
			 * took nine seconds is a genuine failure to retrieve. The scheduler
			 * treats them the same; the log should not. */
			journalAnswer(current, false, AGAIN, latency);
		}
		current.phase = PHASE_FIX;
		current.progress = 0;
		updateHeader();

		var target = current.item.sounds[current.item.type === 'step' ? 1 : 0];
		var clefId = current.item.clef;
		setFeedback('bad',
			'<div class="htp-pp__fixline">You played <b>' + nameOf(played) + '</b>.</div>'
			+ '<div class="htp-pp__fixline">It is ' + routeTo(target) + '.</div>'
			+ '<div class="htp-pp__fixhint">Play it now.</div>');

		if (clefId) {
			/* Show the miss on the staff, so you see the distance you were out by
			 * rather than just being told you were wrong. */
			var built = notation().buildNoteGlyph(clefId, played);
			if (built) {
				var ghost = $('<div class="symbol note visible htp-pp-note htp-pp-note--wrong"></div>')
					.css({ left: (current.item.type === 'step' ? STEP_RIGHT_PCT : SINGLE_LEFT_PCT) + '%' })
					.append(built.glyph.css('fill', ''));
				staffEl.append(ghost);
			}
		}
	}

	function onNoteOn(sound) {
		var current = session.current;
		if (!current || current.phase === PHASE_DONE) return;

		current.played.push(sound);

		var expected = current.item.sounds[current.progress];
		if (sound === expected) {
			current.progress++;
			if (current.progress >= current.item.sounds.length) succeed();
			else if (current.phase === PHASE_ASK)
				setFeedback('', 'Good — now the next one.');
			return;
		}

		if (current.phase === PHASE_FIX) {
			current.progress = 0;
			return;      /* already being corrected; just keep waiting for the right note */
		}
		miss(sound);
	}

	/*
	 * Session boundaries, for the record only — the scheduler does not use them.
	 * A session normally ends by closing the tab, which fires no onHide, so an
	 * "end" is a bonus rather than something a reader may rely on. The journal
	 * format says as much: derive sessions from gaps between answers, and treat
	 * these as confirmation.
	 */
	var sessionOpen = false;

	function markSessionStart() {
		var bridge = journal();
		if (!bridge || sessionOpen) return;
		sessionOpen = true;
		bridge.event({
			kind: 'session', action: 'start',
			stage: store.stage + 1,
			due: countDue(), learning: session.learning.length
		});
	}

	function markSessionEnd() {
		var bridge = journal();
		if (!bridge || !sessionOpen) return;
		sessionOpen = false;
		bridge.event({
			kind: 'session', action: 'end',
			stage: store.stage + 1,
			answers: session ? session.answered : 0
		});
		bridge.flush();
	}

	/* ============================================================= lifecycle */

	window.HTP.register({
		id: 'practice-path',
		title: 'Practice path',
		description: 'A step-by-step course that schedules itself around what you know.',

		init: function (el, api) {
			root = el;
			buildCurriculum();      /* before loadStore(), which prunes against it */
			buildUI(el);
			store = loadStore();
			session = newSession();

			api.onSettingChange(function (key) {
				if (!session || !session.current) return;
				if (key === 'lineMarkers' || key.indexOf('landmark') === 0
					|| key === 'colourNotes' || key.indexOf('showClef') === 0
					|| key === 'staffSize')
					present(session.current.id);
			});
			api.onMarkersChanged(function () {
				if (session && session.current && session.current.item.clef)
					renderScaffold(session.current.item.clef);
			});

			advance();
		},

		onShow: function (el, api) {
			if (session && !session.current) advance();
			markSessionStart();
			if (unsubscribe) return;
			unsubscribe = api.midi.subscribe(function (bytes) {
				var type = bytes[0] & 0xf0;
				if (type === 0x90 && bytes[2] > 0) onNoteOn(bytes[1]);
			});
		},

		onHide: function () {
			if (unsubscribe) { unsubscribe(); unsubscribe = null; }
			markSessionEnd();
		},

		onResize: function () {
			if (session && session.current && session.current.item.clef)
				present(session.current.id);
		}
	});
})(window, document);
