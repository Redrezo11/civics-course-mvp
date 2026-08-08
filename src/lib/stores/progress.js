// stores.js — thin reactive wrappers around storage.js.
// Components read/write through these stores; storage.js remains the only
// module that touches localStorage, per the architecture note there.

import { writable, derived } from 'svelte/store';
import * as storage from '../storage.js';

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
