/*
 * js/htp-audio.js — optional piano tone for whatever you play.
 *
 * It listens on the HTP.midi bus rather than to the on-screen keyboard, so one
 * subscription covers every source at once: taps on the on-screen keys, the
 * computer-keyboard mapping, and a real MIDI piano.
 *
 * The tone is synthesised rather than sampled. A sample set good enough to be
 * worth the download would be megabytes; this is a few hundred lines of maths
 * that loads instantly and is recognisably a piano — which is all it needs to
 * be, since the point is to hear WHICH note you played, not to perform with it.
 *
 * What makes it read as a piano rather than an organ:
 *   - a hammer-like envelope: near-instant attack, then continuous decay. A
 *     piano has no true sustain level; holding a key only slows the decay.
 *   - a lowpass filter that closes as the note rings, because the high partials
 *     of a real string die away first.
 *   - slightly stretched upper partials. Real strings are stiff, so their
 *     overtones sit a little sharp of exact multiples, and two strings per note
 *     are tuned fractionally apart — that beating is most of the warmth.
 */
(function () {
	'use strict';

	/*
	 * Partials of one note. `ratio` is a multiple of the fundamental: the
	 * fractional ones are deliberate, that inharmonicity is what stops the tone
	 * sounding like an organ pipe.
	 */
	var PARTIALS = [
		{ ratio: 1.00, type: 'triangle', gain: 1.00, detune:  0 },
		{ ratio: 1.00, type: 'sine',     gain: 0.55, detune: -5 },  /* second string */
		{ ratio: 2.00, type: 'sine',     gain: 0.34, detune:  0 },
		{ ratio: 3.01, type: 'sine',     gain: 0.14, detune:  0 },
		{ ratio: 4.03, type: 'sine',     gain: 0.07, detune:  0 },
		{ ratio: 5.06, type: 'sine',     gain: 0.035, detune: 0 }
	];

	var MAX_VOICES = 16;        /* ten fingers, plus room for the tails */
	var RELEASE_SECONDS = 0.28;

	var ctx = null;
	var master = null;
	var meter = null;           /* taps the master bus, for level() */
	var voices = {};            /* midi note -> voice */
	var voiceOrder = 0;

	function enabled() {
		return !window.HTP || !window.HTP.settings
			|| window.HTP.settings.pianoSound !== false;
	}

	function frequency(note) {
		return 440 * Math.pow(2, (note - 69) / 12);
	}

	/*
	 * Built on first use, never before: browsers refuse to start audio outside a
	 * user gesture, and the first note played is always inside one.
	 */
	function audio() {
		if (ctx) {
			/* Safari suspends the context when the tab loses focus. */
			if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
			return ctx;
		}

		var Ctor = window.AudioContext || window.webkitAudioContext;
		if (!Ctor) return null;

		try {
			ctx = new Ctor();
		} catch (e) {
			console.warn('[HTP] no Web Audio, piano sound unavailable:', e);
			return null;
		}

		/* A held chord is several voices at once; the compressor keeps that from
		 * clipping without having to make single notes quiet. */
		var compressor = ctx.createDynamicsCompressor();
		compressor.threshold.value = -18;
		compressor.ratio.value = 6;
		compressor.attack.value = 0.003;
		compressor.release.value = 0.25;

		master = ctx.createGain();
		master.gain.value = 0.9;

		/* An analyser sitting on the master bus, so level() can report whether
		 * sound is actually coming out — useful when a browser has quietly
		 * refused to start the context. */
		meter = ctx.createAnalyser();
		meter.fftSize = 2048;

		master.connect(meter);
		meter.connect(compressor);
		compressor.connect(ctx.destination);

		if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
		return ctx;
	}

	function stopVoice(note, immediate) {
		var voice = voices[note];
		if (!voice) return;
		delete voices[note];

		var now = voice.ctx.currentTime;
		var tail = immediate ? 0.02 : RELEASE_SECONDS;
		try {
			var g = voice.amp.gain;
			g.cancelScheduledValues(now);
			/* Ramp from wherever the envelope had got to, so releasing a note
			 * never clicks. exponentialRamp cannot reach or pass through zero. */
			g.setValueAtTime(Math.max(g.value, 0.0001), now);
			g.exponentialRampToValueAtTime(0.0001, now + tail);
		} catch (e) { /* a stopped context; nothing to fade */ }

		voice.oscs.forEach(function (osc) {
			try { osc.stop(now + tail + 0.02); } catch (e) { /* already stopped */ }
		});
	}

	function reclaimOldestVoice() {
		var oldest = null;
		var oldestOrder = Infinity;
		Object.keys(voices).forEach(function (note) {
			if (voices[note].order < oldestOrder) {
				oldestOrder = voices[note].order;
				oldest = note;
			}
		});
		if (oldest !== null) stopVoice(parseInt(oldest, 10), true);
	}

	function startVoice(note, velocity) {
		var c = audio();
		if (!c) return;

		stopVoice(note, true);                       /* retrigger cleanly */
		if (Object.keys(voices).length >= MAX_VOICES) reclaimOldestVoice();

		var now = c.currentTime;
		var f = frequency(note);
		/* Velocity moves the level, but never to silence — a light touch on a
		 * touchscreen still reports whatever the keyboard decided to send. */
		var level = 0.16 * (0.4 + 0.6 * (velocity / 127));

		var amp = c.createGain();
		amp.gain.setValueAtTime(0.0001, now);
		amp.gain.exponentialRampToValueAtTime(level, now + 0.006);        /* hammer */
		amp.gain.exponentialRampToValueAtTime(level * 0.30, now + 0.9);   /* body   */
		amp.gain.exponentialRampToValueAtTime(level * 0.02, now + 6.0);   /* tail   */

		/* The brightness of a struck string fades faster than its volume. */
		var tone = c.createBiquadFilter();
		tone.type = 'lowpass';
		tone.Q.value = 0.6;
		tone.frequency.setValueAtTime(Math.min(f * 12, 14000), now);
		tone.frequency.exponentialRampToValueAtTime(Math.max(f * 2.2, 200), now + 1.6);

		var oscs = [];
		PARTIALS.forEach(function (partial) {
			var osc = c.createOscillator();
			osc.type = partial.type;
			osc.frequency.value = f * partial.ratio;
			if (partial.detune) osc.detune.value = partial.detune;

			var gain = c.createGain();
			/* Roll the top partials off for high notes, where they would land in
			 * the harsh part of the spectrum. */
			gain.gain.value = partial.gain * (f > 1200 && partial.ratio > 2 ? 0.4 : 1);

			osc.connect(gain);
			gain.connect(tone);
			osc.start(now);
			oscs.push(osc);
		});

		tone.connect(amp);
		amp.connect(master);

		voices[note] = { oscs: oscs, amp: amp, ctx: c, order: voiceOrder++ };
	}

	function allNotesOff(immediate) {
		Object.keys(voices).forEach(function (note) {
			stopVoice(parseInt(note, 10), immediate !== false);
		});
	}

	function start() {
		if (!window.HTP || !window.HTP.midi) return;

		window.HTP.midi.subscribe(function (bytes) {
			if (!bytes || bytes.length < 3) return;
			var status = bytes[0] & 0xf0;
			var note = bytes[1];
			var velocity = bytes[2];

			if (status === 0x90 && velocity > 0) {
				if (enabled()) startVoice(note, velocity);
				return;
			}
			/* Always release, even with sound switched off mid-note — otherwise
			 * whatever was ringing at that moment would ring forever. */
			if (status === 0x80 || (status === 0x90 && velocity === 0))
				stopVoice(note);
		});

		window.HTP.onSettingChange(function (key) {
			if (key === 'pianoSound' && !enabled()) allNotesOff(true);
		});

		window.addEventListener('blur', function () { allNotesOff(false); });

		window.HTP.audio = {
			allNotesOff: allNotesOff,
			enabled: enabled,
			/* Whether this browser can make sound at all, for the UI to reflect. */
			supported: !!(window.AudioContext || window.webkitAudioContext),
			/* Diagnostics. state() is the AudioContext's own — 'running' once a
			 * gesture has unlocked it, 'suspended' before that. */
			state: function () { return ctx ? ctx.state : 'none'; },
			voiceCount: function () { return Object.keys(voices).length; },
			/* RMS of the master bus right now, 0 when silent. */
			level: function () {
				if (!meter) return 0;
				var samples = new Float32Array(meter.fftSize);
				if (meter.getFloatTimeDomainData)
					meter.getFloatTimeDomainData(samples);
				else
					return 0;
				var sum = 0;
				for (var i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
				return Math.sqrt(sum / samples.length);
			}
		};
	}

	if (document.readyState === 'loading')
		document.addEventListener('DOMContentLoaded', start);
	else
		start();
})();
