#!/usr/bin/env node
/**
 * audio-assets.js — reconcile recorded narration with the course.
 *
 *   node scripts/audio-assets.js            # scan, report, regenerate
 *   node scripts/audio-assets.js --accept   # mark every stale recording current
 *   node scripts/audio-assets.js --accept U1-S05
 *
 * Writes three files:
 *
 *   src/lib/content/audio-manifest.json  what the app reads to find recordings
 *   docs/AUDIO-ASSETS.md                 the map: every file, named and tracked
 *   docs/narration-script.json           the full text to record, per file
 *
 * All three are GENERATED. A hand-maintained asset list goes stale the first
 * time a screen changes, and someone records the wrong words — the translation
 * request already proved that, expensively.
 *
 * WHY A MANIFEST AND NOT A 404
 *
 * The app could try to load audio and fall back when it fails. That means a
 * failed request and a stall on every screen without a recording, on the
 * connections least able to afford it. Reading a generated list costs nothing.
 *
 * WHY A HASH
 *
 * A recording keeps playing after its screen's text is rewritten. Nothing 404s,
 * nothing errors — the audio simply says what the page no longer says, so a
 * learner who listens gets different content from one who reads, silently and
 * for good. The hash is how that is caught. It is taken over normalised text,
 * so fixing a comma costs nothing and changing the words costs a re-record.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { localiseWith } from '../src/lib/localise.js';
import { flatten, narrationFor, narrationHash, NARRATED_FIELDS } from '../src/lib/narration-text.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const contentDir = join(root, 'src', 'lib', 'content');
const audioDir = join(root, 'public', 'audio');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const LANGS = ['en', 'my'];

// Official question wording, recorded ONCE with no language folder. The officer
// asks in English whatever the learner reads (G-3), so a second copy would be
// wrong — and one file serves every screen that asks the question, including
// Rehearsal and the full-bank sets, which draw at random and could never have a
// per-screen recording.
const QUESTION_DIR = 'q';
const UNITS = ['unit0', 'unit1', 'unit2', 'unit3', 'unit4', 'unit5', 'unit6', 'unit7'];

/**
 * Screens with no unit JSON of their own. Welcome's copy is hardcoded in the
 * component rather than authored as page data, so its narration is kept in step
 * by hand — the only place in the app where that is true.
 */
const STANDALONE = [
  {
    id: 'welcome',
    unit: 'Welcome screen',
    text:
      'Welcome. This course covers all 128 questions on the U.S. citizenship ' +
      'civics test, in short lessons you can fit around your day.',
  },
];

// --- What the course expects ------------------------------------------------

const questions = Object.fromEntries(
  ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7']
    .flatMap((u) => readJson(join(contentDir, `questions-${u}.json`)))
    .map((q) => [q.id, q.official])
);

/** Every narratable item, per language, in course order. */
function expected(lang) {
  const out = [];
  for (const file of UNITS) {
    const unit = readJson(join(contentDir, `${file}.json`));
    const overlayPath = join(contentDir, 'translations', lang, `${file}.json`);
    const overlay = lang !== 'en' && existsSync(overlayPath) ? readJson(overlayPath) : {};

    for (const raw of unit.screens) {
      if (!NARRATED_FIELDS[raw.type]) continue;
      const screen = overlay[raw.id] ? localiseWith(raw, overlay[raw.id]) : raw;
      const text = flatten(
        narrationFor(screen, {
          officialQuestion: raw.sampleQuestionId ? questions[raw.sampleQuestionId] : '',
          lang,
        })
      );
      if (!text) continue;
      out.push({
        id: raw.id,
        unit: `${unit.id} — ${unit.title}`,
        text,
        // Flagged from the TEXT, not from whether an overlay entry exists.
        // U1-S06b has an overlay — its alt text is translated — while the
        // paragraphs a narrator would actually read are still English. Asking
        // "does an overlay exist" said it was translated; asking "is this
        // Burmese" is the question that was meant.
        untranslated: lang !== 'en' && !/[က-႟]/.test(text),
      });
    }
  }
  for (const s of STANDALONE) out.push({ ...s, untranslated: lang !== 'en' });
  return out;
}

// --- What is actually on disk -----------------------------------------------

function recordings(lang) {
  const dir = join(audioDir, lang);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => n.toLowerCase().endsWith('.mp3'));
}

// --- Reconcile --------------------------------------------------------------

