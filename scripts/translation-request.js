#!/usr/bin/env node
/**
 * translation-request.js — generate docs/TRANSLATION-REQUEST.md.
 *
 * Lists every string the app still renders in English, so a translator can work
 * from one document instead of reading the codebase. Generated rather than
 * hand-written: a hand-typed list goes stale the first time content changes,
 * and a translator working from a stale list translates the wrong thing.
 *
 * Deliberately excludes questions-uN.json entirely. Official wording, accepted
 * answers and practice options are verbatim USCIS text and are never
 * translated (G-3) — so they must not appear in a document titled "what needs
 * translating".
 *
 *   node scripts/translation-request.js
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const contentDir = join(root, 'src', 'lib', 'content');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const UNITS = ['unit0', 'unit1', 'unit2', 'unit3', 'unit4', 'unit5', 'unit6', 'unit7'];

const PROSE = new Set([
  'body', 'closing', 'resolution', 'handle', 'handleSub', 'example', 'nonExample',
  'takeaway', 'heading', 'afterQuote', 'afterTest', 'coverageLine', 'learnedLine',
  'feedback', 'question', 'instructions', 'feedbackExplain', 'unitLabel', 'alt',
]);
const LISTS = new Set(['bodyList', 'bodyList2', 'paragraphs', 'orderItems', 'buckets']);
const SKIP = new Set([
  'id', 'type', 'primaryLabel', 'image', 'questionId', 'sampleQuestionId',
  'companionPose', 'questionIds', 'fullBankOffer', 'unlocksReview', 'clueList',
]);

const overlayPath = join(contentDir, 'translations', 'my', 'unit1.json');
const overlay = existsSync(overlayPath) ? readJson(overlayPath) : {};

const cell = (s) => {
  const flat = String(s).replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim();
  return flat.length > 320 ? `${flat.slice(0, 320)}…` : flat;
};

// Official wording and accepted answers, so rows that quote them can be
// flagged. Guided-practice items are OUR prose, but several of them quote an
// official question verbatim or reuse an accepted answer as an option — and a
// document that told a translator to translate those would be instructing them
// to break G-3. Detected rather than trusted to reviewer memory.
const allQuestions = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7'].flatMap((u) =>
  readJson(join(contentDir, `questions-${u}.json`))
);
const officialText = allQuestions.map((q) => q.official).filter((s) => s.length > 15);
const acceptedText = new Set(
  allQuestions.flatMap((q) => q.acceptedAnswers).filter((s) => s.length > 12)
);

function warn(label, en) {
  // An option list that reuses accepted answers must stay English, exactly like
  // the practice options in questions-uN.json.
  if (/options$/.test(label)) {
    const parts = String(en).split(' | ');
    if (parts.some((p) => acceptedText.has(p.trim()))) {
      return ' **⚠ KEEP ENGLISH** — these restate accepted answers';
    }
  }
  const quoted = officialText.find((o) => String(en).includes(o));
  if (quoted) {
    return ' **⚠ keep the quoted official question in English**; translate only the words around it';
  }
  return '';
}

/** Translatable fields on one screen, as [label, englishText]. */
function fieldsOf(screen) {
  const out = [];
  for (const [k, v] of Object.entries(screen)) {
    if (SKIP.has(k)) continue;
    if (typeof v === 'string' && PROSE.has(k)) out.push([k, v]);
    else if (Array.isArray(v) && LISTS.has(k)) out.push([k, v.join(' | ')]);
    else if (k === 'cards') out.push([k, v.map((c) => `${c.word}: ${c.def} — “${c.example}”`).join(' | ')]);
    else if (k === 'termA' || k === 'termB') out.push([k, `${v.name} — ${v.def}`]);
    else if (k === 'twoColumn') out.push([k, v.map((c) => `${c.heading || ''}: ${c.body || ''}`).join(' | ')]);
    else if (k === 'items') {
      v.forEach((it, i) => {
        if (it.question) out.push([`items[${i}].question`, it.question]);
        if (it.instructions) out.push([`items[${i}].instructions`, it.instructions]);
        if (it.options) out.push([`items[${i}].options`, it.options.join(' | ')]);
        if (it.sortItems) out.push([`items[${i}].sortItems`, it.sortItems.map((s) => s.text).join(' | ')]);
        if (it.buckets) out.push([`items[${i}].buckets`, it.buckets.join(' | ')]);
        if (it.orderItems) out.push([`items[${i}].orderItems`, it.orderItems.join(' | ')]);
      });
    }
  }
  return out;
}

const ui = readJson(join(contentDir, 'ui-strings.json'));
const uiMissing = Object.entries(ui)
  .filter(([k, v]) => k !== '_note' && !v.my)
  .map(([k, v]) => [k, v.en]);
const uiTotal = Object.keys(ui).filter((k) => k !== '_note').length;

const sections = [];
const counts = [];

