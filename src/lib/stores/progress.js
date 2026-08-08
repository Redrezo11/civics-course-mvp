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
    resetAll() {
      storage.resetAll();
      refresh();
    },
  };
}

export const progress = createProgressStore();

// Derived, read-only conveniences used throughout the UI.
export const questionsPracticedCount = derived(
  progress,
  ($p) => Object.keys($p.questionsAnswered).length
);

export const lessonsFinishedCount = derived(
  progress,
  ($p) => $p.unitsCompleted.length
);

export const isDark = derived(progress, ($p) => $p.theme === 'dark');
