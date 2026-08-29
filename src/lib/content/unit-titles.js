// unit-titles.js — the unit names, in one place.
//
// They were in FOUR: authored in each unitN.json as `title`, then hardcoded
// again in Home.svelte, FullBank.svelte and QuestionBank.svelte, each with its
// own copy and Home's slightly shortened ("Rights", "America began"). None of
// the four went through the translation pipeline, so a Burmese learner met the
// lesson list, the practice-set header, the question-bank filter and the lesson
// bar all in English.
//
// The id is the key and `$t('unit.' + id)` is the text, so the translation and
// the list of units cannot drift apart: a unit with no ui-string falls back to
// its English title the same way every other key does, and QA check 25 fails if
// one is missing.

export const UNIT_IDS = ['U0', 'U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7'];

/** The ui-strings key holding this unit's translated name. */
export const unitTitleKey = (id) => `unit.${id}`;
