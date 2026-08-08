// questions.js — merges all per-unit question data into one lookup by id.
// Adding a unit's questions later is: write questions-uN.json, import and
// spread it in here. No other file needs to change.

import u1 from './questions-u1.json';
import u2 from './questions-u2.json';
import u3 from './questions-u3.json';
import u4 from './questions-u4.json';
import u5 from './questions-u5.json';
import u6 from './questions-u6.json';
import u7 from './questions-u7.json';
import currentAnswers from './current-answers.json';

const all = [...u1, ...u2, ...u3, ...u4, ...u5, ...u6, ...u7];

const byId = Object.fromEntries(all.map((q) => [q.id, q]));

export function getQuestion(id) {
  return byId[id] || null;
}

export function getUnitQuestions(unitId) {
  return all.filter((q) => q.unit === unitId);
}

export function getAllQuestions() {
  return all;
}

export const TOTAL_QUESTIONS = all.length;

// --- Dynamic answers (◆) -------------------------------------------------
//
// Eight questions have answers that change with elections or appointments.
// They are never graded — a fixed distractor set would go stale, and an old
// distractor could later become the true answer. They render as a current-
// answer card carrying the date the answer was last verified.

export function getCurrentAnswer(id) {
  return currentAnswers.answers[id] || null;
}

export const ANSWERS_CHECKED = currentAnswers.checked;
export const USCIS_UPDATES_URL = currentAnswers.updatesUrl;

// --- Option order --------------------------------------------------------
//
// Question_Bank_Companion.md lists the correct option first in every entry.
// That is an authoring convention for human review, NOT a display order:
// transcribed literally it puts the correct answer at index 0 for all 128
// questions, so a learner who always taps the first option scores 100% and
// the assessment measures nothing.
//
// The JSON stays faithful to the Companion so it can still be checked
// line-by-line against the source (and against M-1778). The permutation
// happens here, at render time, seeded by the question id — so a given
// question always presents its options in the same order for every learner
// and across reloads, but the correct answer lands in a different position
// from one question to the next.

function seedFrom(str) {
  // FNV-1a, 32-bit. Any stable string->int hash works; this one is short
  // and has no dependencies.
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  return function next() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Returns { options, correctIndex } with options permuted deterministically.
// For multi-select questions correctIndex is undefined — correctness there is
// membership in acceptedAnswers, which survives reordering untouched.
export function presentOptions(q) {
  if (!q || !q.options) return { options: [], correctIndex: 0 };

  const rand = mulberry32(seedFrom(q.id));
  const order = q.options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  return {
    options: order.map((i) => q.options[i]),
    correctIndex: order.indexOf(q.correctIndex),
  };
}