for (const file of UNITS) {
  const unit = readJson(join(contentDir, `${file}.json`));
  const rows = [];
  for (const screen of unit.screens) {
    const done = file === 'unit1' ? overlay[screen.id] || {} : {};
    for (const [label, en] of fieldsOf(screen)) {
      const base = label.split('[')[0].split('.')[0];
      if (base in done) continue;
      rows.push(`| \`${screen.id}\` | \`${label}\` | ${cell(en)}${warn(label, en)} |`);
    }
  }
  counts.push([unit.id, unit.title, rows.length]);
  sections.push(
    `\n### ${unit.id} — ${unit.title}\n\n**${rows.length} fields.**\n\n` +
      (rows.length
        ? `| Screen | Field | English |\n|---|---|---|\n${rows.join('\n')}\n`
        : '_Fully translated._\n')
  );
}

const totalFields = counts.reduce((n, [, , c]) => n + c, 0);

const doc = `# What still needs Burmese

**For:** the translator / native reviewer.
**Generated** by \`node scripts/translation-request.js\` — regenerate after any
content change rather than editing this file, or it will describe a course that
no longer exists.

Everything already translated is live and is **not** listed here, so nothing gets
translated twice. Remaining: **${uiMissing.length} interface strings** and
**${totalFields} content fields**.

---

## 0. Three rules that override everything

### Never translate these

| Never translate | Where it lives |
|---|---|
| Official question wording | \`questions-u1.json\`…\`questions-u7.json\` → \`official\` |
| Accepted answers | same files → \`acceptedAnswers\` |
| Practice options | same files → \`options\` |

They are verbatim USCIS M-1778 text and the interview is conducted in English
(rule G-3). The **correct** option in each set restates an accepted answer, so
translating options would put a Burmese answer beside an English question and
train the learner on wording no officer will use.

Those files appear nowhere below.

**Six rows carry a ⚠ warning.** Guided-practice items are our own prose, but a
few of them quote an official question word for word, or reuse an accepted
answer as an option. Those are flagged inline: keep the quoted sentence in
English and translate only the words around it. Everything unflagged is safe.

The warnings are detected by the generator against the real question data, not
remembered by a reviewer — so they cannot fall out of step with the content.

### One deliberate exception

On **interpret** items — the "which question is asking the same thing?" ones —
the option text stays **English**, with a Burmese gloss in brackets:

> \`What is the highest law in America? (…)\`

The skill being taught is recognising an English test question under unfamiliar
wording. Translating those options deletes the thing being practised.

### Send files. Do not paste.

Burmese is three UTF-8 bytes per character, and **two of them fall in the
0x80–0x9F control range** — including the final byte of every base consonant.
Chat and clipboard channels strip those bytes, so pasted Burmese arrives with
every consonant deleted and only the vowel marks surviving. It cannot be
recovered by any amount of cleverness.

**Save the file and drop it into \`docs/translations/\`.** Two earlier attempts
were lost this way before we worked out the cause.

---

## 1. Interface strings — ${uiMissing.length} of ${uiTotal} remaining

In \`src/lib/content/ui-strings.json\`. Fill the \`my\` value; leave \`en\` alone.

| Key | English |
|---|---|
${uiMissing.map(([k, en]) => `| \`${k}\` | ${cell(en)} |`).join('\n')}

---

## 2. Unit 1 — the 11 fields the existing source could not fill

Unit 1 is largely translated. These could **not** be taken from
\`docs/translations/unit1.json\` because its paragraph splits differ from the
build's, and splitting Burmese prose at a guessed sentence boundary is not
something that can be done without reading it.

| Screen | Why it did not map | What is needed |
|---|---|---|
| \`U1-S01\` | source is one paragraph; the build has six separate fields | each field separately |
| \`U1-S03\` | source has 3 paragraphs; \`bodyList\` expects 4 | re-split to 4 |
| \`U1-S05\` | source has 5; \`paragraphs\` expects 3 | re-split to 3, plus \`handle\` and \`handleSub\` |
| \`U1-S06b\` | source has 3; \`paragraphs\` expects 4 | re-split to 4 |
| \`U1-S07b\` | source combines term and definition in one line | split into \`termA.name\` / \`termA.def\`, same for \`termB\` |
| \`U1-S08\` | source is prose; build has \`twoColumn\` + \`closing\` | a heading and body per document, plus the closing line |
| \`U1-S11\`–\`S15\` | source feedback opens "The correct answer is **X**." | **drop that opening sentence.** The app already prints it, so keeping it shows the answer twice. Only the explanation that follows is wanted. |

---

## 3. How to deliver

One file per unit, \`docs/translations/unitN.json\`, keyed by screen id then by
the exact \`Field\` name from the tables below:

\`\`\`json
{
  "U2-S01": { "heading": "…", "body": "…", "afterQuote": "…" },
  "U2-S05": { "paragraphs": ["…", "…", "…"] }
}
\`\`\`

Where a value below shows several parts separated by \` | \`, that field is a
**list** — return the same number of items in the same order. A wrong count is
caught by \`node scripts/build-translations.js unitN\` rather than shipped.

| Unit | Fields outstanding |
|---|---|
${counts.map(([id, title, n]) => `| ${id} ${title} | ${n} |`).join('\n')}
| **Total** | **${totalFields}** |

---

## 4. The fields
${sections.join('')}`;

writeFileSync(join(root, 'docs', 'TRANSLATION-REQUEST.md'), doc, 'utf8');
console.log(`docs/TRANSLATION-REQUEST.md`);
console.log(`  ${uiMissing.length} interface strings, ${totalFields} content fields`);
for (const [id, , n] of counts) console.log(`    ${id}: ${n}`);
