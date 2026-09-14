/*
 * htp-core.js — HackThePiano module framework core.
 *
 * Loaded BEFORE js/code.js. Provides four things and touches no DOM:
 *
 *   1. Analytics shims.  js/code.js calls ga() unconditionally on every MIDI
 *      message, every level change and during MIDI init. When the inline GA
 *      snippet is stripped (ad blocker, tracking protection, offline dev) ga is
 *      undefined and those calls throw ReferenceError, which silently kills MIDI
 *      input. We define ga/fbq only when absent, so real analytics is never
 *      shadowed.
 *
 *   2. A virtual MIDI input port.  navigator.requestMIDIAccess is wrapped so
 *      every consumer — including the untouched js/code.js — sees an extra input
 *      port called "Virtual Keyboard". Anything sent through HTP.midi arrives
 *      there as a normal midimessage event, so the on-screen keyboard drives the
 *      note trainer through exactly the same code path as a real piano.
 *
 *   3. A monitoring tap on real ports.  Real hardware inputs are wrapped so that
 *      every incoming message is also published on the HTP bus before being
 *      handed to the consumer. That is what lets the on-screen keyboard light up
 *      the keys you press on an actual piano.
 *
 *   4. A module registry.  HTP.register() declares a module; js/htp-panes.js
 *      turns registered modules into tabbed / split panes.
 *
 * MIDI contract used by js/code.js (verified against js/code.js:1364-1385):
 *   event.data[0] = status byte  (0x90 note-on, 0x80 note-off)
 *   event.data[1] = note number  (21..108 == keyIndex 0..87, see getSound)
 *   event.data[2] = velocity     (note-on with velocity 0 counts as note-off)
 */
