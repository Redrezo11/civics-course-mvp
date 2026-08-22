// stores.js — thin reactive wrappers around storage.js.
// Components read/write through these stores; storage.js remains the only
// module that touches localStorage, per the architecture note there.

import { writable, derived } from 'svelte/store';
import * as storage from '../storage.js';
import { getUnitQuestions, TOTAL_QUESTIONS } from '../content/questions.js';
import * as cmi5 from '../cmi5.js';

/**
 * The seven lessons that teach the 128 questions. U0 is orientation and teaches
 * none of them, which is why finishing the course does not require it.
 */
export const LESSON_UNITS = ['U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7'];

/**
 * Tell the LMS how far the learner has got, and that they have finished.
 *
 * Reads the same state the derived stores below do, so the number reported and
 * the number displayed cannot disagree. Every call is a no-op unless an LMS
 * launched this session; `cmi5.complete()` is additionally idempotent, so
 * re-finishing a unit cannot send a second Completed.
 */
function reportProgress(state) {
  const unlocked = LESSON_UNITS.filter((id) => state.unitsCompleted.includes(id));
  const questions = unlocked.reduce((n, id) => n + getUnitQuestions(id).length, 0);
  cmi5.progress((questions / TOTAL_QUESTIONS) * 100);
  if (unlocked.length === LESSON_UNITS.length) cmi5.complete();
}

function createProgressStore() {
  const { subscribe, set, update } = writable(storage.getState());

  function refresh() {
    set(storage.getState());
  }

  return {
    subscribe,
    setLanguage(lang) {
      storage.setLanguage(lang);
      refresh();
    },
    setTheme(theme) {
      storage.setTheme(theme);
      refresh();
    },
    markUnitComplete(unitId) {
      storage.markUnitComplete(unitId);
      refresh();
      // Report to the LMS from here rather than from Lesson.svelte, so that
      // "a unit was finished" has exactly one place it is recorded and exactly
      // one place it is reported. Both calls are no-ops when no LMS launched
      // the session, which is the usual case.
      reportProgress(storage.getState());
    },
    saveScreenPosition(unitId, screenId) {
      storage.saveScreenPosition(unitId, screenId);
      refresh();
    },
    recordAnswer(questionId, correct) {
      storage.recordAnswer(questionId, correct);
      refresh();
    },
    recordFullBankProgress(unitId, count) {
      storage.recordFullBankProgress(unitId, count);
      refresh();
    },
    markFullBankDone(unitId) {
      storage.markFullBankDone(unitId);
      refresh();
    },
    markReviewDone(reviewId) {
      storage.markReviewDone(reviewId);
      refresh();
    },
    recordRehearsal(correct, passed) {
      storage.recordRehearsal(correct, passed);
      refresh();
    },
    markEpitomeSeen() {
      storage.markEpitomeSeen();
      refresh();
    },
    clearFromReviewQueue(ids) {
      storage.clearFromReviewQueue(ids);
      refresh();
    },
    resetAll() {
      storage.resetAll();
      refresh();
    },
  };
}

export const progress = createProgressStore();

// Derived, read-only conveniences used throughout the UI.
// Counts only real question ids (Q1…Q128). Guided-practice items were once
// written here under synthetic ids like "guided-0", which inflated the count
// with entries that are not test questions. Filtering here also repairs the
// count for anyone whose localStorage already holds those stale keys, without
// touching their genuine progress.
const OFFICIAL_QUESTION_ID = /^Q\d+$/;

export const questionsPracticedCount = derived(progress, ($p) =>
  Object.keys($p.questionsAnswered).filter((id) => OFFICIAL_QUESTION_ID.test(id))
    .length
);

export const lessonsFinishedCount = derived(
  progress,
  ($p) => $p.unitsCompleted.length
);

export const isDark = derived(progress, ($p) => $p.theme === 'dark');

/**
 * The course is finished.
 *
 * This lived inside Home.svelte as a local reactive until the LMS session
 * needed the same answer. Two definitions of "done" is how a learner ends up
 * congratulated on one screen and reported incomplete to their employer.
 *
 * Note what it is NOT: "Unit 7 is finished". Units are not locked, so a learner
 * may do U7 third — keying on it would report completion early for them, and
 * never for someone who leaves U7 until last but skips U3.
 */
export const courseComplete = derived(progress, ($p) =>
  LESSON_UNITS.every((id) => $p.unitsCompleted.includes(id))
);

/**
 * Course progress as a percentage, for the LMS only.
 *
 * Weighted by the questions each finished lesson covers, so it moves in the
 * 14 → 34 → 57 → 62 → 72 → 89 → 128 steps the course itself is built around.
 *
 * NOT the same number as `questionsPracticedCount`, and the two must never be
 * shown as if they were. That one counts questions the learner has actually
 * answered, and rule G-22 exists to keep it strict — "you have practised 57"
 * is a claim about them. This one is a claim about how far through the course
 * they are, which is what an LMS progress bar means.
 */
export const courseProgressPercent = derived(progress, ($p) => {
  // Counted from the question bank rather than from a table of unit sizes kept
  // here. A second copy of "how many questions Unit 3 covers" is a copy that
  // goes wrong the first time a question moves between units.
  const unlocked = LESSON_UNITS.filter((id) => $p.unitsCompleted.includes(id)).reduce(
    (n, id) => n + getUnitQuestions(id).length,
    0
  );
  return (unlocked / TOTAL_QUESTIONS) * 100;
});
