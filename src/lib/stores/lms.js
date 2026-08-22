// lms.js — "is this session being reported to a learning management system?"
//
// One boolean, in a store, because several screens have to tell the learner the
// truth about where their progress goes and that truth is different depending
// on how the course was opened. Left to each screen to work out for itself,
// they would drift, and the thing they would drift on is a privacy claim.
//
// Deliberately separate from cmi5.js: this carries no network code and can be
// imported by any component. cmi5.js is the module QA check 8 confines the
// network to, and nothing renders from it.

import { writable } from 'svelte/store';

/**
 * False until an LMS launch is confirmed, and false forever if there was none.
 *
 * Starting false rather than null matters: the privacy copy renders on first
 * paint, and a screen that says "your progress is reported" for one frame
 * before correcting itself has already said the wrong thing to somebody.
 * "Nothing is sent" is the safe frame to render while we find out, and it is
 * also true at that moment — nothing has been sent yet.
 */
export const lmsSession = writable(false);
