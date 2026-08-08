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

// --- 5. Distractor safety --------------------------------------------------
// Wrong-category rule: a distractor must not be a plausible false fact about
// the same subject, because repeated exposure would teach the error. Full
// judgement is human; what is mechanical is that a distractor must never be
// one of the question's own accepted answers.
{
  const check = '5 distractor safety';
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

// --- 6. Counter honesty ----------------------------------------------------
// G-22: no screen may claim the learner "can answer N" questions they have
// only been shown. Taught ≠ practiced.
{
  const check = '6 counter honesty';
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

// --- 7. Alt text -----------------------------------------------------------
{
  const check = '7 alt text';
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

// --- 9. Screen/content integrity (not in §9.2b; added because it is cheap) --
{
  const check = '9 content wiring';
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
    const oq = u.screens.find((s) => s.type === 'officialQuestions');
    if (oq) {
      const expected = questions.filter((q) => q.unit === u.id).map((q) => q.id).sort();
      const got = [...oq.questionIds].sort();
      if (JSON.stringify(expected) !== JSON.stringify(got)) {
        fail(check, `${u.id} official-questions screen lists ${got.length} of its ${expected.length} questions`);
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
warn('human', 'official wording and accepted answers must be confirmed against a freshly downloaded M-1778');
warn('human', 'light and dark themes are two separate contrast audits (§8) — not checked here');
warn('human', 'readability band (G-15) not checked here');

// --- Report ----------------------------------------------------------------
const warnOnly = process.argv.includes('--warn');

console.log('\nBuild-time QA gate — storyboard §9.2b\n');
for (const p of passes) console.log(`  PASS  ${p}`);
for (const w of warnings) console.log(`  WARN  ${w}`);
for (const e of errors) console.log(`  FAIL  ${e}`);

console.log(
  `\n${passes.length} passed · ${warnings.length} warnings · ${errors.length} failures\n`
);

if (errors.length && !warnOnly) {
  console.error('QA gate failed — deploy blocked.\n');
  process.exit(1);
}