const args = process.argv.slice(2);
const acceptIdx = args.indexOf('--accept');
const accepting = acceptIdx !== -1;
const acceptOnly = accepting ? args[acceptIdx + 1] : null;

const previous = existsSync(join(contentDir, 'audio-manifest.json'))
  ? readJson(join(contentDir, 'audio-manifest.json'))
  : {};

const manifest = {
  _note:
    'GENERATED by scripts/audio-assets.js from what is present in public/audio/. ' +
    'Never edit by hand. Each entry records the hash of the narration text at the ' +
    'moment the recording was accepted; when the text moves, the recording is ' +
    'treated as stale and speech takes over until it is re-recorded.',
};

const rows = {};
const totals = {};

/** The 128 official questions, as their own recording set. */
function expectedQuestions() {
  return Object.entries(questions).map(([id, official]) => ({
    id,
    unit: 'Official questions — English only, one recording each',
    text: official,
    untranslated: false,
  }));
}

for (const lang of [...LANGS, QUESTION_DIR]) {
  const items = lang === QUESTION_DIR ? expectedQuestions() : expected(lang);
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  const files = recordings(lang);
  const seen = new Set();

  manifest[lang] = {};
  rows[lang] = [];

  const orphans = [];
  for (const name of files) {
    const id = name.slice(0, -4);
    if (!byId[id]) {
      orphans.push(name);
      continue;
    }
    seen.add(id);
  }

  for (const item of items) {
    const hash = narrationHash(item.text);
    const had = previous[lang]?.[item.id];
    let status;

    if (!seen.has(item.id)) {
      status = 'missing';
    } else if (!had) {
      // First sight of a file: accept it. Dropping a recording in should just
      // work — staleness is about text moving AFTER a recording was registered.
      status = 'recorded';
      manifest[lang][item.id] = { hash };
    } else if (had.hash === hash) {
      status = 'recorded';
      manifest[lang][item.id] = { hash };
    } else if (accepting && (!acceptOnly || acceptOnly === item.id)) {
      status = 'recorded';
      manifest[lang][item.id] = { hash };
    } else {
      status = 'stale';
      // Keep the OLD hash. The runtime compares it against current text, finds
      // a mismatch, and falls back to speech — which is what "set aside, not
      // played" means in practice.
      manifest[lang][item.id] = { hash: had.hash };
    }

    rows[lang].push({ ...item, status, hash });
  }

  totals[lang] = {
    total: items.length,
    recorded: rows[lang].filter((r) => r.status === 'recorded').length,
    stale: rows[lang].filter((r) => r.status === 'stale').length,
    missing: rows[lang].filter((r) => r.status === 'missing').length,
    orphans,
  };
}

// --- Write ------------------------------------------------------------------

