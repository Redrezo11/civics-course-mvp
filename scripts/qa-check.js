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

import { readFileSync, readdirSync, existsSync } from 'node:fs';
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

// Shared with the app and with scripts/audio-assets.js, so 'which screens are
// narrated' has exactly one definition.
import { NARRATED_FIELDS } from '../src/lib/narration-text.js';
import { textHash } from '../src/lib/text-hash.js';
import { STANDALONE_NARRATION } from '../src/lib/content/standalone-narration.js';
import { xmlProblems } from './lib/xml-check.js';

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

  // The Burmese gloss under an answer, READ FROM THE COMPONENT rather than
  // listed here. It renders on the answered-state backgrounds as well as the
  // resting ones, and none of those pairs was audited before because no text
  // used a secondary token there.
  //
  // Derived on purpose: a hardcoded pair would keep passing while someone
  // swapped the component to a lighter grey. ink-muted was the first choice and
  // fails at 4.38:1 on dark-gotit-bg, so this is a live risk, not a theoretical
  // one.
  {
    const label = join(srcDir, 'lib', 'components', 'AnswerLabel.svelte');
    const markup = readFileSync(label, 'utf8');
    // The light and dark colour classes are written adjacently on the gloss
    // span, so match that pair directly rather than parsing the whole tag.
    const m = /text-([a-z][a-z-]*) dark:text-(dark-[a-z-]+)/.exec(markup);
    if (!m) {
      fail(check, 'could not read the gloss colour out of AnswerLabel.svelte — the audit below is not covering it');
    } else {
      const [, lightTok, darkTok] = m;
      for (const bg of ['raised', 'surface', 'gotit-bg', 'notyet-bg']) {
        PAIRS.push(['light', 'text', lightTok, bg]);
        PAIRS.push(['dark', 'text', darkTok, `dark-${bg}`]);
      }
    }
  }

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
      // An empty alt is CORRECT for decoration — it is how HTML says "this
      // picture carries no information". But it looks identical to a forgotten
      // one, so the screen has to SAY it is decorative. Silence is the failure,
      // not emptiness.
      if (s.image && !s.alt && !s.decorative) {
        missing += 1;
        fail(check, `${s.id} has image "${s.image}" with no alt text and no decorative flag`);
      }
      if (s.decorative && s.alt) {
        missing += 1;
        fail(check, `${s.id} is marked decorative but also carries alt text — a screen reader would announce a picture that carries nothing`);
      }
      for (const col of s.twoColumn || []) {
        if (col.image && !col.alt) {
          missing += 1;
          fail(check, `${s.id} two-column image "${col.image}" has no alt text`);
        }
      }
      for (const pic of s.imageRow || []) {
        if (pic.image && !pic.alt) {
          missing += 1;
          fail(check, `${s.id} row image "${pic.image}" has no alt text`);
        }
      }
    }
  }
  // One picture, one description.
  //
  // Alt text describes the file, not the screen it sits on, so the same image
  // used twice must read the same way both times — and two different images
  // must not share a description, or a screen-reader user is told they are
  // looking at something they are not. `declaration-of-independence.webp`
  // appears on U1-S08 and U6-S06 and is correctly described identically on
  // both; nothing was checking that it stayed that way.
  const altsFor = new Map(); // image -> Map(alt -> [screen ids])
  const noteAlt = (image, alt, id) => {
    if (!image || !alt) return;
    if (!altsFor.has(image)) altsFor.set(image, new Map());
    const byText = altsFor.get(image);
    if (!byText.has(alt)) byText.set(alt, []);
    byText.get(alt).push(id);
  };
  for (const u of units) {
    for (const s of u.screens) {
      noteAlt(s.image, s.alt, s.id);
      for (const col of s.twoColumn || []) noteAlt(col.image, col.alt, s.id);
      for (const pic of s.imageRow || []) noteAlt(pic.image, pic.alt, s.id);
    }
  }
  let inconsistent = 0;
  for (const [image, byText] of altsFor) {
    if (byText.size > 1) {
      inconsistent += 1;
      fail(
        check,
        `"${image}" is described ${byText.size} different ways — ${[...byText.entries()]
          .map(([t, ids]) => `${ids.join('/')}: "${t.slice(0, 40)}…"`)
          .join(' vs ')}`
      );
    }
  }
  const byAlt = new Map();
  for (const [image, byText] of altsFor) {
    for (const t of byText.keys()) {
      if (!byAlt.has(t)) byAlt.set(t, new Set());
      byAlt.get(t).add(image);
    }
  }
  for (const [text, images] of byAlt) {
    if (images.size > 1) {
      inconsistent += 1;
      fail(check, `${images.size} different images share one description "${text.slice(0, 50)}…" — ${[...images].join(', ')}`);
    }
  }

  if (missing === 0 && inconsistent === 0) {
    pass(
      check,
      `every asset-bearing screen carries alt text or declares itself decorative; ${altsFor.size} images each described one way`
    );
  }
}

