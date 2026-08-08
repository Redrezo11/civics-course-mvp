// questions.js — merges all per-unit question data into one lookup by id.
// Adding a unit's questions later is: write questions-uN.json, import and
// spread it in here. No other file needs to change.

import u1 from './questions-u1.json';

const all = [...u1];

const byId = Object.fromEntries(all.map((q) => [q.id, q]));

export function getQuestion(id) {
  return byId[id] || null;
}

export function getUnitQuestions(unitId) {
  return all.filter((q) => q.unit === unitId);
}
