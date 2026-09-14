/*
 * note-trainer — the original HackThePiano exercise, registered as module #1.
 *
 * Its markup lives directly in index.html and is driven by js/code.js, so this
 * module declares itself as a `staticPane` and only wires up the extra options
 * that the shell adds on top of the original trainer.
 *
 * Do not move the trainer's DOM out of index.html: js/code.js resolves
 * #staff1, #staff2, #level, #accuracy and #reactionTime globally at DOM ready.
 */
(function (window, document) {
	'use strict';

	window.HTP.register({
		id: 'note-trainer',
		title: 'Note trainer',
		description: 'Read the note on the staff and play it.',
		staticPane: true
	});

	/*
	 * Each option is a checkbox bound to one HTP setting, plus the js/code.js
	 * function that re-renders after the setting changes. js/code.js exposes
	 * those as HTP.applyStaffSpacing / HTP.applyLineMarkers once it has run.
	 */
	var OPTIONS = [
		{ id: 'optMusicalClefDistance', setting: 'musicalClefDistance', apply: 'applyStaffSpacing' },
		{ id: 'optShowNoteNames',       setting: 'showNoteNames',       apply: null },
		{ id: 'optLineMarkers',         setting: 'lineMarkers',         apply: 'applyLineMarkers' },
		{ id: 'optColourKeys',          setting: 'colourKeys',          apply: null },
		{ id: 'optKeyNames',            setting: 'keyNames',            apply: null },
		/* Per-landmark switches. They drive the staff markers and the keyboard
		 * tinting together, so both surfaces always agree. */
		{ id: 'optLandmarkC',           setting: 'landmarkC',           apply: 'applyLineMarkers' },
		{ id: 'optLandmarkF',           setting: 'landmarkF',           apply: 'applyLineMarkers' },
		{ id: 'optLandmarkG',           setting: 'landmarkG',           apply: 'applyLineMarkers' }
	];

	$(function () {
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

		/* js/code.js has already drawn the first clef by now, so re-apply any
		 * option that was restored from a previous visit. */
		if (typeof window.HTP.applyStaffSpacing === 'function') window.HTP.applyStaffSpacing();
		if (typeof window.HTP.applyLineMarkers === 'function') window.HTP.applyLineMarkers();
	});
})(window, document);
