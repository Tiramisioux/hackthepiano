/*
 * scales — pick a scale and see it in three places at once: on the grand staff,
 * and under both hands on the keyboard with its fingering.
 *
 * The three views are the point. A scale you have only read is not a scale you
 * can play, and a shape your fingers know but your eye cannot find on a staff is
 * not one you can sight-read. Showing the notation, the keys and the fingering
 * together is what ties the three together.
 *
 * Hands are an octave apart, as they are practised: the left hand plays the
 * scale from its root, the right hand plays the same scale from the root an
 * octave above. The note where the two octaves meet belongs to both, so that key
 * carries two finger numbers.
 *
 * Fingerings are taken verbatim from pianoscales.org, ascending, one octave.
 * They are NOT derived — scale fingering is convention, not arithmetic, and a
 * rule that produced most of them would produce a handful of wrong ones.
 */
(function (window, document) {
	'use strict';

	/*
	 * Scale groups, from pianoscales.org. Each group is a step pattern plus the
	 * twelve roots that use it; the notes follow from root + steps, so the only
	 * thing transcribed by hand is the fingering.
	 *
	 * `steps`   semitones above the root
	 * `letters` letter-steps above the root's letter, which is what decides
	 *           spelling: a scale uses each letter it touches once, so degree n
	 *           is letter (root + letters[n]) mod 7. That is why B-flat major's
	 *           fourth is E-flat and never D-sharp.
	 * `letter`  the root's own letter, C D E F G A B = 0..6
	 *
	 * Blues, jazz and exotic are not here. The blues page carries no fingering at
	 * all, and its flat fifth needs double flats in several keys — E-flat blues
	 * wants B-double-flat — which this notation cannot spell. Wrong notes on a
	 * staff are worse than a missing scale.
	 */
	var L = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
	var B4_DIATONIC = 34;              /* shift 0 on the treble staff */
	/* Tried in this order: a natural spelling wins when the letter is already
	 * right, so only degrees that genuinely need an accidental get one. */
	var SPELLINGS = ['natural', 'sharp', 'flat'];

	/*
	 * All seven modes are here, but two of them answer to older names: Ionian IS
	 * the major scale and Aeolian IS the natural minor — same notes, same
	 * fingering, same everything. They are labelled with both so the modal set
	 * reads as complete rather than looking two short, and so nobody goes looking
	 * for an Ionian group that would only duplicate Major.
	 */
	var GROUPS = [
		{
			id: 'major', name: 'Major (Ionian)',
			steps: [0, 2, 4, 5, 7, 9, 11, 12], letters: [0, 1, 2, 3, 4, 5, 6, 7],
			scales: [
				{ name: 'C major',  pc: 0,  letter: L.C, rh: [1,2,3,1,2,3,4,5], lh: [5,4,3,2,1,3,2,1] },
				{ name: 'D♭ major', pc: 1,  letter: L.D, rh: [2,3,1,2,3,4,1,2], lh: [3,2,1,4,3,2,1,3] },
				{ name: 'D major',  pc: 2,  letter: L.D, rh: [1,2,3,1,2,3,4,5], lh: [5,4,3,2,1,3,2,1] },
				{ name: 'E♭ major', pc: 3,  letter: L.E, rh: [3,1,2,3,4,1,2,3], lh: [3,2,1,4,3,2,1,3] },
				{ name: 'E major',  pc: 4,  letter: L.E, rh: [1,2,3,1,2,3,4,5], lh: [5,4,3,2,1,3,2,1] },
				{ name: 'F major',  pc: 5,  letter: L.F, rh: [1,2,3,4,1,2,3,4], lh: [5,4,3,2,1,3,2,1] },
				{ name: 'G♭ major', pc: 6,  letter: L.G, rh: [2,3,4,1,2,3,1,2], lh: [4,3,2,1,3,2,1,4] },
				{ name: 'G major',  pc: 7,  letter: L.G, rh: [1,2,3,1,2,3,4,5], lh: [5,4,3,2,1,3,2,1] },
				{ name: 'A♭ major', pc: 8,  letter: L.A, rh: [3,4,1,2,3,1,2,3], lh: [3,2,1,4,3,2,1,3] },
				{ name: 'A major',  pc: 9,  letter: L.A, rh: [1,2,3,1,2,3,4,5], lh: [5,4,3,2,1,3,2,1] },
				{ name: 'B♭ major', pc: 10, letter: L.B, rh: [2,1,2,3,1,2,3,4], lh: [3,2,1,4,3,2,1,3] },
				{ name: 'B major',  pc: 11, letter: L.B, rh: [1,2,3,1,2,3,4,5], lh: [4,3,2,1,4,3,2,1] }
			]
		},
		{
			id: 'minor', name: 'Natural minor (Aeolian)',
			steps: [0, 2, 3, 5, 7, 8, 10, 12], letters: [0, 1, 2, 3, 4, 5, 6, 7],
			scales: [
				{ name: 'A minor',  pc: 9,  letter: L.A, rh: [1,2,3,1,2,3,4,5], lh: [5,4,3,2,1,3,2,1] },
				{ name: 'B♭ minor', pc: 10, letter: L.B, rh: [2,1,2,3,1,2,3,4], lh: [2,1,3,2,1,4,3,2] },
				{ name: 'B minor',  pc: 11, letter: L.B, rh: [1,2,3,1,2,3,4,5], lh: [4,3,2,1,4,3,2,1] },
				{ name: 'C minor',  pc: 0,  letter: L.C, rh: [1,2,3,1,2,3,4,5], lh: [5,4,3,2,1,3,2,1] },
				{ name: 'C♯ minor', pc: 1,  letter: L.C, rh: [3,4,1,2,3,1,2,3], lh: [3,2,1,4,3,2,1,3] },
				{ name: 'D minor',  pc: 2,  letter: L.D, rh: [1,2,3,1,2,3,4,5], lh: [5,4,3,2,1,3,2,1] },
				{ name: 'E♭ minor', pc: 3,  letter: L.E, rh: [3,1,2,3,4,1,2,3], lh: [2,1,4,3,2,1,3,2] },
				{ name: 'E minor',  pc: 4,  letter: L.E, rh: [1,2,3,1,2,3,4,5], lh: [5,4,3,2,1,3,2,1] },
				{ name: 'F minor',  pc: 5,  letter: L.F, rh: [1,2,3,4,1,2,3,4], lh: [5,4,3,2,1,3,2,1] },
				{ name: 'F♯ minor', pc: 6,  letter: L.F, rh: [2,3,1,2,3,1,2,3], lh: [4,3,2,1,3,2,1,4] },
				{ name: 'G minor',  pc: 7,  letter: L.G, rh: [1,2,3,1,2,3,4,5], lh: [5,4,3,2,1,3,2,1] },
				{ name: 'G♯ minor', pc: 8,  letter: L.G, rh: [3,4,1,2,3,1,2,3], lh: [3,2,1,3,2,1,4,3] }
			]
		},
		{
			id: 'majpent', name: 'Major pentatonic',
			steps: [0, 2, 4, 7, 9, 12], letters: [0, 1, 2, 4, 5, 7],
			scales: [
				{ name: 'C major pentatonic',  pc: 0,  letter: L.C, rh: [1,2,1,2,3,5], lh: [3,2,1,3,2,1] },
				{ name: 'D♭ major pentatonic', pc: 1,  letter: L.D, rh: [2,3,1,2,3,4], lh: [3,2,1,4,3,2] },
				{ name: 'D major pentatonic',  pc: 2,  letter: L.D, rh: [1,2,3,1,2,4], lh: [2,1,3,2,1,2] },
				{ name: 'E♭ major pentatonic', pc: 3,  letter: L.E, rh: [2,1,2,3,1,2], lh: [3,2,1,2,1,3] },
				{ name: 'E major pentatonic',  pc: 4,  letter: L.E, rh: [1,2,3,1,2,3], lh: [4,3,2,1,2,1] },
				{ name: 'F major pentatonic',  pc: 5,  letter: L.F, rh: [1,2,3,1,2,4], lh: [3,2,1,2,1,3] },
				{ name: 'G♭ major pentatonic', pc: 6,  letter: L.G, rh: [1,2,3,1,2,3], lh: [3,2,1,3,2,1] },
				{ name: 'G major pentatonic',  pc: 7,  letter: L.G, rh: [1,2,3,1,2,4], lh: [3,2,1,2,1,3] },
				{ name: 'A♭ major pentatonic', pc: 8,  letter: L.A, rh: [2,3,1,2,1,2], lh: [3,2,1,2,1,3] },
				{ name: 'A major pentatonic',  pc: 9,  letter: L.A, rh: [1,2,3,1,2,1], lh: [2,1,2,1,3,2] },
				{ name: 'B♭ major pentatonic', pc: 10, letter: L.B, rh: [3,1,2,1,2,3], lh: [3,2,1,2,1,3] },
				{ name: 'B major pentatonic',  pc: 11, letter: L.B, rh: [1,2,3,4,5,1], lh: [1,5,4,3,2,1] }
			]
		},
		{
			id: 'minpent', name: 'Minor pentatonic',
			steps: [0, 3, 5, 7, 10, 12], letters: [0, 2, 3, 4, 6, 7],
			scales: [
				{ name: 'A minor pentatonic',  pc: 9,  letter: L.A, rh: [1,2,3,1,2,3], lh: [3,2,1,3,2,1] },
				{ name: 'B♭ minor pentatonic', pc: 10, letter: L.B, rh: [2,3,4,1,2,3], lh: [4,3,2,1,4,3] },
				{ name: 'B minor pentatonic',  pc: 11, letter: L.B, rh: [2,1,2,3,1,2], lh: [3,2,1,3,2,1] },
				{ name: 'C minor pentatonic',  pc: 0,  letter: L.C, rh: [1,2,3,1,2,3], lh: [1,3,2,1,2,1] },
				{ name: 'C♯ minor pentatonic', pc: 1,  letter: L.C, rh: [2,1,2,3,1,2], lh: [2,1,3,2,1,2] },
				{ name: 'D minor pentatonic',  pc: 2,  letter: L.D, rh: [1,2,3,1,2,3], lh: [3,2,1,3,2,1] },
				{ name: 'E♭ minor pentatonic', pc: 3,  letter: L.E, rh: [1,2,3,1,2,3], lh: [3,2,1,3,2,1] },
				{ name: 'E minor pentatonic',  pc: 4,  letter: L.E, rh: [1,2,3,1,2,3], lh: [3,2,1,3,2,1] },
				{ name: 'F minor pentatonic',  pc: 5,  letter: L.F, rh: [1,2,3,1,2,3], lh: [4,3,2,1,2,1] },
				{ name: 'F♯ minor pentatonic', pc: 6,  letter: L.F, rh: [2,1,2,3,1,2], lh: [3,2,1,2,1,3] },
				{ name: 'G minor pentatonic',  pc: 7,  letter: L.G, rh: [1,2,1,2,3,1], lh: [1,3,2,1,2,1] },
				{ name: 'G♯ minor pentatonic', pc: 8,  letter: L.G, rh: [2,1,2,3,4,5], lh: [2,1,5,4,3,2] }
			]
		}
,
		{
			id: 'blues', derived: true, suffix: 'blues', name: 'Blues', fingered: false,
			steps: [0, 3, 5, 6, 7, 10, 12], letters: [0, 2, 3, 4, 4, 6, 7],
			alt: { 3: 3 },
			scales: [
				{ name: 'C blues', pc: 0, letter: L.C },
				{ name: 'D♭ blues', pc: 1, letter: L.D },
				{ name: 'D blues', pc: 2, letter: L.D },
				{ name: 'E♭ blues', pc: 3, letter: L.E },
				{ name: 'E blues', pc: 4, letter: L.E },
				{ name: 'F blues', pc: 5, letter: L.F },
				{ name: 'G♭ blues', pc: 6, letter: L.G },
				{ name: 'G blues', pc: 7, letter: L.G },
				{ name: 'A♭ blues', pc: 8, letter: L.A },
				{ name: 'A blues', pc: 9, letter: L.A },
				{ name: 'B♭ blues', pc: 10, letter: L.B },
				{ name: 'B blues', pc: 11, letter: L.B }
			]
		},
		{
			id: 'dorian', derived: true, suffix: 'Dorian', name: 'Dorian', fingered: false,
			steps: [0, 2, 3, 5, 7, 9, 10, 12], letters: [0, 1, 2, 3, 4, 5, 6, 7],
			scales: [
				{ name: 'C Dorian', pc: 0, letter: L.C },
				{ name: 'D♭ Dorian', pc: 1, letter: L.D },
				{ name: 'D Dorian', pc: 2, letter: L.D },
				{ name: 'E♭ Dorian', pc: 3, letter: L.E },
				{ name: 'E Dorian', pc: 4, letter: L.E },
				{ name: 'F Dorian', pc: 5, letter: L.F },
				{ name: 'G♭ Dorian', pc: 6, letter: L.G },
				{ name: 'G Dorian', pc: 7, letter: L.G },
				{ name: 'A♭ Dorian', pc: 8, letter: L.A },
				{ name: 'A Dorian', pc: 9, letter: L.A },
				{ name: 'B♭ Dorian', pc: 10, letter: L.B },
				{ name: 'B Dorian', pc: 11, letter: L.B }
			]
		},
		{
			id: 'phrygian', derived: true, suffix: 'Phrygian', name: 'Phrygian', fingered: false,
			steps: [0, 1, 3, 5, 7, 8, 10, 12], letters: [0, 1, 2, 3, 4, 5, 6, 7],
			scales: [
				{ name: 'C Phrygian', pc: 0, letter: L.C },
				{ name: 'D♭ Phrygian', pc: 1, letter: L.D },
				{ name: 'D Phrygian', pc: 2, letter: L.D },
				{ name: 'E♭ Phrygian', pc: 3, letter: L.E },
				{ name: 'E Phrygian', pc: 4, letter: L.E },
				{ name: 'F Phrygian', pc: 5, letter: L.F },
				{ name: 'G♭ Phrygian', pc: 6, letter: L.G },
				{ name: 'G Phrygian', pc: 7, letter: L.G },
				{ name: 'A♭ Phrygian', pc: 8, letter: L.A },
				{ name: 'A Phrygian', pc: 9, letter: L.A },
				{ name: 'B♭ Phrygian', pc: 10, letter: L.B },
				{ name: 'B Phrygian', pc: 11, letter: L.B }
			]
		},
		{
			id: 'lydian', derived: true, suffix: 'Lydian', name: 'Lydian', fingered: false,
			steps: [0, 2, 4, 6, 7, 9, 11, 12], letters: [0, 1, 2, 3, 4, 5, 6, 7],
			scales: [
				{ name: 'C Lydian', pc: 0, letter: L.C },
				{ name: 'D♭ Lydian', pc: 1, letter: L.D },
				{ name: 'D Lydian', pc: 2, letter: L.D },
				{ name: 'E♭ Lydian', pc: 3, letter: L.E },
				{ name: 'E Lydian', pc: 4, letter: L.E },
				{ name: 'F Lydian', pc: 5, letter: L.F },
				{ name: 'G♭ Lydian', pc: 6, letter: L.G },
				{ name: 'G Lydian', pc: 7, letter: L.G },
				{ name: 'A♭ Lydian', pc: 8, letter: L.A },
				{ name: 'A Lydian', pc: 9, letter: L.A },
				{ name: 'B♭ Lydian', pc: 10, letter: L.B },
				{ name: 'B Lydian', pc: 11, letter: L.B }
			]
		},
		{
			id: 'mixolydian', derived: true, suffix: 'Mixolydian', name: 'Mixolydian', fingered: false,
			steps: [0, 2, 4, 5, 7, 9, 10, 12], letters: [0, 1, 2, 3, 4, 5, 6, 7],
			scales: [
				{ name: 'C Mixolydian', pc: 0, letter: L.C },
				{ name: 'D♭ Mixolydian', pc: 1, letter: L.D },
				{ name: 'D Mixolydian', pc: 2, letter: L.D },
				{ name: 'E♭ Mixolydian', pc: 3, letter: L.E },
				{ name: 'E Mixolydian', pc: 4, letter: L.E },
				{ name: 'F Mixolydian', pc: 5, letter: L.F },
				{ name: 'G♭ Mixolydian', pc: 6, letter: L.G },
				{ name: 'G Mixolydian', pc: 7, letter: L.G },
				{ name: 'A♭ Mixolydian', pc: 8, letter: L.A },
				{ name: 'A Mixolydian', pc: 9, letter: L.A },
				{ name: 'B♭ Mixolydian', pc: 10, letter: L.B },
				{ name: 'B Mixolydian', pc: 11, letter: L.B }
			]
		},
		{
			id: 'locrian', derived: true, suffix: 'Locrian', name: 'Locrian', fingered: false,
			steps: [0, 1, 3, 5, 6, 8, 10, 12], letters: [0, 1, 2, 3, 4, 5, 6, 7],
			scales: [
				{ name: 'C Locrian', pc: 0, letter: L.C },
				{ name: 'D♭ Locrian', pc: 1, letter: L.D },
				{ name: 'D Locrian', pc: 2, letter: L.D },
				{ name: 'E♭ Locrian', pc: 3, letter: L.E },
				{ name: 'E Locrian', pc: 4, letter: L.E },
				{ name: 'F Locrian', pc: 5, letter: L.F },
				{ name: 'G♭ Locrian', pc: 6, letter: L.G },
				{ name: 'G Locrian', pc: 7, letter: L.G },
				{ name: 'A♭ Locrian', pc: 8, letter: L.A },
				{ name: 'A Locrian', pc: 9, letter: L.A },
				{ name: 'B♭ Locrian', pc: 10, letter: L.B },
				{ name: 'B Locrian', pc: 11, letter: L.B }
			]
		}
	];

	var STORAGE_GROUP = 'htp.scales.group';
	var STORAGE_CHORDS = 'htp.scales.chords';

	/*
	 * Progressions per group, most common first.
	 *
	 * Degrees are 1-based positions in the SCALE, so they follow whatever root is
	 * chosen without further arithmetic — and a progression is therefore just a
	 * list of degrees plus a name, which is the same thing a chord exercise would
	 * need to ask you to play one.
	 *
	 * A mode's degrees are counted in the mode, which is easy to get wrong: in D
	 * Dorian the ii-V-I of C major is D, G and C — degrees 1, 4 and 7 of the
	 * Dorian scale, not 1, 5 and 7. Likewise G Mixolydian's is degrees 5, 1, 4.
	 */
	var PROGRESSIONS = {
		major: [
			{ label: 'I – IV – V',        degrees: [1, 4, 5] },
			{ label: 'I – V – vi – IV',   degrees: [1, 5, 6, 4] },
			{ label: 'ii – V – I',        degrees: [2, 5, 1] },
			{ label: 'I – vi – IV – V',   degrees: [1, 6, 4, 5] },
			{ label: 'vi – IV – I – V',   degrees: [6, 4, 1, 5] }
		],
		minor: [
			{ label: 'i – iv – v',          degrees: [1, 4, 5] },
			{ label: 'i – VI – III – VII',  degrees: [1, 6, 3, 7] },
			{ label: 'i – iv – VII',        degrees: [1, 4, 7] },
			{ label: 'ii° – v – i',         degrees: [2, 5, 1] }
		],
		blues: [
			{ label: 'I7 – IV7 – V7',        degrees: [1, 2, 3] },
			{ label: 'I7 – IV7 – I7 – V7',   degrees: [1, 2, 1, 3] }
		],
		dorian:     [{ label: 'ii – V – I', degrees: [1, 4, 7], note: 'Dorian is the ii' }],
		mixolydian: [{ label: 'ii – V – I', degrees: [5, 1, 4], note: 'Mixolydian is the V' }],
		lydian:     [{ label: 'I – II',     degrees: [1, 2], note: 'the raised fourth is the colour' }],
		phrygian:   [{ label: 'i – ♭II',    degrees: [1, 2], note: 'the flat second is the colour' }],
		locrian:    []
	};

	/* A blues is played on dominant sevenths built off the key, not on triads
	 * stacked out of its own six notes — the scale has no third to stack. */
	var BLUES_CHORDS = [
		{ numeral: 'I7',  degree: 1, offset: 0, intervals: [0, 4, 7, 10] },
		{ numeral: 'IV7', degree: 2, offset: 5, intervals: [0, 4, 7, 10] },
		{ numeral: 'V7',  degree: 3, offset: 7, intervals: [0, 4, 7, 10] }
	];

	var PC_OF_LETTER = [0, 2, 4, 5, 7, 9, 11];
	var LETTER_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

	/*
	 * Can this pitch class be written with this letter?
	 *
	 * Narrower than theory, because it describes the note table js/code.js
	 * actually has. A black key can be the sharp of the letter below or the flat
	 * of the letter above; F can also be E-sharp and B can also be C-flat; every
	 * other white key has only its own name. There is no F-flat and no B-sharp,
	 * and nothing anywhere is doubly altered.
	 *
	 * This is what decides how a root is spelled. D-flat Dorian needs F-flat for
	 * its third, which cannot be written — so that scale is C-sharp Dorian, which
	 * needs only single sharps and is the same seven keys.
	 */
	function spellable(pc, letter) {
		var delta = (((pc - PC_OF_LETTER[letter]) % 12) + 12) % 12;
		if (delta === 0) return true;                       /* natural        */
		if (delta === 1) return letter !== 2 && letter !== 6;   /* sharp: no E#/B# */
		if (delta === 11) return letter !== 0 && letter !== 3;  /* flat: no Cb/Fb as ROOTS of a letter that has none */
		return false;
	}

	/*
	 * The name of a note as it was DRAWN — from the letter its notehead was
	 * placed on, not from a fresh guess. Spell it independently and a G-flat on
	 * the staff can print as F-sharp, which is the one thing a scale reference
	 * must never do.
	 */
	function spelledName(sound, letter) {
		var name = rootName((((sound % 12) + 12) % 12), letter);
		return window.HTP.settings.octaveNumbers === false
			? name : name + (Math.floor(sound / 12) - 1);
	}

	/* How a root is written, given the letter chosen for it. */
	function rootName(pc, letter) {
		var delta = (((pc - PC_OF_LETTER[letter]) % 12) + 12) % 12;
		return LETTER_NAMES[letter] + (delta === 1 ? '♯' : delta === 11 ? '♭' : '');
	}

	/*
	 * Choose each root's spelling so that every degree of the scale can actually
	 * be written, and name it accordingly. Only groups that were generated rather
	 * than transcribed need this — the four taken from pianoscales.org carry their
	 * own names and spell cleanly already.
	 */
	function resolveSpellings() {
		GROUPS.forEach(function (group) {
			if (!group.derived) return;
			group.scales.forEach(function (scale) {
				var candidates = [scale.letter, (scale.letter + 6) % 7];
				for (var c = 0; c < candidates.length; c++) {
					var letter = candidates[c];
					if (!spellable(scale.pc, letter)) continue;
					var ok = group.steps.every(function (step, i) {
						var want = (letter + group.letters[i]) % 7;
						var alt = (group.alt && group.alt[i] !== undefined)
							? (letter + group.alt[i]) % 7 : null;
						var pc = (((scale.pc + step) % 12) + 12) % 12;
						return spellable(pc, want) || (alt !== null && spellable(pc, alt));
					});
					if (ok) {
						scale.letter = letter;
						scale.name = rootName(scale.pc, letter) + ' ' + group.suffix;
						return;
					}
				}
				scale.name = rootName(scale.pc, scale.letter) + ' ' + group.suffix;
			});
		});
	}
	var STORAGE_KEY = 'htp.scales.choice';

	/* Where the notes sit along the staff, in percent. Room at the left for the
	 * clef, room at the right so the last note is not against the edge. */
	var FIRST_PCT = 22, LAST_PCT = 92;
	var EXTRA_ROOM_EM = 0.2;

	var CLEFS = { rh: 'treble', lh: 'bass' };

	var root = null, groupEl = null, selectEl = null, readoutEl = null;
	var held = {};                  /* midi note -> true while down   */
	var heldOrder = [];             /* the same, in the order struck  */
	var staves = {};                /* 'rh' | 'lh' -> jQuery .staff  */
	var containers = {};
	var fingerRows = {};
	var nameRows = {};
	var unsubscribe = null;
	var current = null;             /* the scale being shown         */
	var sounding = {};              /* midi note -> true while held  */

	function notation() { return window.HTP.notation; }

	function chosenGroup() {
		var stored = parseInt(window.localStorage.getItem(STORAGE_GROUP), 10);
		return (stored >= 0 && stored < GROUPS.length) ? stored : 0;
	}
	function chosenIndex(groupIndex) {
		var stored = parseInt(window.localStorage.getItem(STORAGE_KEY + '.' + GROUPS[groupIndex].id), 10);
		return (stored >= 0 && stored < GROUPS[groupIndex].scales.length) ? stored : 0;
	}
	function selection() {
		var g = parseInt(groupEl.value, 10);
		return { group: GROUPS[g], groupIndex: g, index: parseInt(selectEl.value, 10) };
	}

	/* ------------------------------------------------------------- the scale */

	/*
	 * The eight notes of the scale for each hand, with the finger that plays
	 * each. The right hand's root sits an octave above the left's, so the two
	 * hands play the same degrees in parallel.
	 */
	/*
	 * Build the notehead whose LETTER is the one this degree must land on, by
	 * asking for each spelling in turn and keeping the one that lands there.
	 *
	 * The letter is read back off the shift the glyph was actually given, so this
	 * cannot drift from where the note is drawn — it is the same number the staff
	 * placed it by, not a parallel calculation that agrees with it today.
	 */
	function glyphForDegree(clefId, sound, wantLetter, altLetter) {
		var clefShift = notation().clefs[clefId].shift;
		var wanted = [wantLetter];
		/* A blues flat fifth is a double flat in several keys — E-flat blues wants
		 * B-double-flat — which this notation cannot spell. Those keys take the
		 * sharp-fourth spelling of the same key instead, which is how the scale is
		 * usually written anyway. */
		if (altLetter !== undefined && altLetter !== null) wanted.push(altLetter);

		for (var w = 0; w < wanted.length; w++)
			for (var i = 0; i < SPELLINGS.length; i++) {
				var built = notation().buildNoteGlyph(clefId, sound,
					notation().decorators[SPELLINGS[i]]);
				if (!built) continue;
				var diatonic = built.shift - clefShift + B4_DIATONIC;
				if (((diatonic % 7) + 7) % 7 === wanted[w])
					return built;
			}
		return notation().buildNoteGlyph(clefId, sound);
	}

	/* The lowest note at or above `from` with this pitch class. */
	function rootAtOrAbove(from, pc) {
		return from + ((((pc - from) % 12) + 12) % 12);
	}
	/* The highest note at or below `to` with this pitch class. */
	function rootAtOrBelow(to, pc) {
		return to - ((((to - pc) % 12) + 12) % 12);
	}

	/*
	 * The two hands sit in the outermost octaves of whatever the keyboard is
	 * showing: left hand in the far-left octave, right hand in the far-right.
	 * The keyboard's range control is therefore what sets the distance between
	 * the hands — widen the view and they move apart.
	 *
	 * "Octave" here means a C-to-B block, which is how the keys are labelled and
	 * how you count them looking at the thing. C2–B4 reads as three octaves, so
	 * the right hand belongs in the C4 block.
	 *
	 * An earlier version placed the right hand from the top MINUS an octave, so
	 * that its eighth note would land on a drawn key. That is defensible and it
	 * was wrong: on a three-octave range it put the right hand in the MIDDLE
	 * octave, one short of where the eye expects it. Better to let the closing
	 * note of the scale run a key past the end of the display than to move the
	 * whole hand somewhere it does not look like it belongs.
	 */
	function voicing(group, scale) {
		var seen = (window.HTP.keyboard && window.HTP.keyboard.visibleRange)
			? window.HTP.keyboard.visibleRange()
			: { low: 48, high: 84 };

		var firstBlock = rootAtOrAbove(seen.low, 0);        /* lowest C on screen */
		var lastBlock = rootAtOrBelow(seen.high - 11, 0);   /* start of the last full C-B block */
		if (lastBlock < firstBlock) lastBlock = firstBlock;

		var lhRoot = firstBlock + scale.pc;
		var rhRoot = lastBlock + scale.pc;
		/* Too narrow for two separate octaves: stack them rather than crossing
		 * the hands over, which would be nonsense to read and to play. */
		if (rhRoot <= lhRoot) rhRoot = lhRoot + 12;

		var notes = { rh: [], lh: [] };
		group.steps.forEach(function (step, i) {
			var letter = (scale.letter + group.letters[i]) % 7;
			var alt = (group.alt && group.alt[i] !== undefined)
				? (scale.letter + group.alt[i]) % 7 : null;
			/* Groups taken from a page that gives no fingering carry none. */
			var rhFinger = scale.rh ? scale.rh[i] : null;
			var lhFinger = scale.lh ? scale.lh[i] : null;
			notes.rh.push({ sound: rhRoot + step, finger: rhFinger, letter: letter, altLetter: alt });
			notes.lh.push({ sound: lhRoot + step, finger: lhFinger, letter: letter, altLetter: alt });
		});
		return notes;
	}

	/* --------------------------------------------------------------- staves */

	function buildStaves(el) {
		var container = $('<div class="staffsContainer htp-scales__staves"></div>');

		['rh', 'lh'].forEach(function (hand) {
			var staff = $('<div class="staff"></div>').append('<div class="lines"></div>');
			var box = $('<div class="staffContainer"></div>').append(staff);
			/* The fingering lives in its own row rather than inside the note
			 * symbols. A symbol is a 200em-tall box clipped by the staff
			 * container, so anything hung below a notehead is cut off; and its
			 * `em` is the staff size, which makes a small label's own offsets
			 * resolve against the wrong number. A sibling row has neither
			 * problem, and lines up because it is exactly as wide as the staff. */
			var fingers = $('<div class="htp-scales__fingers"></div>');
			/* A second row under the fingering, for the name of a single note
			 * while you hold it — under the note itself, in its own clef, rather
			 * than in the middle of the pane where it says nothing about which
			 * hand played it. */
			var names = $('<div class="htp-scales__names"></div>');
			container.append(box).append(fingers).append(names);
			staves[hand] = staff;
			containers[hand] = box;
			fingerRows[hand] = fingers;
			nameRows[hand] = names;
			notation().renderStaffLines(staff);
		});

		$(el).find('.htp-scales__notation').prepend(container);
	}

	/*
	 * Put the ledger lines through the middle of the notehead.
	 *
	 * Measured rather than calculated, because the two things being lined up do
	 * not share a frame of reference. The ledger SVG carries its own width and is
	 * anchored to the symbol; the notehead sits wherever its glyph's artwork puts
	 * it, and a glyph with an accidental baked in front of the head puts it
	 * somewhere else again. One constant lines up the naturals and leaves every
	 * sharp and flat 19px out — which is exactly what it did.
	 *
	 * So: read where the stroke actually paints, read where the head actually
	 * paints, close the gap. Right for any glyph, any accidental, any staff size,
	 * because it assumes nothing about them.
	 */
	/*
	 * Put the fingering and the note name directly under the notehead.
	 *
	 * Both rows place their labels at the percentage the note was SPAWNED at, but
	 * a notehead does not paint at that percentage: the symbol is offset by half
	 * its width and the glyph is right-aligned inside it, so the ink lands some
	 * way off. Measured, the name sat 26px right of the head it belonged to.
	 *
	 * Same remedy as the ledger lines — read where the head actually paints and
	 * put the label there. The rows are exactly as wide as the staff, so one x in
	 * pixels is all it takes.
	 */
	function alignColumns(hand) {
		var row = fingerRows[hand].get(0);
		if (!row) return;
		var rowLeft = row.getBoundingClientRect().left;

		staves[hand].find('.htp-scale-note').each(function () {
			var sound = this.getAttribute('data-sound');
			var head = this.querySelector('svg:not(.line) path');
			if (!head) return;
			var headRect = head.getBoundingClientRect();
			if (!headRect.width) return;
			var x = (headRect.left + headRect.width / 2) - rowLeft;
			[fingerRows[hand], nameRows[hand]].forEach(function (target) {
				target.find('[data-sound="' + sound + '"]').css({ left: x + 'px' });
			});
		});
	}

	function alignLedgers(symbol) {
		var head = symbol.find('svg:not(.line) path').get(0);
		if (!head) return;
		var headRect = head.getBoundingClientRect();
		if (!headRect.width) return;
		var headCentre = headRect.left + headRect.width / 2;

		symbol.find('svg.line').each(function () {
			var stroke = this.querySelector('line, path');
			if (!stroke) return;
			this.style.left = '0px';
			var strokeRect = stroke.getBoundingClientRect();
			if (!strokeRect.width) return;
			this.style.left = (headCentre - (strokeRect.left + strokeRect.width / 2)) + 'px';
		});
	}

	function drawStaff(hand, notes) {
		var staff = staves[hand];
		var clefId = CLEFS[hand];
		staff.find('.symbol').remove();
		staff.find('.htp-markers').remove();

		notation().renderStaffMarkers(staff, clefId);
		var clef = notation().buildClefSymbol(clefId);
		if (clef) staff.append(clef.css({ left: '0.2em' }));

		var shifts = [];
		var step = (LAST_PCT - FIRST_PCT) / (notes.length - 1);
		fingerRows[hand].empty();
		nameRows[hand].empty();

		notes.forEach(function (note, i) {
			var built = glyphForDegree(clefId, note.sound, note.letter, note.altLetter);
			if (!built) return;

			var symbol = $('<div class="symbol note visible htp-scale-note"></div>')
				.attr('data-sound', note.sound)
				.attr('data-hand', hand)
				.css({ left: (FIRST_PCT + i * step) + '%' })
				.append(built.glyph);

			var ledgers = notation().ledgerLineCount(built.shift);
			if (ledgers) notation().addLedgerLines(symbol, ledgers);

			staff.append(symbol);
			if (ledgers) alignLedgers(symbol);
			shifts.push(built.shift);

			/* The finger that plays it, under the note, so the staff and the
			 * keyboard tell the same story. */
			nameRows[hand].append(
				$('<span class="htp-scales__notename"></span>')
					.attr('data-sound', note.sound)
					.attr('data-name', spelledName(note.sound, note.letter))
					.css({ left: (FIRST_PCT + i * step) + '%' }));

			if (note.finger)
				fingerRows[hand].append(
					$('<span class="htp-scales__finger"></span>')
						.attr('data-sound', note.sound)
						.css({ left: (FIRST_PCT + i * step) + '%' })
						.text(note.finger));
		});

		alignColumns(hand);

		var room = notation().roomForShiftsEm(
			shifts.length ? Math.max.apply(null, shifts) : null,
			shifts.length ? Math.min.apply(null, shifts) : null);
		/* A little more air than roomForShiftsEm asks for. Its notehead allowance
		 * is half a head; a note carrying a stem, or sitting on the last of five
		 * ledger lines, paints a couple of pixels past that and gets shaved by
		 * the container's overflow. */
		containers[hand].css({
			'padding-top': (room.above + EXTRA_ROOM_EM).toFixed(3) + 'em',
			'padding-bottom': (room.below + EXTRA_ROOM_EM).toFixed(3) + 'em'
		});
	}

	/* ------------------------------------------------------------- keyboard */

	/*
	 * Put the scale under the hands. The key where the two octaves meet is the
	 * left hand's last note and the right hand's first, so it carries both
	 * numbers rather than one of them overwriting the other.
	 */
	function hintKeyboard(notes) {
		if (!window.HTP.keyboard || !window.HTP.keyboard.setHints) return;

		var hints = {};
		if (handShown('rh')) notes.rh.forEach(function (n) {
			hints[n.sound] = hints[n.sound] || {};
			if (n.finger) hints[n.sound].rh = n.finger;
		});
		if (handShown('lh')) notes.lh.forEach(function (n) {
			hints[n.sound] = hints[n.sound] || {};
			if (n.finger) hints[n.sound].lh = n.finger;
		});

		window.HTP.keyboard.setHints(hints);
	}

	/* --------------------------------------------------------------- render */

	/* A hand is shown when its clef is. Turning the bass clef off is how you ask
	 * for a right-hand-only view, so the left hand's staff, its fingering row and
	 * its hints on the keys all go together — a hand's fingering with no staff to
	 * read it against would be half an answer. */
	function handShown(hand) {
		return window.HTP.clefEnabled(CLEFS[hand]);
	}

	/* Repopulate the scale menu for a group, keeping whatever was last chosen
	 * inside it — the twelve roots of one group have nothing to do with the
	 * twelve of another, so each remembers its own. */
	function fillScales(groupIndex) {
		var group = GROUPS[groupIndex];
		selectEl.innerHTML = '';
		group.scales.forEach(function (scale, i) {
			var option = document.createElement('option');
			option.value = String(i);
			option.textContent = scale.name;
			selectEl.appendChild(option);
		});
		selectEl.value = String(chosenIndex(groupIndex));
	}

	/*
	 * Name what you are playing, the way free practice does: one note by name, two
	 * as an interval, three or more as a chord. Against a scale on screen this is
	 * how you find the harmony inside it — play the first, third and fifth degrees
	 * of the scale you are looking at and the readout tells you what you have
	 * built.
	 *
	 * The note struck FIRST is taken as the root, so an inversion keeps its name.
	 */
	function updateReadout() {
		if (!readoutEl) return;
		var sounds = Object.keys(held).map(Number).sort(function (a, b) { return a - b; });
		if (applyNoteNames()) { readoutEl.innerHTML = ''; return; }
		/* Nothing held: stay empty rather than explaining itself. The space is
		 * still reserved, so naming a chord does not shift the staves. */
		if (!sounds.length) {
			readoutEl.innerHTML = '';
			return;
		}
		var described = notation().describeSounds(sounds, heldOrder[0]);
		var html = '<div class="htp-readout__primary">' + described.primary + '</div>';
		if (described.secondary)
			html += '<div class="htp-readout__secondary">' + described.secondary + '</div>';
		readoutEl.innerHTML = html;
	}

	var QUALITY = [
		{ steps: [0, 4, 7],  name: 'major',      numeral: 'upper', mark: '' },
		{ steps: [0, 3, 7],  name: 'minor',      numeral: 'lower', mark: '' },
		{ steps: [0, 3, 6],  name: 'diminished', numeral: 'lower', mark: '°' },
		{ steps: [0, 4, 8],  name: 'augmented',  numeral: 'upper', mark: '+' }
	];
	var ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

	/*
	 * The triads of the scale: stack every other degree, three deep, wrapping
	 * through the octave. Whether each comes out major, minor or diminished is
	 * not asserted anywhere — it falls out of the scale's own intervals, which is
	 * the whole reason this is worth showing.
	 */
	function chordsOf(group, scale) {
		if (group.id === 'blues')
			return BLUES_CHORDS.map(function (c) {
				return { numeral: c.numeral, degree: c.degree,
					sounds: c.intervals.map(function (iv) { return 60 + scale.pc + c.offset + iv; }) };
			});

		var degrees = group.steps.length - 1;          /* drop the closing octave */
		if (degrees < 7) return null;                  /* a pentatonic has no triads of its own */

		/* Number from the parent major scale, so a mode's chords carry the
		 * functions they are known by. */
		var parentShift = PARENT_OFFSET[group.id];

		var out = [];
		for (var d = 0; d < degrees; d++) {
			var sounds = [0, 2, 4].map(function (skip) {
				var i = d + skip;
				return 60 + scale.pc + group.steps[i % degrees] + 12 * Math.floor(i / degrees);
			});
			var intervals = sounds.map(function (n) { return (((n - sounds[0]) % 12) + 12) % 12; });
			var quality = null;
			QUALITY.forEach(function (q) {
				if (q.steps.every(function (v, k) { return v === intervals[k]; })) quality = q;
			});
			/* The degree this chord occupies in the parent key. For the major
			 * scale that is just d; for a mode it is d shifted round by where the
			 * mode starts. */
			var parentDegree = d;
			if (parentShift !== undefined) {
				var semis = (group.steps[d] + parentShift) % 12;
				var MAJOR_DEGREE_AT = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 };
				if (MAJOR_DEGREE_AT[semis] !== undefined) parentDegree = MAJOR_DEGREE_AT[semis];
			}
			var numeral = ROMAN[parentDegree];
			if (quality && quality.numeral === 'lower') numeral = numeral.toLowerCase();
			out.push({ numeral: numeral + (quality ? quality.mark : ''), sounds: sounds,
				degree: d + 1 });
		}
		return out;
	}

	/*
	 * One octave of keys, with the chord's notes filled in. Small on purpose: at
	 * this size the SHAPE is the information — which fingers fall where, and how
	 * the shape slides as the chord changes — so the individual notes are not
	 * named. The chord's own name is underneath.
	 */
	var MINI_WHITE = [0, 2, 4, 5, 7, 9, 11];
	/* Which white key each black one sits after, by index into MINI_WHITE. */
	var MINI_BLACK = [{ pc: 1, after: 0 }, { pc: 3, after: 1 }, { pc: 6, after: 3 },
		{ pc: 8, after: 4 }, { pc: 10, after: 5 }];

	/*
	 * One octave of keys with the chord's notes marked.
	 *
	 * Built from the real key markup — the same .htp-key classes, the same
	 * --htp-white-key-width the drawer sets, the same is-hinted tint — rather
	 * than a drawing that looks like it. A lookalike would have its own idea of
	 * what a black key's width is and would drift from the keyboard below the
	 * moment either changed. This cannot: it IS the keyboard, seven keys wide.
	 *
	 * No fingering. At this size the shape is the information, and the numbers
	 * would only be legible at the expense of it.
	 */
	function miniKeyboard(sounds) {
		var on = {};
		sounds.forEach(function (n) { on[(((n % 12) + 12) % 12)] = true; });

		var width = 100 / MINI_WHITE.length;
		var html = '<span class="htp-scales__mini htp-keys" style="--htp-white-key-width:'
			+ width + '%">';

		MINI_WHITE.forEach(function (pc, i) {
			html += '<span data-pc="' + pc + '" class="htp-key htp-key--white'
				+ (on[pc] ? ' is-hinted' : '') + '" style="left:' + (i * width) + '%"></span>';
		});
		MINI_BLACK.forEach(function (b) {
			html += '<span data-pc="' + b.pc + '" class="htp-key htp-key--black'
				+ (on[b.pc] ? ' is-hinted' : '') + '" style="left:' + ((b.after + 1) * width) + '%"></span>';
		});
		return html + '</span>';
	}

	/* Which progression is showing, per group — each group's list is its own. */
	function chosenProgression(group) {
		var list = PROGRESSIONS[group.id] || [];
		if (!list.length) return -1;
		var stored = parseInt(window.localStorage.getItem('htp.scales.prog.' + group.id), 10);
		return (stored >= 0 && stored < list.length) ? stored : 0;
	}

	var CHORD_HOLD_MS = 1200;
	var chordTimer = null;
	var ringing = [];

	/*
	 * Play a chord through the shared MIDI bus rather than straight at the
	 * synth. Everything that listens to the bus then reacts on its own: the
	 * drawer lights the keys, the staff colours the notes, the readout names what
	 * is sounding, and this panel marks the matching card. None of that needs
	 * wiring here, and a chord played from a card is indistinguishable from one
	 * played by hand — which is the point.
	 */
	function playChord(sounds) {
		silenceChord();
		ringing = placeInView(sounds);
		ringing.forEach(function (n) { window.HTP.midi.noteOn(n, 100); });
		chordTimer = window.setTimeout(silenceChord, CHORD_HOLD_MS);
	}

	function silenceChord() {
		window.clearTimeout(chordTimer);
		chordTimer = null;
		ringing.forEach(function (n) { window.HTP.midi.noteOff(n); });
		ringing = [];
	}

	/* A chord lit on keys that are not drawn teaches nothing, so shift it by
	 * octaves until it sits inside the range the keyboard is showing. */
	function placeInView(sounds) {
		var kb = window.HTP.keyboard;
		if (!kb || !kb.visibleRange) return sounds.slice();
		var seen = kb.visibleRange();
		var out = sounds.slice();
		while (Math.min.apply(null, out) < seen.low) out = out.map(function (n) { return n + 12; });
		while (Math.max.apply(null, out) > seen.high) out = out.map(function (n) { return n - 12; });
		return out;
	}

	function chordCard(chord, inProg, step) {
		var described = notation().describeSounds(chord.sounds.slice(), chord.sounds[0]);
		var pcs = chord.sounds.map(function (n) { return (((n % 12) + 12) % 12); })
			.filter(function (v, k, a) { return a.indexOf(v) === k; })
			.sort(function (a, b) { return a - b; });
		return '<li class="htp-scales__chord' + (inProg ? ' is-inprog' : '') + '"'
			+ ' data-pcs="' + pcs.join(',') + '"'
			+ ' data-sounds="' + chord.sounds.join(',') + '"'
			+ ' tabindex="0" role="button" title="Play this chord">'
			+ (step ? '<span class="htp-scales__step">' + step + '</span>' : '')
			+ miniKeyboard(chord.sounds)
			+ '<span class="htp-scales__chordlabel">'
			+   '<b class="htp-scales__numeral">' + chord.numeral + '</b>'
			+   '<span class="htp-scales__chordname">'
			+     (described.secondary || described.primary) + '</span>'
			+ '</span>'
			+ '</li>';
	}

	function renderChords(group, scale) {
		var panel = root.querySelector('.htp-scales__chords');
		if (!panel) return;
		panel.hidden = !chordsOn();
		if (!chordsOn()) return;

		var chords = chordsOf(group, scale);
		if (!chords) {
			panel.innerHTML = '<div class="htp-scales__chordnote--none">'
				+ 'A five-note scale has no triads of its own — its chords come from the '
				+ 'major or minor key it sits inside.</div>';
			return;
		}

		var list = PROGRESSIONS[group.id] || [];
		var chosen = chosenProgression(group);
		var prog = chosen >= 0 ? list[chosen] : null;
		var html = '';

		if (list.length) {
			html += '<select class="htp-scales__progpick" title="Common progressions in this scale, most common first">';
			list.forEach(function (entry, i) {
				html += '<option value="' + i + '"' + (i === chosen ? ' selected' : '') + '>'
					+ entry.label + '</option>';
			});
			html += '</select>';
			if (prog && prog.note)
				html += '<div class="htp-scales__prognote">' + prog.note + '</div>';
		}

		/*
		 * With a progression chosen, the panel IS the progression: its chords in
		 * order, repeats included, numbered. Showing the distinct chords instead
		 * silently collapsed I7 - IV7 - I7 - V7 into three cards, which is not
		 * the thing you are trying to play.
		 *
		 * Whatever the progression does not use follows underneath, so the scale's
		 * other chords are still there to find.
		 */
		var byDegree = {};
		chords.forEach(function (c) { byDegree[c.degree] = c; });

		var sequence = prog
			? prog.degrees.map(function (d) { return byDegree[d]; }).filter(Boolean)
			: [];
		var used = {};
		sequence.forEach(function (c) { used[c.degree] = true; });
		var rest = chords.filter(function (c) { return !used[c.degree]; });

		html += '<ul class="htp-scales__chordlist">';
		sequence.forEach(function (chord, i) {
			html += chordCard(chord, true, i + 1);
		});
		if (sequence.length && rest.length)
			html += '<li class="htp-scales__rest">also in this scale</li>';
		rest.forEach(function (chord) { html += chordCard(chord, false, null); });
		if (!sequence.length)
			chords.forEach(function (chord) { html += chordCard(chord, false, null); });
		html += '</ul>';

		panel.innerHTML = html;

		$('.htp-scales__chord', panel).on('click keydown', function (event) {
			if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
			event.preventDefault();
			playChord($(this).attr('data-sounds').split(',').map(Number));
		});

		var picker = panel.querySelector('.htp-scales__progpick');
		if (picker) picker.addEventListener('change', function () {
			try { window.localStorage.setItem('htp.scales.prog.' + group.id, picker.value); }
			catch (e) { /* non-fatal */ }
			renderChords(group, scale);
			applyChordPlaying();
			picker.blur();
		});
	}

	function chordsOn() {
		return window.localStorage.getItem(STORAGE_CHORDS) === '1';
	}

	function show() {
		var pick = selection();
		var scale = pick.group.scales[pick.index];
		if (!scale) return;
		current = scale;
		try {
			window.localStorage.setItem(STORAGE_GROUP, String(pick.groupIndex));
			window.localStorage.setItem(STORAGE_KEY + '.' + pick.group.id, String(pick.index));
		} catch (e) { /* non-fatal */ }

		var notes = voicing(pick.group, scale);
		['rh', 'lh'].forEach(function (hand) {
			var on = handShown(hand);
			containers[hand].toggle(on);
			fingerRows[hand].toggle(on);
			if (on) drawStaff(hand, notes[hand]);
		});
		hintKeyboard(notes);

		renderChords(pick.group, scale);
		applyNoteNames();
		applySounding();
		applyChordPlaying();
		updateReadout();
	}

	/* Light the notes you are actually playing, in both staves at once, so a
	 * note played in one hand shows up wherever it appears. */
	/*
	 * The diagrams react to a COMPLETE chord, not to the notes inside one.
	 *
	 * Lighting each held note wherever it appeared meant a single C lit three of
	 * the seven cards at once, none of them because you had played that chord.
	 * Reacting only to the whole thing makes a lit card mean something: you just
	 * played this. Which is also what makes a progression findable — play until
	 * the cards light in the order you want.
	 */
	function applyChordPlaying() {
		var panel = root.querySelector('.htp-scales__chords');
		if (!panel || panel.hidden) return;

		var playing = {};
		Object.keys(held).forEach(function (n) { playing[(((n % 12) + 12) % 12)] = true; });
		var heldPcs = Object.keys(playing).map(Number)
			.sort(function (a, b) { return a - b; }).join(',');

		$('.htp-scales__chord', panel).each(function () {
			var card = $(this);
			var complete = heldPcs !== '' && card.attr('data-pcs') === heldPcs;
			card.toggleClass('is-playing', complete);
			card.find('[data-pc]').each(function () {
				this.classList.toggle('is-active',
					complete && this.classList.contains('is-hinted'));
			});
		});
	}

	/*
	 * A single held note is named under itself, in the clef it belongs to. Two or
	 * more go to the middle instead, because an interval or a chord is a fact
	 * about the notes together and belongs in one place, not split across two
	 * staves.
	 *
	 * Returns whether the name found a home, so the middle readout knows to stay
	 * out of the way — a note you play that is NOT in the scale has no slot, and
	 * still needs naming somewhere.
	 */
	function applyNoteNames() {
		var sounds = Object.keys(held).map(Number);
		var single = sounds.length === 1 ? sounds[0] : null;
		var placed = false;

		/* Every note is named, always — reading which degrees are flat or sharp is
		 * half of what a scale reference is for, and it should not require playing
		 * them one at a time. The one you are holding is picked out. */
		$('.htp-scales__notename', root).each(function () {
			var slot = $(this);
			var mine = single !== null && parseInt(slot.attr('data-sound'), 10) === single;
			slot.text(slot.attr('data-name'));
			slot.toggleClass('is-sounding', mine);
			if (mine) placed = true;
		});
		return placed;
	}

	/*
	 * Hold an octave to change key: G2 with G3 switches C major practice to G
	 * major, staying in whatever group you are in.
	 *
	 * The hold is not decoration. With the hands an octave or two apart, EVERY
	 * note of a hands-together scale is already an octave pair — play the scale
	 * and you would change key on every note. Requiring the pair to be the only
	 * thing sounding, and to still be there after KEY_CHANGE_MS, separates a
	 * deliberate gesture from ordinary playing: nothing in a scale is held that
	 * long.
	 *
	 * Any exact multiple of twelve counts, because two octaves is the normal gap
	 * between the hands in this tab and reaching for the same note in both is the
	 * obvious way to ask.
	 */
	var KEY_CHANGE_MS = 600;
	var keyChangeTimer = null;

	function considerKeyChange() {
		window.clearTimeout(keyChangeTimer);
		keyChangeTimer = null;

		var sounds = Object.keys(held).map(Number).sort(function (a, b) { return a - b; });
		if (sounds.length !== 2) return;

		var gap = sounds[1] - sounds[0];
		if (gap < 12 || gap % 12 !== 0) return;

		var pc = (((sounds[0] % 12) + 12) % 12);
		var pick = selection();
		var index = -1;
		pick.group.scales.forEach(function (scale, i) {
			if (scale.pc === pc && index < 0) index = i;
		});
		if (index < 0 || index === pick.index) return;

		keyChangeTimer = window.setTimeout(function () {
			var still = Object.keys(held).map(Number).sort(function (a, b) { return a - b; });
			if (still.length !== 2 || still[0] !== sounds[0] || still[1] !== sounds[1]) return;
			selectEl.value = String(index);
			show();
		}, KEY_CHANGE_MS);
	}

	/*
	 * What a function-key command means.
	 *
	 * The key you hold names the tonic; what you play is then read as a chord
	 * WITHIN that key, and its scale degree is what picks the mode. That is the
	 * modal system itself rather than a lookup table: the modes simply are the
	 * major scale started from each of its degrees, so a chord's position in the
	 * key is what decides which one you land in.
	 *
	 *   hold C, play D minor   -> the ii of C  -> D Dorian
	 *   hold C, play G7        -> the V of C   -> G Mixolydian
	 *   hold C, play C major   -> the I of C   -> C major
	 *   hold C, play A minor   -> the vi of C  -> A natural minor
	 *
	 * The scale you land on is rooted on the CHORD, not on the key you held —
	 * D Dorian, not C major — because that is the scale you would play over it.
	 *
	 * A chord whose quality does not match its degree is not diatonic to the key
	 * you named, so the degree tells us nothing; those fall back to reading the
	 * chord on its own. Anything unrecognised changes nothing.
	 */
	/*
	 * Where each mode's root sits in its PARENT major scale, in semitones. Used to
	 * number the chords by their function in that key rather than by their place
	 * in the mode: in G Mixolydian, D minor is the ii of C — which is what a
	 * ii-V-I means — and calling it the v of G Mixolydian, though true, is not
	 * what anyone reading the progression wants.
	 */
	var PARENT_OFFSET = {
		major: 0, dorian: 2, phrygian: 4, lydian: 5,
		mixolydian: 7, minor: 9, locrian: 11
	};

	var MODE_BY_DEGREE = {
		0:  { group: 'major',      quality: 'major' },
		2:  { group: 'dorian',     quality: 'minor' },
		4:  { group: 'phrygian',   quality: 'minor' },
		5:  { group: 'lydian',     quality: 'major' },
		7:  { group: 'mixolydian', quality: 'major' },
		9:  { group: 'minor',      quality: 'minor' },
		11: { group: 'locrian',    quality: 'diminished' }
	};

	/* Chord shapes, as semitones above the root. `quality` is the coarse class the
	 * degree test uses; `group` is where an undiatonic chord falls back to. */
	var CHORD_SHAPES_IN = [
		{ steps: [0, 4, 7],     quality: 'major',      group: 'major'      },
		{ steps: [0, 3, 7],     quality: 'minor',      group: 'minor'      },
		{ steps: [0, 3, 6],     quality: 'diminished', group: 'locrian'    },
		{ steps: [0, 4, 7, 10], quality: 'major',      group: 'mixolydian' },
		{ steps: [0, 3, 7, 10], quality: 'minor',      group: 'dorian'     },
		{ steps: [0, 4, 7, 11], quality: 'major',      group: 'major'      },
		{ steps: [0, 3, 6, 10], quality: 'diminished', group: 'locrian'    }
	];

	function groupIndexById(id) {
		var found = -1;
		GROUPS.forEach(function (g, i) { if (g.id === id && found < 0) found = i; });
		return found;
	}

	function jumpTo(groupIndex, pc) {
		if (groupIndex < 0) return;
		var index = -1;
		GROUPS[groupIndex].scales.forEach(function (scale, i) {
			if (scale.pc === pc && index < 0) index = i;
		});
		if (index < 0) return;
		if (parseInt(groupEl.value, 10) !== groupIndex) {
			groupEl.value = String(groupIndex);
			fillScales(groupIndex);
		}
		selectEl.value = String(index);
		show();
	}

	/*
	 * Name a chord from the notes, whichever way round they are played.
	 *
	 * Every note is tried as the root, not just the lowest. Measuring from the
	 * bottom note only recognises root position, so the first inversion of D
	 * minor — F A D, which is simply where the hand falls much of the time —
	 * matched nothing and the command did nothing at all. That is what "it works
	 * once and then I am stuck" was: the first chord happened to be root
	 * position and the next one was not.
	 *
	 * Pitch classes, so a doubled root, a bass note an octave down or a chord
	 * spread across both hands all reduce to the same shape.
	 */
	function shapeOf(sounds) {
		var pcs = sounds.map(function (n) { return (((n % 12) + 12) % 12); })
			.filter(function (v, i, a) { return a.indexOf(v) === i; })
			.sort(function (a, b) { return a - b; });

		for (var i = 0; i < pcs.length; i++) {
			var root = pcs[i];
			var steps = pcs.map(function (pc) { return (((pc - root) % 12) + 12) % 12; })
				.sort(function (a, b) { return a - b; });
			var match = null;
			CHORD_SHAPES_IN.forEach(function (entry) {
				if (match) return;
				if (entry.steps.length === steps.length
					&& entry.steps.every(function (v, k) { return v === steps[k]; }))
					match = entry;
			});
			if (match) return { rootPc: root, match: match };
		}

		var lowest = sounds.slice().sort(function (a, b) { return a - b; })[0];
		return { rootPc: (((lowest % 12) + 12) % 12), match: null };
	}

	/*
	 * Act the moment the notes say enough.
	 *
	 * A recognised chord jumps immediately — that is the whole gesture, and
	 * waiting for the function key to come up made it feel like nothing had
	 * happened. A single note waits a moment first, because a single note is
	 * usually the start of a chord and jumping twice would be worse than jumping
	 * late. The release is the backstop for anything still unresolved.
	 */
	var SINGLE_NOTE_GRACE_MS = 160;
	var commandTimer = null;
	var commandActed = false;

	function watchCommand(sounds, fnNote) {
		window.clearTimeout(commandTimer);
		commandTimer = null;
		if (!current || !sounds.length) return;

		if (sounds.length > 1) {
			if (shapeOf(sounds).match) {
				runCommand(sounds, fnNote);
				commandActed = true;
			}
			return;
		}

		commandTimer = window.setTimeout(function () {
			runCommand(sounds, fnNote);
			commandActed = true;
		}, SINGLE_NOTE_GRACE_MS);
	}

	function finishCommand(sounds, fnNote) {
		window.clearTimeout(commandTimer);
		commandTimer = null;
		var acted = commandActed;
		commandActed = false;
		if (!acted && current && sounds.length) runCommand(sounds, fnNote);
	}

	function runCommand(sounds, fnNote) {
		if (!sounds.length) return;
		var basePc = (((fnNote % 12) + 12) % 12);
		var chord = shapeOf(sounds);
		var degree = (((chord.rootPc - basePc) % 12) + 12) % 12;
		var slot = MODE_BY_DEGREE[degree];

		/* One note: its degree in the key you named is the mode. */
		if (sounds.length === 1) {
			if (slot) jumpTo(groupIndexById(slot.group), chord.rootPc);
			else jumpTo(parseInt(groupEl.value, 10), chord.rootPc);
			return;
		}

		if (!chord.match) return;
		/* Diatonic to the key you named: the degree decides. Otherwise the chord
		 * has to speak for itself. */
		var group = (slot && slot.quality === chord.match.quality)
			? slot.group : chord.match.group;
		jumpTo(groupIndexById(group), chord.rootPc);
	}

	function applySounding() {
		$('.htp-scale-note, .htp-scales__finger', root).each(function () {
			var el = $(this);
			el.toggleClass('is-sounding', !!sounding[parseInt(el.attr('data-sound'), 10)]);
		});
	}

	/* ------------------------------------------------------------ lifecycle */

	window.HTP.register({
		id: 'scales',
		title: 'Scales',
		description: 'A scale on both staves, and under both hands with its fingering.',

		init: function (el, api) {
			root = el;
			el.innerHTML =
				  '<div class="htp-scales">'
				+   '<header class="htp-scales__head">'
				+     '<span class="htp-scales__label">Scale</span>'
				+     '<select class="htp-scales__group"></select>'
				+     '<select class="htp-scales__pick" title="Or hold an octave on the piano — G2 with G3 switches to G, in whatever group you are in"></select>'
				+     '<label class="htp-scales__opt" title="Show the chords built from this scale, and the progression it is usually played in">'
				+       '<input type="checkbox" class="htp-scales__chordtoggle"> Chords'
				+     '</label>'
				+   '</header>'
				+   '<div class="htp-scales__body">'
				+     '<div class="htp-scales__notation">'
				/* The readout lives WITH the staves, not after the body. After the
				 * body it sits below the chord column, which is far taller — so
				 * with chords showing, the name of what you played scrolled off
				 * the bottom instead of appearing under the music. */
				+       '<div class="htp-readout htp-scales__readout"></div>'
				+     '</div>'
				+     '<aside class="htp-scales__chords" hidden></aside>'
				+   '</div>'
				+ '</div>';

			selectEl = el.querySelector('.htp-scales__pick');
			groupEl = el.querySelector('.htp-scales__group');
			readoutEl = el.querySelector('.htp-scales__readout');

			var chordsEl = el.querySelector('.htp-scales__chordtoggle');
			chordsEl.checked = chordsOn();
			chordsEl.addEventListener('change', function () {
				try { window.localStorage.setItem(STORAGE_CHORDS, chordsEl.checked ? '1' : '0'); }
				catch (e) { /* non-fatal */ }
				show();
			});

			resolveSpellings();   /* before any menu reads a scale's name */

			GROUPS.forEach(function (group, i) {
				var option = document.createElement('option');
				option.value = String(i);
				option.textContent = group.name;
				groupEl.appendChild(option);
			});
			groupEl.value = String(chosenGroup());
			fillScales(chosenGroup());

			groupEl.addEventListener('change', function () {
				fillScales(parseInt(groupEl.value, 10));
				show();
				groupEl.blur();
			});
			selectEl.addEventListener('change', function () {
				show();
				/* Give the keys back: with a select focused, the computer-keyboard
				 * note mapping types into it instead of playing. */
				selectEl.blur();
			});

			buildStaves(el);

			api.onSettingChange(function (key) {
				if (key === 'lineMarkers' || key.indexOf('landmark') === 0
					|| key === 'colourNotes' || key === 'staffSize'
					|| key.indexOf('showClef') === 0)
					if (current) show();
			});
			api.onMarkersChanged(function () {
				if (current) show();
			});
			if (api.fnKey) {
				if (api.fnKey.onChange) api.fnKey.onChange(watchCommand);
				api.fnKey.onCommand(finishCommand);
			}

			if (window.HTP.keyboard && window.HTP.keyboard.onRangeChange)
				window.HTP.keyboard.onRangeChange(function () {
					if (current) show();
				});

			show();
		},

		onShow: function (el, api) {
			show();
			if (unsubscribe) return;
			unsubscribe = api.midi.subscribe(function (bytes) {
				/* While the function key is down you are typing, not playing: the
				 * notes are a command, so nothing here should light up or be named
				 * as if you had played them. */
				if (api.fnKey && api.fnKey.isDown()) return;
				var type = bytes[0] & 0xf0;
				if (type === 0x90 && bytes[2] > 0) {
					sounding[bytes[1]] = true;
					if (!held[bytes[1]]) heldOrder.push(bytes[1]);
					held[bytes[1]] = true;
				} else if (type === 0x80 || (type === 0x90 && bytes[2] === 0)) {
					delete sounding[bytes[1]];
					delete held[bytes[1]];
					heldOrder = heldOrder.filter(function (n) { return held[n]; });
				} else return;
				applySounding();
				applyChordPlaying();
				updateReadout();
				considerKeyChange();
			});
		},

		onHide: function () {
			if (unsubscribe) { unsubscribe(); unsubscribe = null; }
			silenceChord();
			window.clearTimeout(keyChangeTimer);
			keyChangeTimer = null;
			sounding = {};
			held = {};
			heldOrder = [];
			/* The hints belong to this tab; leaving them on the keys would follow
			 * you into the trainer and read as part of the exercise. */
			if (window.HTP.keyboard && window.HTP.keyboard.clearHints)
				window.HTP.keyboard.clearHints();
		},

		onResize: function () {
			if (current) show();
		}
	});
})(window, document);