window.HTP = (function (window, document) {
	'use strict';

	/* ---------------------------------------------------------------- shims */

	window.ga = window.ga || function () {};
	window.fbq = window.fbq || function () {};

	/* ------------------------------------------------------------- midi bus */

	var busSubscribers = [];

	/* Publish a raw MIDI byte array on the bus. `source` is 'virtual' for the
	 * on-screen keyboard and 'hardware' for a real input port. */
	function publish(bytes, source) {
		busSubscribers.slice().forEach(function (fn) {
			try { fn(bytes, source); }
			catch (e) { console.error('[HTP] midi bus subscriber failed', e); }
		});
	}

	function now() {
		return (window.performance && window.performance.now)
			? window.performance.now()
			: 0;
	}

	/* --------------------------------------------------------- port wrappers */

	/* Shared behaviour for both port kinds: hold an onmidimessage property plus
	 * addEventListener handlers, and fan a message out to all of them. */
	function fanout(port, event) {
		if (typeof port.onmidimessage === 'function') {
			try { port.onmidimessage(event); }
			catch (e) { console.error('[HTP] onmidimessage handler failed', e); }
		}
		port._handlers.slice().forEach(function (handler) {
			try { handler(event); }
			catch (e) { console.error('[HTP] midimessage listener failed', e); }
		});
	}

	function makeEvent(port, bytes) {
		return {
			type: 'midimessage',
			data: (window.Uint8Array ? new Uint8Array(bytes) : bytes),
			receivedTime: now(),
			timeStamp: now(),
			target: port,
			currentTarget: port
		};
	}

	function definePortMethods(proto) {
		proto.open = function () { this.connection = 'open'; return Promise.resolve(this); };
		proto.close = function () { this.connection = 'closed'; return Promise.resolve(this); };
		proto.addEventListener = function (type, handler) {
			if (type === 'midimessage' && typeof handler === 'function')
				this._handlers.push(handler);
		};
		proto.removeEventListener = function (type, handler) {
			if (type !== 'midimessage') return;
			var i = this._handlers.indexOf(handler);
			if (i !== -1) this._handlers.splice(i, 1);
		};
	}

	/* The on-screen keyboard's port. */
	function VirtualMIDIInput(id, name) {
		this.id = id;
		this.type = 'input';
		this.name = name;
		this.manufacturer = 'HackThePiano';
		this.version = '1';
		this.state = 'connected';
		this.connection = 'open';
		this.onmidimessage = null;
		this._handlers = [];
	}
	definePortMethods(VirtualMIDIInput.prototype);
	VirtualMIDIInput.prototype.deliver = function (bytes) {
		fanout(this, makeEvent(this, bytes));
	};

	/* A real hardware port, tapped so the bus sees its traffic too. */
	function MonitoredMIDIInput(real) {
		var self = this;
		this.id = real.id;
		this.type = 'input';
		this.name = real.name;
		this.manufacturer = real.manufacturer;
		this.version = real.version;
		this.state = real.state;
		this.connection = real.connection;
		this.onmidimessage = null;
		this._handlers = [];
		this.nativePort = real;

		real.onmidimessage = function (event) {
			publish(event.data, 'hardware');
			fanout(self, event);
		};
	}
	definePortMethods(MonitoredMIDIInput.prototype);

	var virtualInput = new VirtualMIDIInput('htp-virtual-keyboard', 'Virtual Keyboard');

	/* ---------------------------------------------------- requestMIDIAccess */

	var midiState = {
		supported: !!navigator.requestMIDIAccess,
		granted: false,
		hardwareInputs: [],
		error: null
	};

	/*
	 * Build a MIDIAccess-like object whose `inputs` is a Map of [id, port]
	 * pairs — the shape js/code.js iterates with
	 * `for (var entry of midiAccess.inputs)` and then reads as `entry[1]`.
	 */
	function makeAccess(realAccess) {
		var inputs = new Map();
		if (realAccess && realAccess.inputs && realAccess.inputs.forEach) {
			realAccess.inputs.forEach(function (port, id) {
				inputs.set(id, new MonitoredMIDIInput(port));
				midiState.hardwareInputs.push(port.name);
			});
		}
		inputs.set(virtualInput.id, virtualInput);

		return {
			inputs: inputs,
			outputs: (realAccess && realAccess.outputs) || new Map(),
			sysexEnabled: !!(realAccess && realAccess.sysexEnabled),
			onstatechange: null,
			nativeAccess: realAccess || null
		};
	}

	var nativeRequestMIDIAccess = navigator.requestMIDIAccess
		? navigator.requestMIDIAccess.bind(navigator)
		: null;

	navigator.requestMIDIAccess = function (options) {
		if (!nativeRequestMIDIAccess) {
			/* No Web MIDI in this browser: hand back a virtual-only access object
			 * so the trainer still works with the on-screen keyboard. */
			midiState.error = 'Web MIDI API not available in this browser';
			return Promise.resolve(makeAccess(null));
		}
		return nativeRequestMIDIAccess(options).then(function (access) {
			midiState.granted = true;
			return makeAccess(access);
		}, function (err) {
			/* Permission denied or no devices: degrade to virtual-only rather than
			 * rejecting, so the on-screen keyboard keeps working. */
			midiState.error = String(err && err.message ? err.message : err);
			console.warn('[HTP] real MIDI unavailable, using on-screen keyboard only:', midiState.error);
			return makeAccess(null);
		});
	};

	var midi = {
		port: virtualInput,
		state: midiState,
		/* Send from the on-screen keyboard. */
		send: function (bytes) {
			virtualInput.deliver(bytes);
			publish(bytes, 'virtual');
		},
		noteOn: function (note, velocity) {
			this.send([0x90, note & 0x7f, velocity === undefined ? 0x64 : (velocity & 0x7f)]);
		},
		noteOff: function (note) {
			this.send([0x80, note & 0x7f, 0x00]);
		},
		/* Observe ALL note traffic — on-screen and real hardware alike.
		 * Handler receives (bytes, source) where source is 'virtual' | 'hardware'.
		 * Returns an unsubscribe function. */
		subscribe: function (fn) {
			busSubscribers.push(fn);
			return function () {
				var i = busSubscribers.indexOf(fn);
				if (i !== -1) busSubscribers.splice(i, 1);
			};
		}
	};

	/* ------------------------------------------------------------- settings */

	var SETTINGS_KEY = 'htp.settings';

	/* App-wide preferences, persisted per browser. js/code.js reads
	 * settings.musicalClefDistance directly when it lays out the staves. */
	var settings = {
		musicalClefDistance: false,
		lineMarkers: false,
		colourKeys: false,
		colourNotes: false,
		/* Each clef can be hidden on its own. */
		showClefTreble: true,
		showClefBass: true,
		showNoteNames: false,
		keyNames: false,
		/* Whether the note-name readout spells "C4" or just "C". */
		octaveNumbers: true,
		/* Staff size in px. Everything on a staff is sized in em off this, so it
		 * scales the notation as a unit — clefs, noteheads, markers and spacing
		 * alike. 75 is 1.5x the original stylesheet's 50. Being a px value it
		 * also scales with the browser's own zoom, like the rest of the layout. */
		staffSize: 75,
		/* Which landmarks are drawn, on the staff and on the keys alike. */
		landmarkC: true,
		landmarkF: true,
		landmarkG: true
	};

	/* Landmark palette, taken from the piano-roll project's "lesson" theme.
	 * C, F and G are the three landmarks you navigate the staff by. */
	var landmarks = {
		C: { step: 0, colour: '#F2921D' },
		F: { step: 3, colour: '#EC008C' },
		G: { step: 4, colour: '#1CA5E0' }
	};

	/* Register shading: the middle octave keeps the palette colour, octaves below
	 * middle C get progressively darker and octaves above progressively brighter,
	 * so pitch height reads as colour value on both the keyboard and the staff. */
	var MIDDLE_OCTAVE = 4;
	var OCTAVE_SHADE_STEP = 0.13;
	var OCTAVE_SHADE_LIMIT = 0.55;

	/* amount < 0 darkens towards black, amount > 0 lightens towards white. */
	function shade(hex, amount) {
		var match = /^#?([0-9a-f]{6})$/i.exec(hex);
		if (!match || !amount) return hex;
		var value = parseInt(match[1], 16);
		var channels = [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
		return '#' + channels.map(function (c) {
			var mixed = amount >= 0 ? c + (255 - c) * amount : c * (1 + amount);
			mixed = Math.max(0, Math.min(255, Math.round(mixed)));
			return ('0' + mixed.toString(16)).slice(-2);
		}).join('');
	}

	function octaveShade(octave) {
		var amount = (octave - MIDDLE_OCTAVE) * OCTAVE_SHADE_STEP;
		return Math.max(-OCTAVE_SHADE_LIMIT, Math.min(OCTAVE_SHADE_LIMIT, amount));
	}

	try {
		var stored = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || '{}');
		Object.keys(settings).forEach(function (key) {
			if (typeof stored[key] === typeof settings[key]) settings[key] = stored[key];
		});
	} catch (e) { /* private mode / corrupt value: keep the defaults */ }

	var settingListeners = [];
	var markerListeners = [];

	function setSetting(key, value) {
		settings[key] = value;
		try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
		catch (e) { /* non-fatal */ }
		settingListeners.slice().forEach(function (fn) {
			try { fn(key, value); }
			catch (e) { console.error('[HTP] setting listener failed', e); }
		});
	}

	/* ------------------------------------------------------ module registry */

	var modules = [];
	var modulesById = {};

	/*
	 * Register a module. Call this from a file loaded after js/htp-core.js and
	 * before js/htp-panes.js — see js/modules/ for the reference implementation.
	 *
	 *   HTP.register({
	 *     id:          'midi-monitor',         // required, unique, kebab-case
	 *     title:       'MIDI monitor',         // required, shown on the tab
	 *     description: 'Live MIDI messages.',  // optional, tab tooltip
	 *     staticPane:  false,                  // true when the pane markup is
	 *                                          // already present in index.html
	 *     init:     function (root, api) {},   // once, before the first show
	 *     onShow:   function (root, api) {},   // each time the pane appears
	 *     onHide:   function (root, api) {},   // each time the pane is hidden
	 *     onResize: function (root, api) {}    // pane size changed
	 *   });
	 *
	 * `root` is the module's own <section class="htp-pane"> element.
	 * `api`  is the HTP object.
	 */
	function register(def) {
		if (!def || !def.id)
			throw new Error('[HTP] register() requires an id');
		if (modulesById[def.id])
			throw new Error('[HTP] duplicate module id: ' + def.id);

		var module = {
			id: def.id,
			title: def.title || def.id,
			description: def.description || '',
			staticPane: !!def.staticPane,
			init: def.init || null,
			onShow: def.onShow || null,
			onHide: def.onHide || null,
			onResize: def.onResize || null,
			initialised: false,
			root: null
		};
		modules.push(module);
		modulesById[def.id] = module;
		return module;
	}

	return {
		version: '1.0.0',
		register: register,
		modules: function () { return modules.slice(); },
		module: function (id) { return modulesById[id] || null; },
		midi: midi,
		settings: settings,
		landmarks: landmarks,
		shade: shade,
		octaveShade: octaveShade,
		/* Is this landmark switched on? Applies to both surfaces. */
		landmarkEnabled: function (name) {
			return settings['landmark' + name] !== false;
		},
		/* Is this clef switched on? Clefs with no setting of their own — alto,
		 * tenor — are always on. */
		clefEnabled: function (clefId) {
			if (!clefId) return true;
			var key = 'showClef' + clefId.charAt(0).toUpperCase() + clefId.slice(1);
			return settings[key] !== false;
		},
		/* Landmark for a pitch class (0 = C), or null. Pass an octave to get the
		 * register-shaded colour rather than the flat palette one. */
		landmarkForPitchClass: function (pitchClass, octave) {
			var names = Object.keys(landmarks);
			for (var i = 0; i < names.length; i++) {
				/* Semitone offset of this landmark's diatonic step (C D E F G A B). */
				var semitones = [0, 2, 4, 5, 7, 9, 11][landmarks[names[i]].step];
				if (semitones !== pitchClass) continue;
				if (settings['landmark' + names[i]] === false) return null;
				var base = landmarks[names[i]].colour;
				return {
					name: names[i],
					colour: octave === undefined ? base : shade(base, octaveShade(octave)),
					baseColour: base
				};
			}
			return null;
		},
		setSetting: setSetting,
		onSettingChange: function (fn) { settingListeners.push(fn); },
		/* js/code.js calls notifyMarkersChanged() whenever it redraws its own
		 * landmark layer, so modules that render their own staves can follow. */
		onMarkersChanged: function (fn) { markerListeners.push(fn); },
		notifyMarkersChanged: function () {
			markerListeners.slice().forEach(function (fn) {
				try { fn(); }
				catch (e) { console.error('[HTP] marker listener failed', e); }
			});
		}
	};
})(window, document);
