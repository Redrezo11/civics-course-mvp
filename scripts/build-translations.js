#!/usr/bin/env node
/**
 * build-translations.js — turn a bilingual source into a language overlay.
 *
 * Input:  docs/translations/unitN.json   (bilingual, the translator's file)
 * Output: src/lib/content/translations/my/unitN.json
 *           { "U1-S02": { "question": "…", "options": ["…"] }, … }
 *
 * The overlay is keyed screenId → field → value and is merged over the English
 * screen at render. The renderer and the English content never change.
 *
 * WHY THIS ONLY MAPS PART OF THE SOURCE
 *
 * The bilingual source was authored against an older screen schema. Some of its
 * screens are a single prose blob where the build has several distinct fields —
 * U1-S01 is one paragraph against six fields; U1-S03 is three paragraphs against
 * bodyList(4) + bodyList2(2) + closing.
 *
 * Splitting a Burmese paragraph to fill those fields would mean guessing
 * sentence boundaries in a script that cannot be proof-read here. That is the
 * same class of mistake as reconstructing corrupted text: it produces confident,
 * unverifiable output that a learner reads as fact.
 *
 * So: map only where the shapes correspond exactly, and report everything else
 * as work for the translator. A short correct overlay beats a complete guess.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const LANG = 'my';
const unit = process.argv[2] || 'unit1';

const sourcePath = join(root, 'docs', 'translations', `${unit}.json`);
const buildPath = join(root, 'src', 'lib', 'content', `${unit}.json`);
const outDir = join(root, 'src', 'lib', 'content', 'translations', LANG);
const outPath = join(outDir, `${unit}.json`);

if (!existsSync(sourcePath)) {
  console.error(`No bilingual source at docs/translations/${unit}.json`);
  process.exit(1);
}

const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
const build = JSON.parse(readFileSync(buildPath, 'utf8'));
const buildById = Object.fromEntries(build.screens.map((s) => [s.id, s]));

const overlay = {};
const gaps = [];
const notes = [];

const put = (screenId, field, value) => {
  if (value === undefined || value === null) return;
  (overlay[screenId] ||= {})[field] = value;
};

/** Only map a list when the two shapes are the same length. */
const putList = (screenId, field, values, englishList, why) => {
  if (!Array.isArray(englishList)) return;
  if (!Array.isArray(values) || values.length !== englishList.length) {
    gaps.push(`${screenId}.${field}: source has ${values?.length ?? 0}, build expects ${englishList.length}${why ? ` — ${why}` : ''}`);
    return;
  }
  put(screenId, field, values);
};

for (const s of source.screens) {
  const en = buildById[s.id];

  // Screens that no longer exist. S09a–d are folded into U1-S09 below.
  if (!en && !/^U1-S09[a-d]$/.test(s.id)) {
    notes.push(`${s.id} (${s.type}) has no screen in the build — skipped`);
    continue;
  }

  // alt text is always a clean 1:1 string.
  if (s.alt?.[LANG] && en?.alt) put(s.id, 'alt', s.alt[LANG]);

  switch (s.type) {
    case 'teach': {
      if (s.levels && en.type === 'seeItNotIt') {
        const [l1, l2, l3, l4] = s.levels.map((l) => l.text[LANG]);
        put(s.id, 'heading', l1);
        put(s.id, 'example', l2);
        put(s.id, 'nonExample', l3);
        put(s.id, 'takeaway', l4);
      } else if (s.levels && en.type === 'confusablePair') {
        // levels 2 and 3 combine a term with its definition; the build keeps
        // them apart as termA.name/.def. Not splittable without reading Burmese.
        put(s.id, 'heading', s.levels[0].text[LANG]);
        put(s.id, 'resolution', s.levels[3].text[LANG]);
        gaps.push(`${s.id}.termA/termB: source combines term and definition in one string; build stores them separately`);
      } else if (s.text?.[LANG]) {
        const target = en.paragraphs ? 'paragraphs' : en.bodyList ? 'bodyList' : null;
        if (!target) {
          gaps.push(`${s.id}: source is prose, build has ${Object.keys(en).filter((k) => !['id', 'type', 'primaryLabel', 'image'].includes(k)).join('/')}`);
        } else {
          putList(s.id, target, s.text[LANG], en[target], 'paragraph split differs between source and build');
        }
      }
      break;
    }

    case 'practice': {
      // Hook and guided-practice items carry prompt/options/feedback.
      if (en?.type === 'hook') {
        put(s.id, 'question', s.prompt?.[LANG]);
        putList(s.id, 'options', s.options?.[LANG], en.options);
        put(s.id, 'feedback', s.feedback?.any?.[LANG]);
      } else if (/^U1-S09[acd]$/.test(s.id)) {
        notes.push(`${s.id} maps into U1-S09 items (handled below)`);
      } else if (en?.type === 'practice') {
        // feedback.wrong restates the correct answer before explaining. The
        // English import stripped that prefix by hand; doing the same in
        // Burmese would require reading it, so it is left to the translator.
        gaps.push(`${s.id}.feedbackExplain: source feedback.wrong restates the answer first; needs the prefix removed by a Burmese reader`);
      }
      break;
    }

    case 'reveal': {
      const cards = s.cards || [];
      if (en.cards && cards.length === en.cards.length) {
        put(
          s.id,
          'cards',
          cards.map((c) => ({
            word: c.term?.[LANG],
            def: c.meaning?.[LANG],
            example: c.example?.[LANG],
          }))
        );
      } else {
        gaps.push(`${s.id}.cards: source has ${cards.length}, build expects ${en.cards?.length ?? 0}`);
      }
      break;
    }

    case 'lock-it-in': {
      put(s.id, 'heading', s.heading?.[LANG]);
      put(s.id, 'learnedLine', s.summaryLine?.[LANG]);
      if (s.fullBankOffer?.[LANG] && en.fullBankOffer) {
        put(s.id, 'fullBankOffer', { ...en.fullBankOffer, label: s.fullBankOffer[LANG] });
      }
      break;
    }

    case 'sort':
    case 'official-questions':
      notes.push(`${s.id} (${s.type}) handled separately or removed from the build`);
      break;

    default:
      notes.push(`${s.id}: unhandled source type "${s.type}"`);
  }
}

