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
  lastUnit: null,       // the unit most recently opened — what "Continue" resumes.
                        // screenPosition alone cannot answer "where was I last":
                        // it is a per-unit map with no ordering, so Home had no
                        // way to name the right unit (architecture plan §7's
                        // `position.lastRoute`, which was never built).
  reviewQueue: [],      // question ids answered wrong, drained first by the next review
  fullBankProgress: {}, // { "U1": 5 } — resume position within a unit's G-08 set
  fullBankDone: [],     // unit ids whose full-bank set has been completed end to end
  reviewsDone: [],      // e.g. ['R1'] — which cumulative reviews are finished
  rehearsal: { attempts: 0, bestCorrect: 0, lastResult: null },
  epitomeSeen: false,   // E-01 is revealed once, then re-shown pre-revealed at U2/U4/U6
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
  // Also the single "where was I last" pointer. Set here because this is
  // already called on every lesson screen, so Continue stays correct without
  // any new call sites.
  s.lastUnit = unitId;
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

export function markFullBankDone(unitId) {
  const s = read();
  if (!s.fullBankDone.includes(unitId)) s.fullBankDone.push(unitId);
  write(s);
}

export function markReviewDone(reviewId) {
  const s = read();
  if (!s.reviewsDone.includes(reviewId)) s.reviewsDone.push(reviewId);
  write(s);
}

// Rehearsal keeps only an attempt count and a personal best. No score is ever
// shown against the learner (G-1: nothing is counted against them); this
// exists so the end screen can say "unlimited retries" truthfully and so the
// learner can see their own improvement if they want it.
export function recordRehearsal(correct, passed) {
  const s = read();
  s.rehearsal.attempts += 1;
  if (correct > s.rehearsal.bestCorrect) s.rehearsal.bestCorrect = correct;
  s.rehearsal.lastResult = passed ? 'passed' : 'ended';
  write(s);
}

export function markEpitomeSeen() {
  const s = read();
  s.epitomeSeen = true;
  write(s);
}

// Drains the re-queue as a review consumes it — objective re-queueing (v5.0):
// an item enters on a wrong answer, not on a learner's self-report.
export function clearFromReviewQueue(questionIds) {
  const s = read();
  s.reviewQueue = s.reviewQueue.filter((q) => !questionIds.includes(q));
  write(s);
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
