#!/usr/bin/env node
/**
 * qa-check.js — the build-time QA gate. Storyboard §9.2b / architecture plan §9.
 *
 * Runs in CI before deploy; any failure blocks the deploy. This exists because
 * the storyboard's checklist is otherwise a document someone has to remember to
 * read, and the two classes of content it guards (official test wording, and
 * facts not drawn from M-1778) are exactly the ones where a silent regression
 * teaches a learner something false.
 *
 * What it deliberately does NOT do: claim to verify anything against USCIS.
 * Confirming official wording against a freshly downloaded M-1778, and checking
 * officeholder names, stay human tasks (§9.3, Companion "what still needs a
 * human"). Those are reported as warnings so they stay visible, never as passes.
 *
 *   node scripts/qa-check.js          → fail the build on any error
 *   node scripts/qa-check.js --warn   → report only (used for local runs)
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const contentDir = join(root, 'src', 'lib', 'content');
const srcDir = join(root, 'src');

const errors = [];
const warnings = [];
const passes = [];

const fail = (check, msg) => errors.push(`${check}: ${msg}`);
const warn = (check, msg) => warnings.push(`${check}: ${msg}`);
const pass = (check, msg) => passes.push(`${check}: ${msg}`);

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const UNIT_IDS = ['U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7'];
const EXPECTED_COUNTS = { U1: 14, U2: 20, U3: 23, U4: 5, U5: 10, U6: 17, U7: 39 };

const questions = UNIT_IDS.flatMap((u) =>
  readJson(join(contentDir, `questions-${u.toLowerCase()}.json`))
);
const units = ['unit0', ...UNIT_IDS.map((u) => `unit${u[1]}`)].map((f) =>
  readJson(join(contentDir, `${f}.json`))
);

function allSourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return allSourceFiles(p);
    return /\.(svelte|js)$/.test(e.name) ? [p] : [];
  });
}
const sourceFiles = allSourceFiles(srcDir);
const sourceText = sourceFiles.map((f) => ({ f, text: readFileSync(f, 'utf8') }));

// --- 1. Question integrity -------------------------------------------------
{
  const check = '1 question integrity';
  if (questions.length !== 128) fail(check, `expected 128 questions, found ${questions.length}`);

  const nums = questions.map((q) => Number(q.id.slice(1)));
  const dupes = nums.filter((n, i) => nums.indexOf(n) !== i);
  if (dupes.length) fail(check, `duplicate question numbers: ${[...new Set(dupes)].join(', ')}`);

  const gaps = [];
  for (let i = 1; i <= 128; i += 1) if (!nums.includes(i)) gaps.push(i);
  if (gaps.length) fail(check, `missing question numbers: ${gaps.join(', ')}`);

  for (const [unit, expected] of Object.entries(EXPECTED_COUNTS)) {
    const got = questions.filter((q) => q.unit === unit).length;
    if (got !== expected) fail(check, `${unit} has ${got} questions, coverage matrix says ${expected}`);
  }
  if (!errors.some((e) => e.startsWith(check))) {
    pass(check, '128 questions, gapless, unique, unit counts match the coverage matrix');
  }
}

// --- 2. Q48 freshness ------------------------------------------------------
// v5.2 rule, made mechanical: Cabinet examples render from the question data
// only. A Cabinet title hardcoded in a component survives a data update and
// silently teaches a renamed position.
{
  const check = '2 Q48 freshness';
  const offenders = sourceText.filter(({ text }) => /Secretary of |Attorney General/.test(text));
  if (offenders.length) {
    fail(check, `Cabinet titles hardcoded in source: ${offenders.map((o) => o.f.replace(root, '')).join(', ')}`);
  } else {
    pass(check, 'no Cabinet titles hardcoded outside the question data');
  }
  warn(check, 'Q48 accepted answers must be re-verified against the current M-1778 by hand');
}

// --- 3. Dynamic-answer isolation -------------------------------------------
{
  const check = '3 dynamic-answer isolation';
  const dyn = questions.filter((q) => q.dynamic);
  for (const q of dyn) {
    if (q.options) fail(check, `${q.id} is dynamic but carries a fixed option set`);
    if (q.correctIndex !== undefined) fail(check, `${q.id} is dynamic but carries a correctIndex`);
  }
  const current = readJson(join(contentDir, 'current-answers.json'));
  for (const q of dyn) {
    if (!current.answers[q.id]) fail(check, `${q.id} is dynamic but absent from current-answers.json`);
  }
  if (dyn.length !== 8) fail(check, `expected 8 dynamic questions, found ${dyn.length}`);

  // A dynamic question on a scored practice screen has nothing to answer.
  for (const u of units) {
    for (const s of u.screens) {
      if (s.type !== 'practice') continue;
      const q = questions.find((x) => x.id === s.questionId);
      if (q && q.dynamic) warn(check, `${s.id} practises ${q.id}, a dynamic item — renders as a card, not a scored question`);
    }
  }
  if (!errors.some((e) => e.startsWith(check))) {
    pass(check, 'all 8 dynamic questions resolve through current-answers.json with no fixed options');
  }

  const unverified = Object.entries(current.answers).filter(([, a]) => !a.verified);
  if (unverified.length) {
    warn(check, `${unverified.length} dynamic answers unverified (${unverified.map(([k]) => k).join(', ')}) — they render as "not checked yet", which is honest but incomplete`);
  }
  if (!current.checked) warn(check, 'current-answers.json has no "checked" date');
}

// --- 4. Readability (G-15) -------------------------------------------------
// "Short declarative sentences (aim ≤15 words average), high-frequency
// vocabulary outside taught terms, present tense where meaning allows."
//
// Only OUR prose is measured. Official question wording and accepted answers
// are verbatim USCIS text — we may not rewrite them, so scoring them would be
// noise. cardText and pairedOfficial quote official wording and are excluded
// for the same reason.
//
// The aim is a target, not a hard limit, and the teaching text is final copy
// from the storyboard. So exceeding 15 warns with the number; only genuinely
// unreadable prose fails.
{
  const check = '4 readability';
  const PROSE_KEYS = new Set([
    'body', 'closing', 'resolution', 'handle', 'handleSub', 'example',
    'nonExample', 'takeaway', 'heading', 'afterQuote', 'afterTest',
    'coverageLine', 'learnedLine', 'feedback', 'question',
    'instructions', 'def', 'unitLabel',
    'feedbackExplain',
  ]);
  const LIST_KEYS = new Set(['bodyList', 'bodyList2', 'paragraphs']);

  function harvest(node, out) {
    if (Array.isArray(node)) {
      node.forEach((n) => harvest(n, out));
      return;
    }
    if (!node || typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node)) {
      if (k === 'cardText' || k === 'pairedOfficial' || k === 'options') continue;
      if (typeof v === 'string') {
        if (PROSE_KEYS.has(k)) out.push(v);
      } else if (LIST_KEYS.has(k) && Array.isArray(v)) {
        v.forEach((s) => typeof s === 'string' && out.push(s));
      } else {
        harvest(v, out);
      }
    }
  }

  const syllables = (word) => {
    const w = word.toLowerCase().replace(/[^a-z]/g, '');
    if (!w) return 0;
    if (w.length <= 3) return 1;
    const groups = w
      .replace(/(?:es|ed|[^laeiouy]e)$/, '')
      .match(/[aeiouy]{1,2}/g);
    return groups ? groups.length : 1;
  };

  const rows = [];
  let hardFail = false;
  for (const u of units) {
    const prose = [];
    harvest(u.screens, prose);
    const text = prose.join(' ');
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.split(/\s+/).length > 1);
    const words = text.split(/\s+/).filter((w) => /[a-z]/i.test(w));
    if (!sentences.length || !words.length) continue;

    const avg = words.length / sentences.length;
    const longest = sentences.reduce(
      (a, s) => Math.max(a, s.split(/\s+/).length),
      0
    );
    const syl = words.reduce((n, w) => n + syllables(w), 0);
    // Flesch–Kincaid grade level.
    const fk = 0.39 * avg + 11.8 * (syl / words.length) - 15.59;

    rows.push({ unit: u.id, avg, longest, fk, sentences: sentences.length });

    if (avg > 20) {
      fail(check, `${u.id} averages ${avg.toFixed(1)} words per sentence (G-15 aims for ≤15; >20 is a failure)`);
      hardFail = true;
    }
    if (longest > 45) {
      fail(check, `${u.id} contains a ${longest}-word sentence — unreadable at this level`);
      hardFail = true;
    }
  }

  for (const r of rows) {
    const note = `${r.unit}: ${r.avg.toFixed(1)} words/sentence, longest ${r.longest}, ~grade ${r.fk.toFixed(1)}`;
    if (r.avg > 15) warn(check, `${note} — above the ≤15 aim`);
  }
  if (!hardFail) {
    const worst = rows.reduce((a, b) => (b.avg > a.avg ? b : a), rows[0]);
    pass(
      check,
      `all ${rows.length} units within the readable band (worst: ${worst.unit} at ${worst.avg.toFixed(1)} words/sentence)`
    );
  }
  warn(check, 'grade level is indicative only — the storyboard\'s copy is final and is not rewritten to chase a score');
}

// --- 5. Contrast, audited twice --------------------------------------------
// Light and dark are two separate audits (storyboard §8 / dark-theme build
// requirement), not one palette passed through a filter. Text needs 4.5:1;
// UI boundaries that carry meaning need 3:1.
{
  const check = '5 contrast';
  const config = readFileSync(join(root, 'tailwind.config.js'), 'utf8');
  const colors = {};
  for (const m of config.matchAll(/'?([a-z-]+)'?\s*:\s*'(#[0-9A-Fa-f]{6})'/g)) {
    colors[m[1]] = m[2];
  }

  const srgb = (h) =>
    [1, 3, 5].map((i) => {
      const v = parseInt(h.substr(i, 2), 16) / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
  const lum = (h) => {
    const [r, g, b] = srgb(h);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  // 'text' = 4.5:1. 'ui' = 3:1, for boundaries that MEAN something —
  // border-interactive is the "you can tap this" signal (G-16), the focus ring
  // must be findable, and the correct-answer marker must be distinguishable.
  //
  // The plain `border` token is deliberately absent: it draws decorative
  // dividers and container edges that carry no state and no affordance, which
  // WCAG 1.4.11 exempts. Listing it would manufacture a failure that means
  // nothing — but note that this is exactly why `border` must never be used to
  // signal that something is tappable.
  const PAIRS = [
    ['light', 'text', 'ink', 'surface'],
    ['light', 'text', 'ink', 'raised'],
    ['light', 'text', 'ink-secondary', 'surface'],
    ['light', 'text', 'ink-secondary', 'raised'],
    ['light', 'text', 'ink-muted', 'surface'],
    ['light', 'text', 'ink-muted', 'raised'],
    ['light', 'text', 'accent-ink', 'accent'],
    ['light', 'text', 'ink', 'gotit-bg'],
    ['light', 'text', 'gotit', 'gotit-bg'],
    ['light', 'text', 'notyet', 'notyet-bg'],
    ['light', 'text', 'ink', 'notyet-bg'],
    ['light', 'ui', 'notyet', 'surface'],
    ['light', 'ui', 'notyet', 'raised'],
    ['light', 'text', 'surface', 'ink'],
    ['light', 'ui', 'border-interactive', 'surface'],
    ['light', 'ui', 'border-interactive', 'raised'],
    ['light', 'ui', 'border-interactive', 'gotit-bg'],
    ['light', 'ui', 'accent', 'surface'],
    ['light', 'ui', 'accent', 'raised'],
    ['light', 'ui', 'gotit', 'gotit-bg'],
    ['light', 'ui', 'ink', 'raised'],
    ['dark', 'text', 'dark-ink', 'dark-surface'],
    ['dark', 'text', 'dark-ink', 'dark-raised'],
    ['dark', 'text', 'dark-ink-secondary', 'dark-surface'],
    ['dark', 'text', 'dark-ink-secondary', 'dark-raised'],
    ['dark', 'text', 'dark-ink-muted', 'dark-surface'],
    ['dark', 'text', 'dark-ink-muted', 'dark-raised'],
    ['dark', 'text', 'dark-accent-ink', 'dark-accent'],
    ['dark', 'text', 'dark-ink', 'dark-gotit-bg'],
    ['dark', 'text', 'dark-gotit', 'dark-gotit-bg'],
    ['dark', 'text', 'dark-notyet', 'dark-notyet-bg'],
    ['dark', 'text', 'dark-ink', 'dark-notyet-bg'],
    ['dark', 'ui', 'dark-notyet', 'dark-surface'],
    ['dark', 'ui', 'dark-notyet', 'dark-raised'],
    ['dark', 'text', 'dark-surface', 'dark-ink'],
    ['dark', 'ui', 'dark-border-interactive', 'dark-surface'],
    ['dark', 'ui', 'dark-border-interactive', 'dark-raised'],
    ['dark', 'ui', 'dark-border-interactive', 'dark-gotit-bg'],
    ['dark', 'ui', 'dark-accent', 'dark-surface'],
    ['dark', 'ui', 'dark-accent', 'dark-raised'],
    ['dark', 'ui', 'dark-gotit', 'dark-gotit-bg'],
    ['dark', 'ui', 'dark-ink', 'dark-raised'],
  ];

  const worst = { light: Infinity, dark: Infinity };
  for (const [theme, kind, fg, bg] of PAIRS) {
    if (!colors[fg] || !colors[bg]) {
      fail(check, `token missing from tailwind.config.js: ${!colors[fg] ? fg : bg}`);
      continue;
    }
    const r = ratio(colors[fg], colors[bg]);
    const min = kind === 'text' ? 4.5 : 3;
    if (r < min) {
      fail(check, `${theme}: ${fg} on ${bg} is ${r.toFixed(2)}:1, needs ${min}:1`);
    }
    worst[theme] = Math.min(worst[theme], r / min);
  }
  if (!errors.some((e) => e.startsWith(check))) {
    pass(
      check,
      `${PAIRS.length} token pairs across two independent audits (light and dark) meet 4.5:1 / 3:1`
    );
  }
  warn(check, 'photographs need a human glare check in dark mode — not measurable here');
}

// --- 9. Distractor safety --------------------------------------------------
// Wrong-category rule: a distractor must not be a plausible false fact about
// the same subject, because repeated exposure would teach the error. Full
// judgement is human; what is mechanical is that a distractor must never be
// one of the question's own accepted answers.
{
  const check = '9 distractor safety';
  for (const q of questions) {
    if (!q.options || q.multiSelect) continue;
    q.options.forEach((opt, i) => {
      if (i !== q.correctIndex && q.acceptedAnswers.includes(opt)) {
        fail(check, `${q.id} distractor "${opt}" is also an accepted answer`);
      }
    });
    if (!q.acceptedAnswers.includes(q.options[q.correctIndex])) {
      fail(check, `${q.id} correct option "${q.options[q.correctIndex]}" is not among its accepted answers`);
    }
  }
  for (const q of questions.filter((x) => x.multiSelect)) {
    const correct = q.options.filter((o) => q.acceptedAnswers.includes(o)).length;
    if (correct < q.multiSelect) {
      fail(check, `${q.id} needs ${q.multiSelect} correct options but only ${correct} are accepted answers`);
    }
  }
  if (!errors.some((e) => e.startsWith(check))) {
    pass(check, 'every correct option is an accepted answer; no distractor is');
  }
}

// --- 7. Counter honesty ----------------------------------------------------
// G-22: no screen may claim the learner "can answer N" questions they have
// only been shown. Taught ≠ practiced.
{
  const check = '7 counter honesty';
  const banned = /can answer \d+|you can answer/i;
  const hits = [
    ...sourceText.filter(({ text }) => banned.test(text)).map((o) => o.f.replace(root, '')),
    ...units
      .filter((u) => banned.test(JSON.stringify(u)))
      .map((u) => `${u.id} content`),
  ];
  if (hits.length) fail(check, `prohibited coverage claim found in: ${hits.join(', ')}`);
  else pass(check, 'no screen claims the learner "can answer" questions merely shown');
}

// --- 6. Alt text -----------------------------------------------------------
{
  const check = '6 alt text';
  // The storyboard is explicit: alt text is authored at storyboard stage and
  // "a missing alt fails QA". Not a warning.
  let missing = 0;
  for (const u of units) {
    for (const s of u.screens) {
      if (s.image && !s.alt) {
        missing += 1;
        fail(check, `${s.id} has image "${s.image}" with no alt text`);
      }
      for (const col of s.twoColumn || []) {
        if (col.image && !col.alt) {
          missing += 1;
          fail(check, `${s.id} two-column image "${col.image}" has no alt text`);
        }
      }
    }
  }
  if (missing === 0) pass(check, 'every asset-bearing screen carries alt text');
}

// --- 8. Zero external requests ---------------------------------------------
// G-11/G-12. Only uscis.gov links the learner taps are permitted; the app
// itself must make no third-party request at runtime.
{
  const check = '8 zero external requests';
  const ALLOWED = /^https:\/\/(www\.)?uscis\.gov\//;
  const offenders = [];
  for (const { f, text } of sourceText) {
    const urls = text.match(/https?:\/\/[^\s"'`)]+/g) || [];
    for (const url of urls) {
      if (ALLOWED.test(url)) continue;
      if (/^https?:\/\/(www\.)?(w3\.org|svelte\.dev)/.test(url)) continue; // namespaces & doc links in error text
      offenders.push(`${f.replace(root, '')} → ${url}`);
    }
  }
  const fetchers = sourceText
    .filter(({ text }) => /\bfetch\(|XMLHttpRequest|new WebSocket|navigator\.sendBeacon/.test(text))
    .map((o) => o.f.replace(root, ''));
  if (fetchers.length) fail(check, `network API used in: ${fetchers.join(', ')}`);
  if (offenders.length) fail(check, `non-permitted external URL: ${offenders.join(', ')}`);
  if (!errors.some((e) => e.startsWith(check))) {
    pass(check, 'no network APIs and no external URLs beyond the permitted uscis.gov links');
  }
}

// --- 10. Screen/content integrity (extra; cheap and catches wiring slips) ---
{
  const check = '10 content wiring';
  const ids = new Set(questions.map((q) => q.id));
  const screenIds = new Set();
  for (const u of units) {
    for (const s of u.screens) {
      if (screenIds.has(s.id)) fail(check, `duplicate screen id ${s.id}`);
      screenIds.add(s.id);
      const refs = [
        ...(s.questionId ? [s.questionId] : []),
        ...(s.sampleQuestionId ? [s.sampleQuestionId] : []),
        ...(s.questionIds || []),
      ];
      for (const r of refs) if (!ids.has(r)) fail(check, `${s.id} references unknown question ${r}`);
    }
    // Coverage guarantee. This used to be enforced by the beat-8
    // "officialQuestions" screen listing every question in the unit. That
    // screen was removed — it taught nothing and only re-listed questions
    // already reachable in three other places — so the guarantee moves here
    // rather than disappearing with it: every unit must offer a full-bank set
    // sized to its whole question count. G-08 draws from getUnitQuestions(),
    // so coverage is then structural.
    if (u.id !== 'U0') {
      const expected = questions.filter((q) => q.unit === u.id).length;
      const li = u.screens.find((s) => s.type === 'lockItIn');
      if (!li) {
        fail(check, `${u.id} has no lockItIn screen, so it offers no full-bank practice`);
      } else if (!li.fullBankOffer) {
        fail(check, `${u.id} lockItIn carries no fullBankOffer — its ${expected} questions would be unreachable as practice`);
      } else if (li.fullBankOffer.total !== expected) {
        fail(check, `${u.id} offers full-bank practice for ${li.fullBankOffer.total} questions but the unit has ${expected}`);
      } else if (li.fullBankOffer.unit !== u.id) {
        fail(check, `${u.id} fullBankOffer points at ${li.fullBankOffer.unit}`);
      }
    }
    if (u.questionCount !== undefined) {
      const n = questions.filter((q) => q.unit === u.id).length;
      if (n !== u.questionCount) fail(check, `${u.id} declares questionCount ${u.questionCount} but has ${n}`);
    }
  }
  // Guided practice must rotate cognitive processes, not repeat one (Strategy
  // §1 fourth failure) — and each item must carry the fields its kind needs.
  for (const u of units) {
    const gp = u.screens.find((s) => s.type === 'guidedPractice');
    if (!gp) continue;
    const kinds = new Set(gp.items.map((i) => i.kind));
    if (kinds.size < 3) fail(check, `${u.id} guided practice uses only ${kinds.size} process(es)`);
    gp.items.forEach((it, n) => {
      const where = `${u.id} guided item ${n + 1} (${it.kind})`;
      if (it.kind === 'compare') {
        if (!it.buckets || !it.sortItems) fail(check, `${where} missing buckets/sortItems`);
        else
          it.sortItems.forEach((si, k) => {
            if (si.bucket === undefined) fail(check, `${where} sortItem ${k} has no bucket`);
            else if (si.bucket < 0 || si.bucket >= it.buckets.length)
              fail(check, `${where} sortItem ${k} bucket out of range`);
          });
      } else if (it.kind === 'order') {
        if (!it.orderItems || it.orderItems.length < 3) fail(check, `${where} needs at least 3 orderItems`);
      } else if (!it.options || it.correctIndex === undefined || it.correctIndex >= it.options.length) {
        fail(check, `${where} has no valid options/correctIndex`);
      }
    });
  }
  if (!errors.some((e) => e.startsWith(check))) {
    pass(check, 'screens, question references and guided-practice items all resolve');
  }
}

// --- Human-only items, always reported -------------------------------------
// --- 11. Tap targets -------------------------------------------------------
// Storyboard §8: 48px tap targets. Enforced structurally — every button must
// carry .tap (min-height 48px) or one of the .btn-* classes, which are taller
// than 48px by construction.
//
// The exception list is deliberately tiny and named. WCAG 2.5.8 exempts a
// target that sits inline within a sentence, because enlarging it would break
// the line it lives in; Home's footer "Help · Settings" is exactly that case.
// Anything not on this list must meet the rule.
{
  const check = '11 tap targets';
  const INLINE_EXCEPTIONS = [
    "navigate('/help')",
    "navigate('/settings')",
  ];
  const offenders = [];
  for (const { f, text } of sourceText) {
    if (!f.endsWith('.svelte')) continue;
    // NOT /<button[\s\S]*?>/ — an arrow function in on:click contains a ">",
    // so a non-greedy match to the first ">" truncates the tag and loses the
    // handler the exception list keys on. Take a fixed window instead.
    const buttons = [...text.matchAll(/<button/g)].map((m) =>
      text.slice(m.index, m.index + 320)
    );
    for (const b of buttons) {
      if (/\btap\b|btn-primary|btn-secondary/.test(b)) continue;
      if (INLINE_EXCEPTIONS.some((ex) => b.includes(ex))) continue;
      const cls = (b.match(/class="([^"]*)"/) || [, '(no class)'])[1];
      offenders.push(`${f.replace(root, '')} → ${cls.slice(0, 70)}`);
    }
  }
  if (offenders.length) {
    fail(check, `${offenders.length} control(s) without a 48px target:\n          ${offenders.join('\n          ')}`);
  } else {
    pass(check, 'every interactive control carries a 48px minimum target (.tap or .btn-*)');
  }
}

// --- 12. No self-graded reveal in unit content -----------------------------
// Storyboard v5.0 converted all 33 self-graded tap-to-reveal / read-and-answer
// practice items in Units 1–7 to single-select, and kept the mechanic for
// Rehearsal ONLY — the one screen that simulates the real interview's
// no-options format. Rehearsal implements it inline and is not unit content.
//
// This exists because two screens (U1-S14, U1-S15) survived that conversion
// unnoticed for the life of the project: they showed a learner the accepted
// answers to a question they had never been taught to answer, then asked them
// to grade themselves. A JSON edit could reintroduce that silently.
{
  const check = '12 no self-graded reveal';
  const offenders = [];
  for (const u of units) {
    for (const s of u.screens) {
      if (s.type === 'readAndAnswer') offenders.push(`${s.id} (${s.questionId || '?'})`);
    }
  }
  if (offenders.length) {
    fail(
      check,
      `unit content uses readAndAnswer, abolished outside Rehearsal by v5.0: ${offenders.join(', ')}`
    );
  } else {
    pass(check, 'no unit screen uses self-graded reveal; it survives in Rehearsal only');
  }
}

// --- 13. Unreviewed translations stay out of the build --------------------
// Translation sources live in docs/translations/ and carry
// translationStatus: "draft-unreviewed". The storyboard requires native review
// before Burmese reaches a learner, so nothing under src/ may import them —
// otherwise unreviewed text is one line away from shipping, and nothing else
// would notice. See docs/ARCHITECTURE.md §2.
{
  const check = '13 unreviewed translations not shipped';
  const offenders = [];
  for (const { f, text } of sourceText) {
    if (/from\s+['"][^'"]*docs\/translations|require\(\s*['"][^'"]*docs\/translations/.test(text)) {
      offenders.push(f.replace(root, ''));
    }
  }
  if (offenders.length) {
    fail(check, `src/ imports a translation source: ${offenders.join(', ')}`);
  } else {
    pass(check, 'no src/ file imports docs/translations/');
  }

  // If any source file is present, report its review status so an unreviewed
  // one cannot quietly be assumed finished.
  const dir = join(root, 'docs', 'translations');
  let files = [];
  try {
    files = readdirSync(dir).filter((n) => n.endsWith('.json'));
  } catch {
    // No translation sources yet — nothing to report.
  }
  for (const name of files) {
    const t = readJson(join(dir, name));
    if (t.translationStatus !== 'reviewed') {
      warn(check, `docs/translations/${name} is "${t.translationStatus || 'unmarked'}" — not fit to ship`);
    }
  }
}

// --- 14. Every UI string key resolves ---------------------------------------
// t() returns the key itself when it is unknown, so a typo renders as
// "home.contnue" on screen rather than blank. Visible is better than silent,
// but neither should ship.
{
  const check = '14 ui string keys resolve';
  const strings = readJson(join(contentDir, 'ui-strings.json'));
  const defined = new Set(Object.keys(strings).filter((k) => !k.startsWith('_')));
  const used = new Set();
  for (const { text } of sourceText) {
    // Strip comments first: a doc example like `{$t('home.continue')}` in a
    // JSDoc block is not a usage, and counting it reports a phantom missing key.
    const code = text
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
      .replace(/<!--[\s\S]*?-->/g, '');
    for (const m of code.matchAll(/\$t\(\s*['"]([^'"]+)['"]/g)) used.add(m[1]);
  }
  const missing = [...used].filter((k) => !defined.has(k));
  const orphaned = [...defined].filter((k) => !used.has(k));

  if (missing.length) fail(check, `used in source but absent from ui-strings.json: ${missing.join(', ')}`);
  if (orphaned.length) warn(check, `defined but never used: ${orphaned.join(', ')}`);
  if (!missing.length) pass(check, `all ${used.size} keys used in source are defined`);

  const untranslated = [...defined].filter((k) => strings[k].my === null);
  if (untranslated.length) {
    warn(check, `${untranslated.length}/${defined.size} UI strings have no Burmese yet — they fall back to English`);
  }
}

// --- 15. Translation overlays target real fields ----------------------------
// An overlay key that does not exist on the English screen is dead weight the
// renderer never reads, and it would hide a schema drift silently.
{
  const check = '15 translation overlays valid';
  const dir = join(root, 'src', 'lib', 'content', 'translations');
  let langs = [];
  try {
    langs = readdirSync(dir);
  } catch {
    // No overlays yet.
  }
  let checked = 0;
  for (const lang of langs) {
    let files = [];
    try {
      files = readdirSync(join(dir, lang)).filter((n) => n.endsWith('.json'));
    } catch {
      continue;
    }
    for (const name of files) {
      const overlay = readJson(join(dir, lang, name));
      const en = readJson(join(contentDir, name));
      const byId = Object.fromEntries(en.screens.map((s) => [s.id, s]));
      for (const [screenId, fields] of Object.entries(overlay)) {
        const screen = byId[screenId];
        if (!screen) {
          fail(check, `${lang}/${name}: ${screenId} is not a screen in ${name}`);
          continue;
        }
        for (const [field, value] of Object.entries(fields)) {
          checked += 1;
          if (!(field in screen)) {
            fail(check, `${lang}/${name}: ${screenId}.${field} does not exist on the English screen`);
          } else if (Array.isArray(screen[field]) && Array.isArray(value) && screen[field].length !== value.length) {
            fail(check, `${lang}/${name}: ${screenId}.${field} has ${value.length} items, English has ${screen[field].length}`);
          }
        }
      }
    }
  }
  if (!errors.some((e) => e.startsWith(check))) {
    pass(check, `${checked} overlay field(s) resolve to real English fields`);
  }
}

// Contrast and readability USED to be listed here as human-only. They are not:
// both are mechanical and are now checks 4 and 5. What genuinely cannot be
// done in this script is anything requiring the source document or human
// judgement about rendered output.
warn('human', 'official wording and accepted answers must be confirmed against a freshly downloaded M-1778');
warn('human', 'text at 200% zoom and with a screen reader needs a real device pass (WCAG 1.4.4 / 4.1.2)');

// --- Report ----------------------------------------------------------------
const warnOnly = process.argv.includes('--warn');

const byNumber = (a, b) => (parseInt(a, 10) || 99) - (parseInt(b, 10) || 99);

console.log('\nBuild-time QA gate — storyboard §9.2b\n');
for (const p of [...passes].sort(byNumber)) console.log(`  PASS  ${p}`);
for (const w of [...warnings].sort(byNumber)) console.log(`  WARN  ${w}`);
for (const e of [...errors].sort(byNumber)) console.log(`  FAIL  ${e}`);

console.log(
  `\n${passes.length} passed · ${warnings.length} warnings · ${errors.length} failures\n`
);

if (errors.length && !warnOnly) {
  console.error('QA gate failed — deploy blocked.\n');
  process.exit(1);
}
