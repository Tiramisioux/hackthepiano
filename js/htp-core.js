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
	var portSubscribers = [];

	/*
	 * The function keys.
	 *
	 * A piano has no modifier keys, so the bottom octave is borrowed as a row of
	 * them: A0 up to G#1, twelve keys, one per pitch class. Nobody plays down
	 * there by accident. Hold one and what you play next is read as a command
	 * rather than as music, and the key you held is part of the command — it says
	 * which note the rest is measured from.
	 *
	 * That pairing is the point. One key alone could only name a thing; a key plus
	 * a chord can say "this chord, in this key", which is enough for a module to
	 * work out what you meant.
	 *
	 * Deliberately a framework rather than a feature: any module may listen, the
	 * range is configurable for keyboards shorter than 88 keys, and events still
	 * go out on the bus untouched so the keys light as usual. A module that cares
	 * asks isDown() and ignores what it would otherwise act on.
	 */
	var fnKey = {
		low: 21,                /* A0 — the bottom key of an 88-key piano */
		high: 32,               /* G#1 — twelve keys, one per pitch class */
		down: null,             /* which one is held, if any              */
		captured: [],
		listeners: [],          /* fired on release                       */
		watchers: []            /* fired on every note, while still held  */
	};

	function tellFnKey(list, command, held) {
		list.slice().forEach(function (fn) {
			try { fn(command, held); }
			catch (e) { console.error('[HTP] function-key listener failed', e); }
		});
	}

	function trackFunctionKey(bytes) {
		var type = bytes[0] & 0xf0;
		var note = bytes[1];
		var isOn = (type === 0x90 && bytes[2] > 0);
		var isOff = (type === 0x80 || (type === 0x90 && bytes[2] === 0));
		if (!isOn && !isOff) return;

		if (note >= fnKey.low && note <= fnKey.high) {
			if (isOn) {
				fnKey.down = note;
				fnKey.captured = [];
			} else if (fnKey.down === note) {
				var held = fnKey.down;
				var command = fnKey.captured.slice();
				fnKey.down = null;
				fnKey.captured = [];
				tellFnKey(fnKey.listeners, command, held);
			}
			return;
		}

		/* Everything struck while one is held belongs to the command, whether or
		 * not it is still down at release — that is what lets a chord be rolled
		 * rather than struck exactly together. */
		if (fnKey.down !== null && isOn && fnKey.captured.indexOf(note) === -1) {
			fnKey.captured.push(note);
			/* Reported as it is played, not only on release: a listener that can
			 * already tell what you meant should be free to act on the chord the
			 * moment it is down, rather than waiting for your hand to come off a
			 * key at the other end of the piano. */
			tellFnKey(fnKey.watchers, fnKey.captured.slice(), fnKey.down);
		}
	}

	/* Publish a raw MIDI byte array on the bus. `source` is 'virtual' for the
	 * on-screen keyboard and 'hardware' for a real input port. */
	function publish(bytes, source) {
		trackFunctionKey(bytes);
		busSubscribers.slice().forEach(function (fn) {
			try { fn(bytes, source); }
			catch (e) { console.error('[HTP] midi bus subscriber failed', e); }
		});
	}

	/* Announce that the set of input ports changed — something connected or
	 * disconnected — so UI that names the device can redraw. */
	function publishPortChange(event) {
		portSubscribers.slice().forEach(function (fn) {
			try { fn(midiState, event); }
			catch (e) { console.error('[HTP] midi port subscriber failed', e); }
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

		/* Kept on the wrapper rather than written straight onto the port: a
		 * device that disconnects and comes back is handed to us as the same
		 * port object with its handler cleared, and the tap has to be re-armed. */
		this.nativeHandler = function (event) {
			publish(event.data, 'hardware');
			fanout(self, event);
		};
		real.onmidimessage = this.nativeHandler;
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
		var adopters = [];
		var access;

		/* Rebuilt from the map rather than appended to, so a device that goes
		 * away and comes back is not listed twice. */
		function refreshNames() {
			midiState.hardwareInputs = [];
			inputs.forEach(function (port) {
				if (port !== virtualInput) midiState.hardwareInputs.push(port.name);
			});
		}

		/* Wrap a real input port — or re-arm one we already know — and tell
		 * everyone who asked to be told about ports. */
		function connectInput(real) {
			var known = inputs.get(real.id);
			if (known) {
				known.state = real.state;
				known.connection = real.connection;
				real.onmidimessage = known.nativeHandler;
				return known;
			}
			known = new MonitoredMIDIInput(real);
			inputs.set(real.id, known);
			adopters.slice().forEach(function (fn) {
				try { fn(known); }
				catch (e) { console.error('[HTP] MIDI port adopter failed', e); }
			});
			return known;
		}

		function disconnectInput(real) {
			var known = inputs.get(real.id);
			if (!known) return;
			known.state = 'disconnected';
			known.connection = 'closed';
			inputs.delete(real.id);
		}

		if (realAccess && realAccess.inputs && realAccess.inputs.forEach)
			realAccess.inputs.forEach(function (port) { connectInput(port); });
		inputs.set(virtualInput.id, virtualInput);
		refreshNames();

		access = {
			inputs: inputs,
			outputs: (realAccess && realAccess.outputs) || new Map(),
			sysexEnabled: !!(realAccess && realAccess.sysexEnabled),
			onstatechange: null,
			nativeAccess: realAccess || null,
			/* Non-standard, and the point of the whole wrapper: hardware that
			 * appears after load still has to reach the trainer. The callback
			 * runs once per port — for the ports present now, and again for
			 * every one that turns up later. */
			htpOnPortAdded: function (fn) {
				if (typeof fn !== 'function') return;
				adopters.push(fn);
				inputs.forEach(function (port) {
					if (port !== virtualInput) fn(port);
				});
			}
		};

		/* Hotplug. Without this the input list is a snapshot taken at load, and
		 * a Bluetooth piano is never in it: the browser only sees a BLE-MIDI
		 * port once the OS has finished connecting the device, which is long
		 * after the page asked for access. */
		if (realAccess && realAccess.addEventListener) {
			realAccess.addEventListener('statechange', function (event) {
				var port = event && event.port;
				if (port && port.type === 'input') {
					if (port.state === 'connected') connectInput(port);
					else disconnectInput(port);
					refreshNames();
				}
				if (typeof access.onstatechange === 'function') {
					try { access.onstatechange(event); }
					catch (e) { console.error('[HTP] onstatechange handler failed', e); }
				}
				publishPortChange(event);
			});
		}

		midi.access = access;
		return access;
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
		/* The wrapped MIDIAccess, once js/code.js has asked for it — the live
		 * input map, and `.nativeAccess` for the browser's own object. Handy
		 * when a device will not talk and you need to see what the browser
		 * actually has. */
		access: null,
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
		},
		/* Observe the device list itself. Handler receives (state, event).
		 * Returns an unsubscribe function. */
		onPortChange: function (fn) {
			portSubscribers.push(fn);
			return function () {
				var i = portSubscribers.indexOf(fn);
				if (i !== -1) portSubscribers.splice(i, 1);
			};
		}
	};

	/* ------------------------------------------------------------- settings */

	var SETTINGS_KEY = 'htp.settings';

	/* The two clefs the Treble/Bass switches govern. Alto and tenor are levels
	 * of their own and sit outside this pair — see clefChoice() below. */
	var GOVERNED_CLEFS = ['treble', 'bass'];

	/* App-wide preferences, persisted per browser. js/code.js reads
	 * settings.musicalClefDistance directly when it lays out the staves. */
	var settings = {
		musicalClefDistance: false,
		lineMarkers: false,
		colourKeys: false,
		colourNotes: false,
		quarterNotes: false,
		/* Sound is on by default: an on-screen piano that makes no sound is a
		 * strange thing, and nothing is audible until the first key is pressed
		 * anyway — which is the gesture that starts the audio. */
		pianoSound: true,
		/* Which clefs the exercises are to use — see clefChoice() below for how
		 * these two combine into a level's clef set. */
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
		/* Show the row of function keys under the keyboard. Off by default: it is
		 * an on-screen stand-in for keys a real piano already has, so most people
		 * never need it, and it costs vertical space that the keys themselves can
		 * use. A MIDI piano sends A0-G#1 whether this is on or not. */
		showFnKeys: false,
		/* Which landmarks are drawn, on the staff and on the keys alike. */
		landmarkC: true,
		landmarkF: true,
		landmarkG: true,
		/* The legend beside the clef: the letter of each line, and of each
		 * space. Off by default, like every other staff decoration. */
		legendLines: false,
		legendSpaces: false,
		/* Light up the key the exercise is waiting for, on the on-screen
		 * keyboard. Off by default: it turns reading into a lookup. It is for
		 * the other half of the skill — the note you see and where your hand
		 * goes — which is hard to practise from a screen alone. */
		showKeyHint: false,
		/* How fast the note trainer's notes travel, as a percentage of the
		 * original 35px/s. */
		scrollSpeed: 100
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
		/*
		 * Which clefs the exercises are to use.
		 *
		 * The Treble and Bass switches are the user's answer to "one clef or
		 * two": with one on, a level runs entirely in that clef on a single
		 * staff; with both on, a level uses the clef sets it lists of its own.
		 * The options bar keeps at least one on, so the fallback here is only
		 * for a settings store that predates that rule.
		 *
		 * Alto and tenor are not in this set. They are levels of their own, not
		 * one of the two clefs these switches govern.
		 */
		clefChoice: function () {
			var on = GOVERNED_CLEFS.filter(function (id) {
				return settings['showClef' + id.charAt(0).toUpperCase() + id.slice(1)] !== false;
			});
			return on.length ? on : GOVERNED_CLEFS.slice();
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
		/*
		 * The function key — one piano key borrowed as a modifier.
		 *   HTP.fnKey.onCommand(function (sounds) { ... });   // fired on release
		 *   HTP.fnKey.isDown();                               // ignore notes if true
		 *   HTP.fnKey.setNote(36);                            // for shorter keyboards
		 */
		/*
		 * The function keys — the bottom octave borrowed as modifiers.
		 *   HTP.fnKey.onCommand(function (sounds, fnNote) { ... });  // on release
		 *   HTP.fnKey.isDown();          // true while one is held: ignore the notes
		 *   HTP.fnKey.held();            // which one, or null
		 *   HTP.fnKey.setRange(36, 47);  // for shorter keyboards
		 */
		fnKey: {
			isDown: function () { return fnKey.down !== null; },
			held: function () { return fnKey.down; },
			range: function () { return { low: fnKey.low, high: fnKey.high }; },
			setRange: function (low, high) { fnKey.low = low; fnKey.high = high; },
			onCommand: function (fn) { fnKey.listeners.push(fn); },
			/* Every note, while the key is still held. Use this to act the instant
			 * the notes say enough; onCommand is the backstop on release. */
			onChange: function (fn) { fnKey.watchers.push(fn); }
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
