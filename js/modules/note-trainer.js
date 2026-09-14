/*
 * note-trainer — the original HackThePiano exercise, registered as module #1.
 *
 * Its markup lives directly in index.html and is driven by js/code.js, which is
 * deliberately left untouched, so this module only has to declare itself:
 * `staticPane` tells js/htp-panes.js that the
 * <section data-module="note-trainer"> already exists and is already wired up.
 *
 * Do not move the trainer's DOM out of index.html — js/code.js resolves
 * #staff1, #staff2, #level, #accuracy and #reactionTime globally at DOM ready.
 *
 * The option checkboxes are app chrome and are bound in js/htp-panes.js, not
 * here: they drive the keyboard and any module that draws a staff, not just
 * this one.
 */
window.HTP.register({
	id: 'note-trainer',
	title: 'Note trainer',
	description: 'Read the note on the staff and play it.',
	staticPane: true
});
