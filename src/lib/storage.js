// storage.js — the ONE place progress is read or written.
//
// Why this file exists as a single chokepoint, rather than calling
// localStorage directly from components: this project's roadmap includes
// a second build target (a cmi5/xAPI package for LMS import) that must
// report the same events — screen completed, question answered, unit
// finished — to a real backend instead of the browser. If every component
// called localStorage directly, adding that target would mean touching
// every component. Because everything funnels through this module, the
// LMS build only has to replace what's inside these functions.
//
// Nothing here ever calls the network. G-11/G-12: no server, no third
// party, zero runtime requests. localStorage only.

const KEY = 'civics-progress-v1';

const DEFAULT_STATE = {
  language: null,       // null = not yet chosen (forces the first-run screen)
  theme: 'light',
  unitsCompleted: [],   // e.g. ['U0', 'U1']
  questionsAnswered: {},// { "Q2": true, "Q7": false, ... } — true = answered correctly at least once
  screenPosition: {},   // { "U1": "U1-S05" } — resume point per unit
  reviewQueue: [],      // question ids marked "Not yet" or answered wrong, for spaced re-queue
  fullBankProgress: {}, // { "U1": 5 } — how many of a unit's full-bank set have been done
};

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    return { ...structuredClone(DEFAULT_STATE), ...JSON.parse(raw) };
  } catch {
    // Corrupt or unavailable storage (e.g. private browsing on some browsers)
    // fails soft: the course still works, it just won't remember between visits.
    // This is exactly the scenario G-06's Help screen explains to the learner.
    return structuredClone(DEFAULT_STATE);
  }
}

function write(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function getState() {
  return read();
}

export function setLanguage(lang) {
  const s = read();
  s.language = lang;
  write(s);
}

export function setTheme(theme) {
  const s = read();
  s.theme = theme;
  write(s);
}

export function markUnitComplete(unitId) {
  const s = read();
  if (!s.unitsCompleted.includes(unitId)) s.unitsCompleted.push(unitId);
  write(s);
}

export function saveScreenPosition(unitId, screenId) {
  const s = read();
  s.screenPosition[unitId] = screenId;
  write(s);
}

export function getScreenPosition(unitId) {
  return read().screenPosition[unitId] || null;
}

// correct: boolean — did the learner get it right this time.
// This is what replaced the v2.1 self-report ("Not yet" tap) with objective
// scoring in v5.0 — the app records the true answer state, not what the
// learner claims about themselves.
export function recordAnswer(questionId, correct) {
  const s = read();
  s.questionsAnswered[questionId] = correct;
  if (!correct && !s.reviewQueue.includes(questionId)) {
    s.reviewQueue.push(questionId);
  } else if (correct) {
    s.reviewQueue = s.reviewQueue.filter((q) => q !== questionId);
  }
  write(s);
}

export function getQuestionsPracticedCount() {
  return Object.keys(read().questionsAnswered).length;
}

export function getReviewQueue() {
  return read().reviewQueue;
}

export function recordFullBankProgress(unitId, count) {
  const s = read();
  s.fullBankProgress[unitId] = count;
  write(s);
}

export function getFullBankProgress(unitId) {
  return read().fullBankProgress[unitId] || 0;
}

// Used only by the Help screen's "my lessons disappeared" troubleshooting —
// never called automatically. A learner-initiated reset only.
export function resetAll() {
  try {
    localStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}