writeFileSync(join(contentDir, 'audio-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

const script = {
  _note:
    'GENERATED. The full text to read for each recording, keyed by language then ' +
    'screen id — the same key as the filename. AUDIO-ASSETS.md clips these to fit ' +
    'a table; this file does not. Work from this one.',
};
for (const lang of [...LANGS, QUESTION_DIR]) {
  script[lang] = Object.fromEntries(rows[lang].map((r) => [r.id, r.text]));
}
writeFileSync(join(root, 'docs', 'narration-script.json'), `${JSON.stringify(script, null, 2)}\n`);

const MARK = { recorded: '●', stale: '▲', missing: '○' };
const clip = (s) => (s.length > 60 ? `${s.slice(0, 60)}…` : s);

function section(lang) {
  const t = totals[lang];
  const byUnit = {};
  for (const r of rows[lang]) (byUnit[r.unit] ||= []).push(r);

  const title =
    lang === 'en'
      ? 'English teaching and assessment prose'
      : lang === 'my'
        ? 'Burmese teaching and assessment prose'
        : 'Official question wording — one recording each, no language folder';
  let out = `
## ${title} — \`public/audio/${lang}/\`

`;
  out += `**${t.recorded} recorded · ${t.stale} need re-recording · ${t.missing} not yet recorded** (${t.total} total)\n`;

  if (t.orphans.length) {
    out += `\n> **${t.orphans.length} file(s) here match no screen** and will never play:\n> `;
    out += t.orphans.map((o) => `\`${o}\``).join(', ');
    out += `\n>\n> Usually a typo or the wrong case. Filenames are case-sensitive once deployed.\n`;
  }

  const untranslated = rows[lang].filter((r) => r.untranslated).length;
  if (untranslated) {
    out += `\n> **${untranslated} screen(s) below still show English**, because their Burmese has not arrived.\n`;
    out += `> They are marked ⚠ — recording those now is wasted work; the words change when the translation lands.\n`;
  }

  for (const [unit, list] of Object.entries(byUnit)) {
    out += `\n### ${unit}\n\n| | File | Screen | Script |\n|---|---|---|---|\n`;
    for (const r of list) {
      const flag = r.untranslated ? ' ⚠' : '';
      out += `| ${MARK[r.status]} | \`${r.id}.mp3\` | \`${r.id}\`${flag} | ${clip(r.text).replace(/\|/g, '\\|')} |\n`;
    }
  }
  return out;
}

const doc = `# Audio assets — what to record, and what to call it

**Generated** by \`npm run audio\`. Regenerate after adding, renaming or
re-recording anything, and after editing course copy — do not edit this file.

\`●\` recorded · \`▲\` text has changed since recording, re-record · \`○\` not recorded yet

---

## Naming

\`\`\`
public/audio/<lang>/<screen-id>.mp3
\`\`\`

\`<lang>\` is \`en\` or \`my\`. \`<screen-id>\` is the screen's id exactly as it
appears in the tables below — \`U1-S01\`, \`U1-S06b\`, \`U7-S12\` — plus
\`welcome\` for the opening screen, which has no unit of its own.

\`\`\`
public/audio/en/U1-S01.mp3      public/audio/my/U1-S01.mp3
public/audio/en/U1-S06b.mp3     public/audio/my/U1-S06b.mp3
\`\`\`

**Case is not optional.** GitHub Pages is case-sensitive and Windows is not, so
\`u1-s01.mp3\` will play perfectly on your machine and 404 for every learner.
QA check 17 fails on any name that is not an exact match.

**Format:** mono, 48 kbps, 24 kHz MP3. The binding constraint on this project is
prepaid mobile data. Speech needs neither stereo nor music bitrates, and audio
is fetched only when a learner taps Listen — never preloaded.

---

## Editing course text does not rename anything

The filename depends on the screen id **alone** — not on text, not on position,
not on order.

| You change | Filename impact |
|---|---|
| Rewrite a paragraph, or all of them | none |
| Add or remove a paragraph | none |
| Insert a new screen between two others | none; the new screen just needs its own file |
| Reorder screens within a unit | none |
| Fix a typo | none |
| **Rename a screen's id** | breaks — QA check 17 fails and names the orphaned file |

What editing text *does* do is make an existing recording **stale**: the file
still plays, but it says what the page no longer says. That is the failure this
map exists to surface. A stale recording is set aside — the app falls back to
speech, which is always current — until you re-record it and run:

\`\`\`
npm run audio -- --accept          # all of them
npm run audio -- --accept U1-S05   # just one
\`\`\`

Punctuation and capitalisation are ignored when deciding this, so fixing a comma
never costs a re-record.

---

## The script to read

**Work from \`docs/narration-script.json\`, not from the tables below.** The
tables clip long text to fit a column; that file has the whole thing, keyed the
same way as the filenames. Clipped tables are exactly how the first translation
delivery lost 23 fields.

Read the text as written. It is derived from what is on the screen, so the
learner who listens and the learner who reads get the same course.
${[...LANGS, QUESTION_DIR].map(section).join('\n---\n')}`;

if (!existsSync(join(root, 'docs'))) mkdirSync(join(root, 'docs'), { recursive: true });
writeFileSync(join(root, 'docs', 'AUDIO-ASSETS.md'), doc, 'utf8');

// --- Report -----------------------------------------------------------------

console.log('\nAudio assets\n');
for (const lang of [...LANGS, QUESTION_DIR]) {
  const t = totals[lang];
  console.log(`  ${lang}: ${t.recorded} recorded · ${t.stale} stale · ${t.missing} missing  (of ${t.total})`);
  for (const o of t.orphans) console.log(`       ✗ ${lang}/${o} matches no screen — it will never play`);
  for (const r of rows[lang].filter((x) => x.status === 'stale')) {
    console.log(`       ▲ ${lang}/${r.id}.mp3 — text changed since recording`);
  }
}
console.log('\n  src/lib/content/audio-manifest.json');
console.log('  docs/AUDIO-ASSETS.md');
console.log('  docs/narration-script.json\n');

if (accepting) console.log(`  accepted ${acceptOnly || 'all stale recordings'}\n`);
