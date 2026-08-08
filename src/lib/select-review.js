// select-review.js — pool composition for R1–R3 and Rehearsal.
//
// Storyboard §8. Two selection jobs live here so the screens stay dumb:
//
//   buildReviewPool  — 8–10 interleaved items, re-queue drained first, then
//                      filled by the distribution rule, then order randomised.
//   buildRehearsalSet — stratified random across all seven units so every
//                      rehearsal resembles the real test's spread.
//
// Both are seeded and deterministic per attempt so a learner who reloads
// mid-review gets the same items back rather than a fresh set.

import { getAllQuestions } from './content/questions.js';

// Which units each review draws from (a review runs after U2, U5, U7).
export const REVIEWS = {
  R1: { id: 'R1', label: 'Review 1', after: 'U2', units: ['U1', 'U2'], size: 8 },
  R2: {
    id: 'R2',
    label: 'Review 2',
    after: 'U5',
    units: ['U1', 'U2', 'U3', 'U4', 'U5'],
    size: 8,
  },
  R3: {
    id: 'R3',
    label: 'Review 3',
    after: 'U7',
    units: ['U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7'],
    size: 10,
  },
};

export const REVIEW_ORDER = ['R1', 'R2', 'R3'];

function mulberry32(seed) {
  return function next() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, rand) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Only questions that can actually be graded. ◆ dynamic items are lookups
// against current-answers.json, never scored — including one here would put
// an ungradable card in the middle of a scored review.
function gradable(q) {
  return !q.dynamic && Array.isArray(q.options) && q.options.length > 0;
}

/**
 * R1–R3 pool.
 *
 * Order of composition, per §8:
 *   1. drain the re-queue (questions previously answered wrong) first
 *   2. fill by the distribution rule — every taught unit must contribute at
 *      least one item, so no unit goes more than two review cycles unseen
 *   3. top up from the remaining pool
 *   4. randomise the final order (interleaving is the point)
 */
export function buildReviewPool(reviewId, reviewQueue = [], seed = 1) {
  const review = REVIEWS[reviewId];
  if (!review) return [];

  const rand = mulberry32(seed);
  const inScope = getAllQuestions().filter(
    (q) => review.units.includes(q.unit) && gradable(q)
  );
  const byId = Object.fromEntries(inScope.map((q) => [q.id, q]));

  const chosen = [];
  const take = (q) => {
    if (q && !chosen.some((c) => c.id === q.id)) chosen.push(q);
  };

  // 1. Re-queued wrong answers, oldest first, capped so they cannot crowd
  //    out the distribution rule entirely.
  const requeued = reviewQueue.map((id) => byId[id]).filter(Boolean);
  shuffle(requeued, rand)
    .slice(0, Math.floor(review.size / 2))
    .forEach(take);

  // 2. Distribution rule — one guaranteed item per taught unit.
  for (const unit of review.units) {
    if (chosen.length >= review.size) break;
    const pool = inScope.filter(
      (q) => q.unit === unit && !chosen.some((c) => c.id === q.id)
    );
    if (pool.length) take(shuffle(pool, rand)[0]);
  }

  // 3. Top up.
  const rest = shuffle(
    inScope.filter((q) => !chosen.some((c) => c.id === q.id)),
    rand
  );
  for (const q of rest) {
    if (chosen.length >= review.size) break;
    take(q);
  }

  // 4. Interleave.
  return shuffle(chosen, rand).slice(0, review.size);
}

/** Which reviews are unlocked, given the units finished so far. */
export function unlockedReviews(unitsCompleted = []) {
  return REVIEW_ORDER.filter((id) => unitsCompleted.includes(REVIEWS[id].after));
}

/**
 * Rehearsal draw — stratified across all seven units in proportion to each
 * unit's share of the 128, so a rehearsal resembles the real test's spread
 * rather than over-sampling the big units by chance.
 *
 * `max` is the real interview's ceiling of 20 questions.
 */
export function buildRehearsalSet(max = 20, seed = 1) {
  const rand = mulberry32(seed);
  const all = getAllQuestions().filter(gradable);
  const units = ['U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7'];

  const pools = {};
  for (const unit of units) {
    const pool = all.filter((q) => q.unit === unit);
    if (pool.length) pools[unit] = shuffle(pool, rand);
  }
  const present = Object.keys(pools);
  if (!present.length) return [];

  // A test shorter than the number of units cannot hold one of each, so the
  // guarantee below would overshoot. Spread across as many units as fit.
  if (max <= present.length) {
    return shuffle(present, rand)
      .slice(0, max)
      .map((u) => pools[u][0]);
  }

  // Quotas must sum to `max` BY CONSTRUCTION. Rounding each unit's share
  // independently and truncating the total afterwards is what an earlier
  // version did, and it summed to 21 for a 20-question test — so the final
  // slice could discard a small unit's only representative. U4 has just 5 of
  // the 128, so U4 was the one that vanished.
  const quota = {};
  for (const u of present) quota[u] = Math.min(1, pools[u].length);
  let allocated = present.reduce((n, u) => n + quota[u], 0);

  // Largest-remainder apportionment of whatever is left.
  const remaining = Math.max(0, max - allocated);
  const totalPool = present.reduce((n, u) => n + pools[u].length, 0);
  const exact = present.map((u) => ({
    unit: u,
    want: (pools[u].length / totalPool) * remaining,
  }));
  for (const e of exact) {
    const add = Math.min(Math.floor(e.want), pools[e.unit].length - quota[e.unit]);
    quota[e.unit] += add;
    allocated += add;
  }
  exact
    .sort((a, b) => (b.want % 1) - (a.want % 1))
    .forEach((e) => {
      if (allocated >= max) return;
      if (quota[e.unit] >= pools[e.unit].length) return;
      quota[e.unit] += 1;
      allocated += 1;
    });

  // Any shortfall (a unit ran out) spills to units that still have questions.
  let guard = 0;
  while (allocated < max && guard < 1000) {
    guard += 1;
    const spill = present.find((u) => quota[u] < pools[u].length);
    if (!spill) break;
    quota[spill] += 1;
    allocated += 1;
  }

  const picked = present.flatMap((u) => pools[u].slice(0, quota[u]));
  return shuffle(picked, rand); // already exactly `allocated` long — never truncated
}
