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
import { textHash } from '../src/lib/text-hash.js';
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

// Every unit that already has an overlay, so translated fields are not asked
// for twice. Was unit1-only when unit1 was the only overlay that existed.
// Which English each translated field was made from. A field whose English has
// since been rewritten is treated as untranslated here, so a corrected string
// reappears in this document without anyone remembering to add it.
const freshnessPath = join(contentDir, 'translations', 'freshness.json');
const freshness = existsSync(freshnessPath) ? readJson(freshnessPath) : {};

const overlays = Object.fromEntries(
  UNITS.map((u) => {
    const p = join(contentDir, 'translations', 'my', `${u}.json`);
    return [u, existsSync(p) ? readJson(p) : {}];
  })
);

// A markdown table cell has a display width, so long values are clipped here.
// That clipping is DISPLAY ONLY. The first delivery lost 23 fields — every
// `cards` set and every multi-paragraph `paragraphs` — because the clipped text
// was the only English on offer, so there was nothing to translate from.
//
// The untruncated value now goes to docs/translation-source.json, in its real
// shape (array stays an array), and every clipped row points at it.
const CLIP = 320;
const clipped = new Set();

const cell = (s, key) => {
  const flat = String(s).replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim();
  if (flat.length <= CLIP) return flat;
  if (key) clipped.add(key);
  return `${flat.slice(0, CLIP)}… **[clipped — full text in \`translation-source.json\` under \`${key}\`]**`;
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

/**
 * Translatable fields on one screen, as [label, displayText, rawValue].
 *
 * `displayText` is flattened for the markdown table. `rawValue` keeps the real
 * shape — an array stays an array, `cards` stay objects — so the companion
 * source file tells the translator exactly what to return.
 */
function fieldsOf(screen) {
  const out = [];
  for (const [k, v] of Object.entries(screen)) {
    if (SKIP.has(k)) continue;
    if (typeof v === 'string' && PROSE.has(k)) out.push([k, v, v]);
    else if (Array.isArray(v) && LISTS.has(k)) out.push([k, v.join(' | '), v]);
    else if (k === 'cards') out.push([k, v.map((c) => `${c.word}: ${c.def} — “${c.example}”`).join(' | '), v]);
    else if (k === 'termA' || k === 'termB') out.push([k, `${v.name} — ${v.def}`, v]);
    // twoColumn goes out as OBJECTS, not a flattened "heading: body" line.
    // The first delivery returned it as one string per column with no
    // separator, which cannot be split back into heading and body — the field
    // had to be dropped. Only the translatable keys are sent; `image` is a
    // filename and must not change.
    else if (k === 'twoColumn')
      out.push([
        k,
        v.map((c) => `${c.heading || ''}: ${c.body || ''}`).join(' | '),
        v.map((c) => ({ heading: c.heading, body: c.body, ...(c.alt ? { alt: c.alt } : {}) })),
      ]);
    else if (k === 'items') {
      v.forEach((it, i) => {
        if (it.question) out.push([`items[${i}].question`, it.question, it.question]);
        if (it.instructions) out.push([`items[${i}].instructions`, it.instructions, it.instructions]);
        if (it.options) out.push([`items[${i}].options`, it.options.join(' | '), it.options]);
        if (it.sortItems) out.push([`items[${i}].sortItems`, it.sortItems.map((s) => s.text).join(' | '), it.sortItems.map((s) => s.text)]);
        if (it.buckets) out.push([`items[${i}].buckets`, it.buckets.join(' | '), it.buckets]);
        if (it.orderItems) out.push([`items[${i}].orderItems`, it.orderItems.join(' | '), it.orderItems]);
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
const source = {};

for (const file of UNITS) {
  const unit = readJson(join(contentDir, `${file}.json`));
  const rows = [];
  for (const screen of unit.screens) {
    const done = overlays[file]?.[screen.id] || {};
    for (const [label, en, raw] of fieldsOf(screen)) {
      // `items` overlays can be partial — item 0 translated, item 2 not — so
      // resolve to the exact item and field rather than skipping the whole
      // array the moment `items` appears. A coarse check here would silently
      // drop untranslated items out of the request.
      const m = /^items\[(\d+)\]\.(.+)$/.exec(label);
      const translated = m
        ? done.items?.[Number(m[1])]?.[m[2]] !== undefined
        : label in done;
      const known = freshness.my?.[file]?.[screen.id]?.[label.split('[')[0].split('.')[0]];
      const stale = known && known.en !== textHash(screen[label.split('[')[0].split('.')[0]]);
      if (translated && !stale) continue;
      const key = `${screen.id}.${label}`;
      source[key] = raw;
      rows.push(`| \`${screen.id}\` | \`${label}\` | ${cell(en, key)}${warn(label, en)} |`);
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

**Work from \`docs/translation-source.json\`, not from the tables below.** The
tables clip long values to fit a markdown column; that JSON carries the full
English for every field listed here, keyed \`screenId.field\`, in the exact shape
the value must come back in. The first delivery lost 23 fields to that clipping,
which was a defect in this generator rather than anything the translator did.

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

${
  uiMissing.length
    ? `| Key | English |\n|---|---|\n${uiMissing.map(([k, en]) => `| \`${k}\` | ${cell(en)} |`).join('\n')}`
    : `_All ${uiTotal} interface strings carry Burmese._ They remain \`draft-unreviewed\` and still need a native pass, but none is missing.`
}

---

## 2. Fields that came back but could not be used

Three cases from the last delivery. None is a translation error: two are shapes
this document asked for badly, and one is a rule the older Unit 1 source
predates. All three are listed in section 4 again, so they are covered by
working through the tables — this section only explains why they reappear.

| Field | What happened | What is needed |
|---|---|---|
| \`U1-S08.twoColumn\` | returned as one string per column. The build stores \`heading\` and \`body\` as separate fields, and a single string cannot be split back into them without guessing where the heading ends | return it as **objects**; \`translation-source.json\` now shows the shape |
| \`U1-S05.paragraphs\`, \`U1-S06b.paragraphs\` | the older bilingual source divides this prose into a different number of paragraphs than the build has | re-split to the count shown in the source JSON |
| \`U1-S09.items[0]\` \`question\` and \`options\` | translated in full — but that question **is** an official question, and option 0 **is** an accepted answer | both stay English. The build now drops any such translation automatically rather than shipping it, so nothing is at risk; the fields simply stay English until translated around |

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

Two list shapes are worth naming; both are visible in \`translation-source.json\`,
which is the authority if this description and the JSON ever disagree:

- **\`sortItems\`** goes out as plain strings and comes back as plain strings. The
  build re-attaches each item's sorting bucket **by position**, so the order is
  what makes the exercise score correctly. Translate in place; never reorder.
- **\`twoColumn\` and \`cards\`** go out as objects and must come back as objects.
  Flattening them loses the boundary between one field and the next, and it
  cannot be recovered afterwards.

| Unit | Fields outstanding |
|---|---|
${counts.map(([id, title, n]) => `| ${id} ${title} | ${n} |`).join('\n')}
| **Total** | **${totalFields}** |

---

## 4. The fields
${sections.join('')}`;

writeFileSync(join(root, 'docs', 'TRANSLATION-REQUEST.md'), doc, 'utf8');

// The untruncated companion. Values keep their real shape, so a `paragraphs`
// entry arrives as an array of 3 and must come back as an array of 3.
writeFileSync(
  join(root, 'docs', 'translation-source.json'),
  `${JSON.stringify(
    {
      _note:
        'Untruncated English for every field in TRANSLATION-REQUEST.md, keyed screenId.field. ' +
        'The markdown clips long values for table display; these are the full ones. ' +
        'Return each value in the same shape and, for lists, the same length and order. ' +
        'The ⚠ rules in section 0 of the markdown still apply.',
      _ui: Object.fromEntries(uiMissing),
      ...source,
    },
    null,
    2
  )}\n`,
  'utf8'
);

console.log('docs/TRANSLATION-REQUEST.md');
console.log('docs/translation-source.json');
console.log(`  ${uiMissing.length} interface strings, ${totalFields} content fields`);
console.log(`  ${clipped.size} value(s) clipped in the table, full text in the JSON`);
for (const [id, , n] of counts) console.log(`    ${id}: ${n}`);