// --- 8. One file may call out, and only where the LMS points ----------------
//
// G-11/G-12 was never "no network". It was NO SERVER OF OURS AND NO THIRD
// PARTY, so that a learner's practice is not observable by anyone who was not
// already part of the arrangement. An LRS supplied at launch by the
// organisation the learner enrolled with is neither.
//
// So the rule narrowed rather than loosened. It used to be "nothing in src/ may
// call the network". It is now "exactly one file may, and every address it uses
// comes from a launch parameter" — which is a stronger guarantee, because the
// second clause is checkable and the old rule had nothing to say about where a
// request would go once one was permitted.
{
  const check = '8 network confined to the LMS session';
  const ALLOWED = /^https:\/\/(www\.)?uscis\.gov\//;
  // The one module permitted to make requests. Adding a second name here is a
  // decision about the project's privacy guarantee, not a build fix.
  const NETWORK_MODULE = 'src/lib/cmi5.js';
  const rel = (f) => f.replace(root, '').replace(/\\/g, '/').replace(/^\//, '');

  const offenders = [];
  for (const { f, text } of sourceText) {
    const urls = text.match(/https?:\/\/[^\s"'`)]+/g) || [];
    for (const url of urls) {
      if (ALLOWED.test(url)) continue;
      // Namespaces and identifiers, which are names rather than addresses —
      // xAPI verb and extension IRIs are never fetched.
      if (/^https?:\/\/(www\.)?(w3\.org|w3id\.org|svelte\.dev|adlnet\.gov)/.test(url)) continue;
      offenders.push(`${rel(f)} → ${url}`);
    }
  }

  const fetchers = sourceText
    .filter(({ text }) => /\bfetch\(|XMLHttpRequest|new WebSocket|navigator\.sendBeacon/.test(text))
    .map(({ f }) => rel(f))
    .filter((f) => f !== NETWORK_MODULE);
  if (fetchers.length) fail(check, `network API used outside ${NETWORK_MODULE}: ${fetchers.join(', ')}`);
  if (offenders.length) fail(check, `non-permitted external URL: ${offenders.join(', ')}`);

  // Every address the session uses must come from the launch query string. A
  // hardcoded host in this file would mean a learner's progress going somewhere
  // the LMS did not name — which is the thing G-12 actually forbids.
  const session = sourceText.find(({ f }) => rel(f) === NETWORK_MODULE);
  if (!session) {
    fail(check, `${NETWORK_MODULE} not found — the network module was renamed without updating this check`);
  } else {
    const inFetch = session.text.match(/fetch\(\s*[`'"](https?:)?\/\/[^`'"]+/g) || [];
    if (inFetch.length) {
      fail(check, `${NETWORK_MODULE} builds a request from a hardcoded address: ${inFetch.join(', ')}`);
    }
    if (!/param\('endpoint'\)/.test(session.text)) {
      fail(check, `${NETWORK_MODULE} does not read its endpoint from the launch parameters`);
    }
  }

  if (!errors.some((e) => e.startsWith(check))) {
    pass(check, `only ${NETWORK_MODULE} calls out, and every address comes from the launch parameters`);
  }
}

// --- 21. Nothing is ever counted against the learner ------------------------
//
// Rule G-1. The rehearsal is self-marked — the learner taps "Yes, I got it" or
// "Not yet" and nothing measures the answer — and no other screen scores
// anything either. There is therefore no honest Failed statement this course
// could send.
//
// It matters more than it sounds. TalentLMS maps a package's statements onto
// the course containing it, so one Failed from a practice run of 11 out of 20
// could mark a learner as having failed the course they are studying for. The
// manifest declares moveOn="Completed" with no masteryScore for the same
// reason; this makes the code agree with the manifest.
{
  const check = '21 no failure is ever reported';
  const FAILED_VERB = 'expapi/verbs/failed';
  const rel = (f) => f.replace(root, '').replace(/\\/g, '/').replace(/^\//, '');
  const emitters = sourceText.filter(({ text }) => text.includes(FAILED_VERB)).map(({ f }) => rel(f));

  if (emitters.length) {
    fail(
      check,
      `the failed verb appears in ${emitters.join(', ')} — G-1 forbids counting anything against the learner, and an LMS may map it onto the whole course`
    );
  }

  const manifestSrc = readFileSync(join(root, 'scripts', 'cmi5-manifest.js'), 'utf8');
  if (/masteryScore=/.test(manifestSrc)) {
    fail(check, 'the manifest declares a masteryScore, but nothing in this course is measured');
  }

  if (!errors.some((e) => e.startsWith(check))) {
    pass(check, 'no code path emits Failed, and the manifest claims no mastery score');
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
  // Freshness. An overlay can be structurally perfect and still be a
  // translation of English that has since been rewritten — nothing errors, and
  // only a Burmese reader would ever notice. Warned rather than failed, so
  // ordinary copy editing never blocks a deploy.
  try {
    const freshness = readJson(join(contentDir, 'translations', 'freshness.json'));
    const stale = [];
    for (const [lang, unitsIn] of Object.entries(freshness)) {
      if (lang.startsWith('_')) continue;
      for (const [unitFile, screens] of Object.entries(unitsIn)) {
        const byId = Object.fromEntries(
          readJson(join(contentDir, `${unitFile}.json`)).screens.map((s) => [s.id, s])
        );
        for (const [screenId, fields] of Object.entries(screens)) {
          for (const [field, known] of Object.entries(fields)) {
            if (known.en !== textHash(byId[screenId]?.[field])) {
              stale.push(`${lang}/${screenId}.${field}`);
            }
          }
        }
      }
    }
    if (stale.length) {
      warn(
        check,
        `${stale.length} translation(s) are of English that has since changed — they fall back to English and are listed in TRANSLATION-REQUEST.md: ${stale.join(', ')}`
      );
    }
  } catch {
    // No freshness record yet.
  }

  if (!errors.some((e) => e.startsWith(check))) {
    pass(check, `${checked} overlay field(s) resolve to real English fields`);
  }
}

// --- 16. Overlays never translate official text -----------------------------
// G-3: official question wording and accepted answers stay English, because the
// interview is conducted in English. A translated overlay is the one place that
// rule can break silently — the renderer merges the overlay over the English
// screen without knowing what the words are.
//
// The rule is DERIVED, not listed. Whatever official or accepted text the
// English value already contains, the translation must still contain. That
// needs no allowlist and cannot fall out of step with the content: a guided
// item that starts quoting an official question is protected the moment it
// does, and one that stops is released just as automatically.
//
// An earlier version of this check keyed off `kind: 'interpret'` and fired on
// six items that were fine. Only U1's interpret item quotes its official
// question inline; U2–U7 render the question card separately and ask about it
// in our own prose, which is translatable. The shape of an item does not
// determine whether it carries official wording — its content does.
{
  const check = '16 overlays keep official text english';

  const officialText = questions.map((q) => q.official).filter((s) => s.length > 15);
  const acceptedText = new Set(questions.flatMap((q) => q.acceptedAnswers).filter((s) => s.length > 12));

  // Answer surfaces. Their overlay values are GLOSSES — rendered in grey under
  // the English, never in place of it (GLOSS_FIELDS in src/lib/i18n.js). So the
  // accepted-answer rule below does not apply to them: a translated accepted
  // answer sitting beneath the English one is the intended result.
  //
  // They get their own rule instead. A gloss that repeats its English prints
  // the same words twice in two greys, which is what the interpret options did
  // before the generator started stripping the duplicated prefix.
  const ANSWER_FIELDS = new Set(['options', 'buckets', 'orderItems', 'sortItems']);
  const fieldOf = (path) => path.split('.').pop().replace(/\[\d+\]$/, '');

  /** Flatten an overlay screen to [path, translated, english] triples. */
  const paths = (screenId, fields, byId) =>
    Object.entries(fields).flatMap(([field, value]) =>
      field === 'items' && Array.isArray(value)
        ? value.flatMap((item, i) =>
            Object.entries(item || {}).map(([k, v]) => [
              `${screenId}.items[${i}].${k}`,
              v,
              byId[screenId]?.items?.[i]?.[k],
            ])
          )
        : [[`${screenId}.${field}`, value, byId[screenId]?.[field]]]
    );

  const dir = join(root, 'src', 'lib', 'content', 'translations');
  let checked = 0;

  let langs = [];
  try {
    langs = readdirSync(dir);
  } catch {
    // No overlays yet.
  }
  for (const lang of langs) {
    let files = [];
    try {
      files = readdirSync(join(dir, lang)).filter((n) => n.endsWith('.json'));
    } catch {
      continue;
    }
    for (const name of files) {
      const overlay = readJson(join(dir, lang, name));
      const byId = Object.fromEntries(readJson(join(contentDir, name)).screens.map((s) => [s.id, s]));

      for (const [screenId, fields] of Object.entries(overlay)) {
        for (const [path, value, english] of paths(screenId, fields, byId)) {
          const key = `${name}:${path}`;
          if (english === undefined) continue; // check 15 owns unmatched fields
          checked += 1;

          if (ANSWER_FIELDS.has(fieldOf(path))) {
            if (Array.isArray(english) && Array.isArray(value)) {
              english.forEach((e, i) => {
                const enText = typeof e === 'string' ? e : e?.text;
                const gloss = value[i];
                if (enText && gloss && String(gloss).includes(enText)) {
                  fail(check, `${lang}/${key}[${i}] repeats its English inside the gloss — it would print twice`);
                }
              });
            }
            continue;
          }

          // Official wording present in English must survive translation.
          if (typeof english === 'string') {
            for (const o of officialText) {
              if (english.includes(o) && !String(value).includes(o)) {
                fail(check, `${lang}/${key} drops official wording that must stay English: "${o.slice(0, 48)}…"`);
              }
            }
          }

          // A list entry that restates an accepted answer must be verbatim.
          if (Array.isArray(english)) {
            english.forEach((e, i) => {
              if (typeof e === 'string' && acceptedText.has(e.trim()) && value?.[i] !== e) {
                fail(check, `${lang}/${key}[${i}] restates an accepted answer and must stay verbatim English: "${e.slice(0, 40)}"`);
              }
            });
          }
        }
      }
    }
  }

  // The stronger half of this guarantee — that an answer is never RENDERED in
  // Burmese — cannot be seen from the overlay files, because it depends on how
  // localiseScreen merges them. tests/i18n.test.js asserts it on the resolved
  // screen instead, which is the thing a learner actually sees.
  if (!errors.some((e) => e.startsWith(check))) {
    pass(check, `${checked} overlay field(s) preserve every official sentence and accepted answer in their English source`);
  }
}

// --- 17. Recorded narration resolves ---------------------------------------
// Audio is addressed by convention — public/audio/<lang>/<screen-id>.mp3 — so a
// filename is the whole contract. Two ways it breaks, both invisible locally:
//
//   · GitHub Pages is case-sensitive and Windows is not, so `u1-s01.mp3` plays
//     perfectly on the machine that made it and 404s for every learner.
//   · The manifest is what the app trusts. If it lists a recording that is not
//     on disk, the app requests a file that does not exist instead of falling
//     back to speech.
//
// Neither produces a visible error in development, which is exactly why they
// are checked here rather than left to be noticed.
{
  const check = '17 recorded narration resolves';
  const audioDir = join(root, 'public', 'audio');
  // 'q' holds official question wording, recorded once with no language folder:
  // the officer asks in English whatever the learner reads (G-3), and one file
  // serves every screen that asks it — including Rehearsal and the full-bank
  // sets, which draw at random.
  const LANGS = ['en', 'my', 'q'];

  // From the shared registry, and RECORDABLE ones only. This list and the audio
  // script's used to be maintained separately; they drifted immediately, and a
  // file named for a screen the map did not know about passed this check and
  // then silently never played.
  const narratable = new Set(
    Object.entries(STANDALONE_NARRATION).filter(([, v]) => v.recordable).map(([id]) => id)
  );
  const speechOnly = new Set(
    Object.entries(STANDALONE_NARRATION).filter(([, v]) => !v.recordable).map(([id]) => id)
  );
  for (const unit of units) {
    for (const screen of unit.screens) {
      if (NARRATED_FIELDS[screen.type]) narratable.add(screen.id);
    }
  }
  const questionIds = new Set(questions.map((q) => q.id));
  const validFor = (lang) => (lang === 'q' ? questionIds : narratable);

  let manifest = {};
  try {
    manifest = readJson(join(contentDir, 'audio-manifest.json'));
  } catch {
    // Not generated yet.
  }

  let files = 0;
  let langDirs = [];
  try {
    langDirs = readdirSync(audioDir);
  } catch {
    langDirs = []; // no audio yet — nothing to check, which is a pass
  }

  for (const lang of langDirs) {
    if (!LANGS.includes(lang)) {
      fail(check, `public/audio/${lang}/ is not a supported language — use ${LANGS.join(' or ')}`);
      continue;
    }
    let names = [];
    try {
      names = readdirSync(join(audioDir, lang)).filter((n) => !n.startsWith('.'));
    } catch {
      continue;
    }
    for (const name of names) {
      if (!name.endsWith('.mp3')) {
        fail(check, `public/audio/${lang}/${name} is not an .mp3 — nothing will play it`);
        continue;
      }
      files += 1;
      const id = name.slice(0, -4);
      const valid = validFor(lang);
      if (speechOnly.has(id)) {
        fail(
          check,
          `public/audio/${lang}/${name} is for a screen whose narration contains live values — it cannot be recorded, and would read one learner's numbers to everybody`
        );
      } else if (!valid.has(id)) {
        const nearly = [...valid].find((k) => k.toLowerCase() === id.toLowerCase());
        fail(
          check,
          nearly
            ? `public/audio/${lang}/${name} should be "${nearly}.mp3" — case must match exactly, or it 404s once deployed`
            : `public/audio/${lang}/${name} matches no ${lang === 'q' ? 'official question' : 'narrated screen'} — it will never play`
        );
      } else if (!manifest[lang]?.[id]) {
        warn(check, `public/audio/${lang}/${name} is not in the manifest — run "npm run audio"`);
      }
    }

    for (const id of Object.keys(manifest[lang] || {})) {
      if (!names.includes(`${id}.mp3`)) {
        fail(check, `the manifest lists ${lang}/${id}.mp3 but it is not on disk — the app would request a missing file`);
      }
    }
  }

  if (!errors.some((e) => e.startsWith(check))) {
    pass(
      check,
      files
        ? `${files} recording(s) resolve to a narrated screen, with exact-case filenames`
        : 'no recordings yet — every narrated screen falls back to speech'
    );
  }
}

// --- 18. Every image reference resolves -------------------------------------
// A slot whose file is absent renders its placeholder, which is deliberate and
// honest — the artwork is commissioned after the slots exist. But a slot whose
// file is absent because the NAME is wrong looks identical, and says nothing.
//
// Case is the specific trap, again: GitHub Pages is case-sensitive and Windows
// is not, so US-Capitol.webp works on the machine that made it and 404s for
// every learner. That failure is invisible in development.
{
  const check = '18 image references resolve';
  const imageDir = join(root, 'public', 'images');

  let onDisk = [];
  try {
    onDisk = readdirSync(imageDir).filter((n) => !n.startsWith('.'));
  } catch {
    // No images yet.
  }

  const wanted = [];
  for (const u of units) {
    for (const s of u.screens) {
      if (s.image) wanted.push([s.id, s.image]);
      // Derived from companionPose rather than authored, so nothing else here
      // would notice a pose with no artwork behind it.
      if (s.companionPose) wanted.push([s.id, `companion-${s.companionPose}.webp`]);
      for (const pic of s.imageRow || []) wanted.push([s.id, pic.image]);
      for (const col of s.twoColumn || []) if (col.image) wanted.push([s.id, col.image]);
    }
  }

  let resolved = 0;
  for (const [screenId, name] of wanted) {
    if (onDisk.includes(name)) {
      resolved += 1;
      continue;
    }
    // Only a CASE mismatch is a failure. A genuinely absent file is a slot
    // waiting for artwork, which the placeholder states honestly.
    const nearly = onDisk.find((f) => f.toLowerCase() === String(name).toLowerCase());
    if (nearly) {
      fail(
        check,
        `${screenId} references "${name}" but the file is "${nearly}" — case must match exactly, or it 404s once deployed`
      );
    } else if (/^companion-/.test(String(name))) {
      fail(check, `${screenId} has a companionPose with no artwork: "${name}"`);
    }
  }

  for (const name of onDisk) {
    if (!/\.(webp|png|jpg|jpeg|avif|svg)$/i.test(name)) {
      fail(check, `public/images/${name} is not an image format the app renders`);
    }
  }

  if (!errors.some((e) => e.startsWith(check))) {
    const waiting = wanted.length - resolved;
    pass(
      check,
      `${resolved} of ${wanted.length} image slots resolve${waiting ? `; ${waiting} still awaiting artwork, each showing its placeholder` : ''}`
    );
  }
}

// --- 19. Nothing oversized in public/ ---------------------------------------
// Vite copies public/ verbatim into dist/, so anything left there ships.
//
// The companion delivery landed in public/ as 6.8 MB of PNG masters and
// previews — thirteen times the whole application — and came within one build
// of deploying to people paying for data by the megabyte. Nothing failed,
// nothing warned; the folder simply got bigger.
//
// Source assets belong in assets-source/, outside the served tree.
{
  const check = '19 public/ carries only what ships';
  const publicDir = join(root, 'public');
  // Generous: the Myanmar font subset is 154 KB and legitimately lives here.
  const MAX_KB = 400;
  const SERVED = /\.(webp|png|jpg|jpeg|avif|svg|mp3|woff2|ico|json|txt|xml)$/i;

  const walk = (dir, rel = '') => {
    let out = [];
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue;
      const p = join(dir, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) out = out.concat(walk(p, r));
      else out.push({ path: p, rel: r });
    }
    return out;
  };

  let files = [];
  try {
    files = walk(publicDir);
  } catch {
    files = [];
  }

  let bytes = 0;
  for (const f of files) {
    const size = readFileSync(f.path).length;
    bytes += size;
    if (!SERVED.test(f.rel)) {
      fail(check, `public/${f.rel} is not a format the app serves — source assets belong in assets-source/`);
    } else if (size / 1024 > MAX_KB) {
      fail(
        check,
        `public/${f.rel} is ${(size / 1024).toFixed(0)} KB, over the ${MAX_KB} KB ceiling — ship an export, keep the master in assets-source/`
      );
    }
  }

  if (!errors.some((e) => e.startsWith(check))) {
    pass(check, `${files.length} file(s) in public/, ${(bytes / 1024).toFixed(0)} KB total, none oversized`);
  }
}

// --- 20. No passage of copy written twice ------------------------------------
// A learner read the same welcome twice: `U0-S01.body` was byte-identical to
// the paragraph hardcoded in Welcome.svelte, so pressing Start appeared to do
// nothing but change the illustration. Looking for more of it found six —
// `afterQuote` on U1-S01 through U6-S01 was one sentence repeated, so the line
// under the question card said the same nothing in every unit.
//
// Both were written independently by someone who could not see the other copy.
// Nothing detects that except comparing all of it.
//
// ACROSS SCREENS, NOT ACROSS FIELDS.
//
// An `interpret` item holds the same string in `cardText` and `pairedOfficial`
// — one screen showing a question, and recording which official question it
// pairs to. Six of those exist and none is a defect, so the comparison is keyed
// by screen id: a passage in two places on ONE screen is a data shape, the same
// passage on two screens is a repeat.
{
  const check = '20 no passage of copy written twice';
  const MIN = 25;

  // Deliberate repeats. Each is one component's frame reused around different
  // content, which is consistency rather than duplication — the alternative is
  // rewording an instruction per unit so the learner has to re-read it.
  const SHARED_COPY = [
    ['Two names on the test sound alike. Do not mix them up.', 'confusablePair: one frame, two pairs of names'],
    ['Tap these four events into the order they happened.', 'ordering item: one instruction, two sets of events'],
    ['Choose an answer to continue', 'one instruction for one interaction (FullBank, Review)'],
  ];
  const norm = (t) => t.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\.$/, '');
  const allowed = new Set(SHARED_COPY.map(([t]) => norm(t)));

  // Keys that are identifiers or asset names rather than prose a learner reads.
  //
  // `alt` is excluded on purpose. It describes the PICTURE, so the same file on
  // two screens should carry the same description and it would be a defect if
  // it did not — which is a rule about alt text, and now lives in check 6 where
  // the rest of alt lives.
  const NOT_PROSE = new Set(['id', 'type', 'image', 'alt', 'questionId', 'sampleQuestionId', 'diagram', 'companionPose']);

  const sites = new Map(); // normalised passage -> Set of place names
  const record = (text, where) => {
    if (typeof text !== 'string' || text.trim().length < MIN) return;
    const key = norm(text);
    if (allowed.has(key)) return;
    if (!sites.has(key)) sites.set(key, { text, where: new Set() });
    sites.get(key).where.add(where);
  };

  const walk = (node, where) => {
    if (typeof node === 'string') record(node, where);
    else if (Array.isArray(node)) for (const v of node) walk(v, where);
    else if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) if (!NOT_PROSE.has(k)) walk(v, where);
    }
  };

  for (const unit of units) for (const screen of unit.screens) walk(screen, screen.id);

  // Course copy also lives in markup. Text nodes only — attributes, class lists
  // and script bodies are not prose a learner reads.
  for (const file of allSourceFiles(join(srcDir, 'lib', 'screens'))) {
    if (!file.endsWith('.svelte')) continue;
    const name = file.split(/[\\/]/).pop();
    const body = readFileSync(file, 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
    for (const [, text] of body.matchAll(/>([^<>{}]+)</g)) record(text, name);
  }

  const repeats = [...sites.values()].filter((s) => s.where.size > 1);
  for (const r of repeats) {
    fail(
      check,
      `"${r.text.slice(0, 60)}${r.text.length > 60 ? '…' : ''}" appears in ${[...r.where].join(', ')} — write one of them afresh, or add it to SHARED_COPY with the reason it is deliberate`
    );
  }
  if (!repeats.length) {
    pass(check, `${sites.size} passages, each written once (${SHARED_COPY.length} shared frames allowed)`);
  }
}

// --- 22. The cmi5 manifest is well-formed XML -------------------------------
//
// It was not, and the reason is worth keeping: a comment in the generator's
// template read "Regenerate ... : --ns https://your.domain/civics", and a
// double hyphen is illegal inside an XML comment. Every value the generator
// interpolates is escaped, so the DATA was never the risk — the prose around it
// was, and nothing looked at that.
//
// An LMS importer rejects an ill-formed manifest outright and reports a line
// number in a file nobody hand-wrote. This costs a millisecond instead.
{
  const check = '22 cmi5 manifest is well-formed';
  const manifestPath = join(root, 'docs', 'cmi5', 'cmi5.xml');
  const problems = xmlProblems(readFileSync(manifestPath, 'utf8'));
  for (const p of problems) fail(check, p);
  if (!problems.length) pass(check, 'docs/cmi5/cmi5.xml parses as XML');
}

// --- 23. Translation freshness covers every unit that has an overlay --------
//
// build-translations.js used to start freshness.my EMPTY on every run.
// Regenerating a single unit — `node scripts/build-translations.js unit3` —
// wrote a freshness.json containing ONLY unit3, discarding every other unit's
// staleness record. The next run, even a full one, then read that truncated
// file as its OWN baseline, found no prior record for the missing units, and
// treated every field in them as freshly delivered — silently re-baselining
// genuinely stale translations as current. A learner would have been shown
// Burmese that no longer matches what the English says, which is the exact
// failure this whole mechanism exists to catch, reintroduced by the tool that
// maintains it.
//
// This does not re-detect staleness — that needs the English and the overlay,
// which this check does not load. It catches the SHAPE of the bug: a
// freshness file that has quietly stopped covering a unit it used to.
{
  const check = '23 translation freshness covers every unit';
  const freshnessPath = join(contentDir, 'translations', 'freshness.json');
  const freshness = readJson(freshnessPath);
  const recorded = new Set(Object.keys(freshness.my || {}));

  for (const unit of ['unit0', ...UNIT_IDS.map((u) => `unit${u[1]}`)]) {
    const overlayPath = join(contentDir, 'translations', 'my', `${unit}.json`);
    if (!existsSync(overlayPath)) continue;
    if (!recorded.has(unit)) {
      fail(
        check,
        `${unit} has a Burmese overlay but no entry in freshness.json — ` +
          `regenerate with a full run: node scripts/build-translations.js`
      );
    }
  }

  if (!errors.some((e) => e.startsWith(check))) {
    pass(check, `freshness.json covers all ${recorded.size} translated units`);
  }
}

// --- 24. Every advance-button label has a translation ----------------------
//
// `primaryLabel` is authored per screen and is deliberately SKIPped by the
// translation pipeline — it is chrome, not prose, and nobody should be asked to
// translate the word "Next" 58 times. But nothing translated it either, so
// every lesson screen in the course rendered an English button to a Burmese
// learner. Lesson.svelte now maps the label to a ui-string key.
//
// The failure mode this guards is quiet: author a new screen with a new label
// and it renders English, on that screen only, with nothing complaining.
{
  const check = '24 advance-button labels are translatable';
  const lessonSrc = readFileSync(join(srcDir, 'lib', 'screens', 'Lesson.svelte'), 'utf8');
  const block = lessonSrc.match(/const ADVANCE_KEYS = \{([\s\S]*?)\};/);

  if (!block) {
    fail(check, 'Lesson.svelte no longer has an ADVANCE_KEYS map — the labels are untranslated again');
  } else {
    const mapped = new Set(
      [...block[1].matchAll(/^\s*'?([^':\n]+?)'?\s*:/gm)].map((m) => m[1].trim())
    );
    const ui = readJson(join(contentDir, 'ui-strings.json'));
    const labels = new Set();
    for (const u of units) for (const s of u.screens) if (s.primaryLabel) labels.add(s.primaryLabel);

    for (const label of labels) {
      if (!mapped.has(label)) {
        fail(check, `"${label}" is used as a primaryLabel but has no entry in Lesson.svelte's ADVANCE_KEYS`);
      }
    }
    // And every key the map points at must actually exist.
    for (const [, key] of block[1].matchAll(/:\s*'([^']+)'/g)) {
      if (!ui[key]) fail(check, `ADVANCE_KEYS points at "${key}", which is not a ui-string`);
    }
    if (!errors.some((e) => e.startsWith(check))) {
      pass(check, `${labels.size} distinct button label(s), all mapped to ui-strings`);
    }
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