// --- U1-S09: four source screens become the four items of one screen --------
{
  const target = buildById['U1-S09'];
  const order = ['U1-S09a', 'U1-S09b', 'U1-S09c', 'U1-S09d'];
  const byId = Object.fromEntries(source.screens.map((s) => [s.id, s]));
  if (target?.items && order.every((id) => byId[id])) {
    const items = target.items.map((item, i) => {
      const s = byId[order[i]];
      if (item.kind === 'compare') {
        const out = {};
        if (s.buckets?.length === item.buckets.length) {
          out.buckets = s.buckets.map((b) => b.label?.[LANG]).filter(Boolean);
          if (out.buckets.length !== item.buckets.length) delete out.buckets;
        }
        if (s.items?.length === item.sortItems.length) {
          out.sortItems = item.sortItems.map((si, n) => ({
            ...si,
            text: s.items[n].text?.[LANG] ?? si.text,
          }));
        }
        return out;
      }
      const out = {};
      if (s.prompt?.[LANG]) out.question = s.prompt[LANG];
      if (s.options?.[LANG]?.length === item.options.length) out.options = s.options[LANG];
      return out;
    });
    if (items.some((i) => Object.keys(i).length)) overlay['U1-S09'] = { items };
  }
}

// --- Assert every key we emit exists on the English screen ------------------
let invalid = 0;
for (const [screenId, fields] of Object.entries(overlay)) {
  const en = buildById[screenId];
  if (!en) {
    console.error(`FATAL: overlay targets ${screenId}, which is not in the build`);
    invalid += 1;
    continue;
  }
  for (const field of Object.keys(fields)) {
    if (!(field in en)) {
      console.error(`FATAL: ${screenId}.${field} does not exist on the English screen`);
      invalid += 1;
    }
  }
}
if (invalid) {
  console.error('\nOverlay would introduce fields the renderer never reads. Not writing.');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, `${JSON.stringify(overlay, null, 2)}\n`);

const fields = Object.values(overlay).reduce((n, f) => n + Object.keys(f).length, 0);
console.log(`\nWrote src/lib/content/translations/${LANG}/${unit}.json`);
console.log(`  ${Object.keys(overlay).length} screens, ${fields} fields translated\n`);

if (notes.length) {
  console.log('Notes:');
  for (const n of notes) console.log(`  · ${n}`);
  console.log();
}
if (gaps.length) {
  console.log(`NOT TRANSLATED — ${gaps.length} item(s) need the source re-authored`);
  console.log('against the current screen schema. Listed so they are visible, not guessed:\n');
  for (const g of gaps) console.log(`  · ${g}`);
  console.log();
}
