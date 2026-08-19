#!/usr/bin/env node
/**
 * build-translations.js — turn translation sources into language overlays.
 *
 * Output: src/lib/content/translations/my/unitN.json
 *           { "U1-S02": { "question": "…", "options": ["…"] }, … }
 *
 * The overlay is keyed screenId → field → value and is merged over the English
 * screen at render. The renderer and the English content never change.
 *
 *   node scripts/build-translations.js          # all units
 *   node scripts/build-translations.js unit3    # one unit
 *
 * TWO SOURCE FORMATS
 *
 * 1. Flat — `docs/translations/unitN.json`, `{ screenId: { field: value } }`.
 *    What the request document asks for and what translators deliver. Already
 *    overlay-shaped, so this pass is validation rather than mapping.
 *
 * 2. Bilingual — `docs/translations/unitN.bilingual-source.json`, the older
 *    `{ en, my }`-paired file. Only Unit 1 has one.
 *
 * Where both exist they are merged, flat winning on conflict. Unit 1 needs
 * this: the bilingual file covers 17 fields the flat delivery does not, and the
 * flat delivery covers 21 the bilingual file could not map.
 *
 * WHY THE BILINGUAL PASS ONLY MAPS PART OF ITS SOURCE
 *
 * That file was authored against an older screen schema. Some of its screens
 * are a single prose blob where the build has several distinct fields — U1-S01
 * is one paragraph against six fields; U1-S03 is three paragraphs against
 * bodyList(4) + bodyList2(2) + closing.
 *
 * Splitting a Burmese paragraph to fill those fields would mean guessing
 * sentence boundaries in a script that cannot be proof-read here. That is the
 * same class of mistake as reconstructing corrupted text: it produces
 * confident, unverifiable output that a learner reads as fact.
 *
 * So: map only where the shapes correspond exactly, and report everything else
 * as work for the translator. A short correct overlay beats a complete guess.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { textHash } from '../src/lib/text-hash.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const LANG = 'my';
const ALL = ['unit0', 'unit1', 'unit2', 'unit3', 'unit4', 'unit5', 'unit6', 'unit7'];
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const QUESTIONS = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7'].flatMap((u) =>
  readJson(join(root, 'src', 'lib', 'content', `questions-${u}.json`))
);
const OFFICIAL = QUESTIONS.map((q) => q.official).filter((s) => s.length > 15);
const ACCEPTED = new Set(QUESTIONS.flatMap((q) => q.acceptedAnswers).filter((s) => s.length > 12));

// Answer surfaces. Their translations are never rendered as the answer itself —
// the English stays primary and these become the grey gloss line beneath it
// (see GLOSS_FIELDS in src/lib/i18n.js and AnswerLabel.svelte). That changes
// what the generator owes them: they are no longer subject to the G-3 drop,
// because a translated accepted answer sitting under the English one is the
// intended result rather than a violation.
const ANSWER_FIELDS = new Set(['options', 'buckets', 'orderItems', 'sortItems']);

const hasMyanmar = (s) => /[က-႟]/.test(String(s));

// ---------------------------------------------------------------------------
// Bilingual source → overlay
// ---------------------------------------------------------------------------

function fromBilingual(source, buildById, gaps, notes) {
  const overlay = {};

  const put = (screenId, field, value) => {
    if (value === undefined || value === null) return;
    (overlay[screenId] ||= {})[field] = value;
  };

  /** Only map a list when the two shapes are the same length. */
  const putList = (screenId, field, values, englishList, why) => {
    if (!Array.isArray(englishList)) return;
    if (!Array.isArray(values) || values.length !== englishList.length) {
      gaps.push(
        `${screenId}.${field}: source has ${values?.length ?? 0}, build expects ${englishList.length}${why ? ` — ${why}` : ''}`
      );
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
          gaps.push(
            `${s.id}.termA/termB: source combines term and definition in one string; build stores them separately`
          );
        } else if (s.text?.[LANG]) {
          const target = en.paragraphs ? 'paragraphs' : en.bodyList ? 'bodyList' : null;
          if (!target) {
            // Name the fields, so the merge check below can tell whether
            // another source has since filled them.
            const split = Object.keys(en).filter((k) => !['id', 'type', 'primaryLabel', 'image'].includes(k));
            gaps.push(`${s.id}.${split.join('/')}: source is one prose blob; the build splits it across these fields`);
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
          gaps.push(
            `${s.id}.feedbackExplain: source feedback.wrong restates the answer first; needs the prefix removed by a Burmese reader`
          );
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

  // --- U1-S09: four source screens become the four items of one screen ------
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

  return overlay;
}

// ---------------------------------------------------------------------------
// Merge — flat wins, but `items` merges per index so a screen can draw both
// its item 0 from one source and its item 2 from the other.
// ---------------------------------------------------------------------------

function mergeOverlays(base, top) {
  const out = { ...base };
  for (const [screenId, fields] of Object.entries(top)) {
    const existing = out[screenId];
    if (!existing) {
      out[screenId] = fields;
      continue;
    }
    const merged = { ...existing, ...fields };
    if (Array.isArray(existing.items) && Array.isArray(fields.items)) {
      const n = Math.max(existing.items.length, fields.items.length);
      merged.items = Array.from({ length: n }, (_, i) => ({
        ...(existing.items[i] || {}),
        ...(fields.items[i] || {}),
      }));
    }
    out[screenId] = merged;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Shape normalisation — a translated list of strings, over a list of objects.
//
// The request document presents `sortItems` as its visible text joined by " | ",
// so translators return plain strings. The build stores { text, bucket }, where
// `bucket` is the index the sort scores against. Merging strings over those
// objects deletes every bucket, and a sort item with no bucket cannot be scored
// — it fails silently, in Burmese only, on five units at once.
//
// So the string is folded back into the English object rather than replacing
// it. Only done when the English object has exactly ONE string-valued key, so
// there is no question which field the translation belongs in. Anything
// ambiguous is an error, not a guess.
// ---------------------------------------------------------------------------

function normaliseShape(overlay, buildById, unusable) {
  const AMBIGUOUS = Symbol('ambiguous');

  const fold = (where, value, english) => {
    if (!Array.isArray(english) || !Array.isArray(value)) return value;
    let bad = null;
    const out = value.map((v, i) => {
      const e = english[i];
      if (typeof v !== 'string' || !e || typeof e !== 'object' || Array.isArray(e)) return v;
      const stringKeys = Object.keys(e).filter((k) => typeof e[k] === 'string');
      if (stringKeys.length !== 1) {
        bad ||= `one string cannot be split across { ${stringKeys.join(', ')} } — the request asked for this field in a flattened form it cannot come back from; deliver it as objects`;
        return v;
      }
      return { ...e, [stringKeys[0]]: v };
    });
    if (bad) {
      unusable.push(`${where}: ${bad}`);
      return AMBIGUOUS;
    }
    return out;
  };

  for (const [screenId, fields] of Object.entries(overlay)) {
    const en = buildById[screenId];
    if (!en) continue;
    for (const [field, value] of Object.entries(fields)) {
      if (field === 'items' && Array.isArray(value)) {
        value.forEach((item, i) => {
          for (const [k, v] of Object.entries(item || {})) {
            // Answer fields are glosses, so a plain string IS the right shape —
            // folding a sortItem back onto its { text, bucket } object was only
            // needed while the translation replaced the English outright.
            if (ANSWER_FIELDS.has(k)) continue;
            const folded = fold(`${screenId}.items[${i}].${k}`, v, en.items?.[i]?.[k]);
            if (folded === AMBIGUOUS) delete item[k];
            else item[k] = folded;
          }
        });
      } else if (!ANSWER_FIELDS.has(field)) {
        const folded = fold(`${screenId}.${field}`, value, en[field]);
        if (folded === AMBIGUOUS) delete fields[field];
        else fields[field] = folded;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// G-3 — official wording and accepted answers stay English.
//
// A field whose English carries an official question sentence, or a list whose
// English carries an accepted answer, may only be translated around that text.
// Where a source translated it away, the field is DROPPED rather than emitted,
// so the screen falls back to English, and the drop is reported for retranslation.
//
// Dropping beats shipping: an English question in a Burmese lesson is a visible
// gap, whereas a Burmese rendering of an official question is invisible and
// trains the learner on wording no officer will use. The bilingual Unit 1
// source did exactly that on U1-S09's first item, and it shipped.
// ---------------------------------------------------------------------------

function stripUntranslatable(overlay, buildById, official, accepted, dropped) {
  const violates = (value, english) => {
    if (typeof english === 'string') {
      return official.some((o) => english.includes(o) && !String(value).includes(o));
    }
    if (Array.isArray(english)) {
      return english.some(
        (e, i) => typeof e === 'string' && accepted.has(e.trim()) && value?.[i] !== e
      );
    }
    return false;
  };

  for (const [screenId, fields] of Object.entries(overlay)) {
    const en = buildById[screenId];
    if (!en) continue;
    for (const [field, value] of Object.entries(fields)) {
      if (field === 'items' && Array.isArray(value)) {
        value.forEach((item, i) => {
          for (const [k, v] of Object.entries(item || {})) {
            if (ANSWER_FIELDS.has(k)) continue; // rendered as a gloss, never as the answer
            if (violates(v, en.items?.[i]?.[k])) {
              delete item[k];
              dropped.push(`${screenId}.items[${i}].${k}: translated official wording or an accepted answer — kept English`);
            }
          }
        });
      } else if (!ANSWER_FIELDS.has(field) && violates(value, en[field])) {
        delete fields[field];
        dropped.push(`${screenId}.${field}: translated official wording or an accepted answer — kept English`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Gloss preparation — what goes UNDER the English answer.
//
// Two things have to be true of a gloss, and neither is true of the delivery
// as it arrives:
//
// 1. It must not repeat the English. The interpret options were already
//    delivered as "English (Burmese)", which was correct when the option was
//    replaced outright but now prints the English twice. The English prefix is
//    stripped and the brackets unwrapped.
// 2. It must not be English. Six option strings came back deliberately
//    untranslated; rendering those produces the same line twice in two greys.
//    They are removed so no gloss line appears at all.
// ---------------------------------------------------------------------------

function prepareGlosses(overlay, buildById, notes) {
  const clean = (where, value, english) => {
    if (typeof value !== 'string' || typeof english !== 'string') return value;

    let out = value;
    if (out.includes(english)) {
      const rest = out.replace(english, '').trim().replace(/^[([{]\s*|\s*[)\]}]$/g, '').trim();
      // Only accept the remainder if it is actually Burmese. If stripping the
      // English leaves nothing usable, the string was English to begin with.
      if (hasMyanmar(rest)) {
        notes.push(`${where}: stripped the repeated English from the gloss`);
        out = rest;
      }
    }
    if (!hasMyanmar(out)) {
      notes.push(`${where}: no Burmese in the translation — no gloss line will show`);
      return undefined;
    }
    return out;
  };

  const cleanField = (where, value, english) => {
    if (!Array.isArray(value) || !Array.isArray(english)) return value;
    const out = value.map((v, i) => {
      const e = english[i];
      const enText = typeof e === 'string' ? e : e?.text;
      const vText = typeof v === 'string' ? v : v?.text;
      return clean(`${where}[${i}]`, vText, enText);
    });
    return out.some((v) => v !== undefined) ? out.map((v) => v ?? '') : undefined;
  };

  for (const [screenId, fields] of Object.entries(overlay)) {
    const en = buildById[screenId];
    if (!en) continue;
    for (const [field, value] of Object.entries(fields)) {
      if (field === 'items' && Array.isArray(value)) {
        value.forEach((item, i) => {
          for (const [k, v] of Object.entries(item || {})) {
            if (!ANSWER_FIELDS.has(k)) continue;
            const out = cleanField(`${screenId}.items[${i}].${k}`, v, en.items?.[i]?.[k]);
            if (out === undefined) delete item[k];
            else item[k] = out;
          }
        });
      } else if (ANSWER_FIELDS.has(field)) {
        const out = cleanField(`${screenId}.${field}`, value, en[field]);
        if (out === undefined) delete fields[field];
        else fields[field] = out;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Validation — an overlay may only restate fields the English screen already
// has, and a list may only be replaced by a list of the same length.
//
// A short list silently drops an option. A long one adds an option that no
// correctIndex points at. Both ship a broken question rather than an obvious
// error, so they are refusals, not warnings.
// ---------------------------------------------------------------------------

function validate(overlay, buildById, unit) {
  const errors = [];

  const checkList = (where, value, english) => {
    if (!Array.isArray(english)) return;
    if (!Array.isArray(value)) {
      errors.push(`${where}: English is a list of ${english.length}, overlay is ${typeof value}`);
    } else if (value.length !== english.length) {
      errors.push(`${where}: English has ${english.length} item(s), overlay has ${value.length}`);
    }
  };

  for (const [screenId, fields] of Object.entries(overlay)) {
    const en = buildById[screenId];
    if (!en) {
      errors.push(`${screenId}: no such screen in the build`);
      continue;
    }
    for (const [field, value] of Object.entries(fields)) {
      if (!(field in en)) {
        errors.push(`${screenId}.${field}: does not exist on the English screen`);
        continue;
      }
      if (field === 'items') {
        checkList(`${screenId}.items`, value, en.items);
        if (!Array.isArray(value)) continue;
        value.forEach((item, i) => {
          const enItem = en.items?.[i];
          if (!enItem || !item) return;
          for (const [k, v] of Object.entries(item)) {
            if (!(k in enItem)) {
              errors.push(`${screenId}.items[${i}].${k}: does not exist on the English item`);
              continue;
            }
            checkList(`${screenId}.items[${i}].${k}`, v, enItem[k]);
          }
        });
      } else {
        checkList(`${screenId}.${field}`, value, en[field]);
      }
    }
  }
  return errors.map((e) => `${unit}: ${e}`);
}

// ---------------------------------------------------------------------------

function buildUnit(unit) {
  const flatPath = join(root, 'docs', 'translations', `${unit}.json`);
  const bilingualPath = join(root, 'docs', 'translations', `${unit}.bilingual-source.json`);
  const buildPath = join(root, 'src', 'lib', 'content', `${unit}.json`);

  if (!existsSync(flatPath) && !existsSync(bilingualPath)) {
    return { unit, skipped: true };
  }

  const build = readJson(buildPath);
  const buildById = Object.fromEntries(build.screens.map((s) => [s.id, s]));

  const gaps = [];
  const notes = [];
  let overlay = {};

  if (existsSync(bilingualPath)) {
    overlay = fromBilingual(readJson(bilingualPath), buildById, gaps, notes);
  }

  if (existsSync(flatPath)) {
    const flat = readJson(flatPath);
    if (Array.isArray(flat.screens)) {
      // A bilingual file still sitting under the flat name. Refuse rather than
      // emit an overlay full of `{ en, my }` objects the renderer would print
      // as "[object Object]".
      return { unit, errors: [`${unit}: docs/translations/${unit}.json is bilingual — rename it to ${unit}.bilingual-source.json`] };
    }
    const { _note, _status, ...screens } = flat;
    overlay = mergeOverlays(overlay, screens);
  }

  const unusable = [];
  normaliseShape(overlay, buildById, unusable);

  const dropped = [];
  stripUntranslatable(overlay, buildById, OFFICIAL, ACCEPTED, dropped);
  prepareGlosses(overlay, buildById, notes);

  // Gaps come from the bilingual pass, which runs before the flat merge. Once
  // merged, most of Unit 1's are filled — the flat delivery carries exactly the
  // fields the bilingual file could not map. Reporting them anyway would train
  // the reader to ignore the list.
  const stillMissing = gaps.filter((g) => {
    const [, screenId, fieldSpec] = /^([\w-]+)[.:]\s*([\w/]+)?/.exec(g) || [];
    if (!screenId || !fieldSpec) return true;
    return !fieldSpec.split('/').some((f) => overlay[screenId]?.[f] !== undefined);
  });

  const errors = validate(overlay, buildById, unit);
  if (errors.length) return { unit, errors };

  const outDir = join(root, 'src', 'lib', 'content', 'translations', LANG);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, `${unit}.json`), `${JSON.stringify(overlay, null, 2)}\n`);

  const fields = Object.values(overlay).reduce((n, f) => n + Object.keys(f).length, 0);
  const { record, stale } = reconcileFreshness(
    overlay,
    buildById,
    previousFreshness.my?.[unit],
    accepting,
    acceptOnly
  );
  freshness.my[unit] = record;

  return {
    unit,
    screens: Object.keys(overlay).length,
    fields,
    gaps: stillMissing,
    notes,
    dropped,
    unusable,
    stale: stale.map((s) => `${unit}: ${s}`),
  };
}

// ---------------------------------------------------------------------------
// Freshness — is this translation still a translation of THIS English?
//
// A translation outlives the English it was made from, and then says what the
// page no longer says. Nothing errors; only a Burmese reader would ever notice.
// Recorded audio already guards against the identical failure, and this is the
// same mechanism.
//
// TWO hashes per field, and that is the part that has to be right. Recording
// only the English would re-baseline the instant the copy is edited — storing
// the NEW English against the OLD translation and calling it fresh. Keeping the
// translation's own hash lets the two cases be told apart:
//
//   no record                    first translation      → baseline both
//   translation hash changed     a new one arrived      → re-baseline both
//   translation same, English moved  → STALE, keep the old English hash
// ---------------------------------------------------------------------------

const FRESHNESS = join(root, 'src', 'lib', 'content', 'translations', 'freshness.json');

function reconcileFreshness(overlay, buildById, previous, accepting, acceptOnly) {
  const record = {};
  const stale = [];

  for (const [screenId, fields] of Object.entries(overlay)) {
    const en = buildById[screenId];
    if (!en) continue;
    for (const [field, translated] of Object.entries(fields)) {
      const enHash = textHash(en[field]);
      const myHash = textHash(translated);
      const had = previous?.[screenId]?.[field];

      if (!had || had.my !== myHash) {
        // First sight, or the translation itself changed — this IS a
        // translation of the English as it stands now.
        (record[screenId] ||= {})[field] = { en: enHash, my: myHash };
      } else if (had.en === enHash) {
        (record[screenId] ||= {})[field] = had;
      } else if (accepting && (!acceptOnly || acceptOnly === screenId)) {
        (record[screenId] ||= {})[field] = { en: enHash, my: myHash };
      } else {
        // Keep the OLD English hash, so the runtime keeps finding a mismatch
        // and keeps falling back to English until this is retranslated.
        (record[screenId] ||= {})[field] = had;
        stale.push(`${screenId}.${field}`);
      }
    }
  }
  return { record, stale };
}

const requested = process.argv[2] && !process.argv[2].startsWith('--') ? [process.argv[2]] : ALL;
const acceptIdx = process.argv.indexOf('--accept');
const accepting = acceptIdx !== -1;
const acceptOnly = accepting ? process.argv[acceptIdx + 1] : null;
const previousFreshness = existsSync(FRESHNESS) ? readJson(FRESHNESS) : {};
const freshness = { _note: 'GENERATED by scripts/build-translations.js. Records the English each field was translated FROM, so that editing the copy marks its translation stale instead of leaving a translation of text that no longer exists. Never edit by hand.', my: {} };

const results = requested.map(buildUnit);
const failed = results.filter((r) => r.errors?.length);

for (const r of results) {
  if (r.skipped) {
    console.log(`${r.unit}: no source — skipped`);
  } else if (r.errors) {
    console.error(`${r.unit}: FAILED`);
    for (const e of r.errors) console.error(`  ✗ ${e}`);
  } else {
    console.log(`${r.unit}: ${r.screens} screens, ${r.fields} fields`);
    for (const n of r.notes || []) console.log(`    · ${n}`);
    for (const d of r.dropped || []) console.log(`    ✗ G-3 — ${d}`);
    for (const u of r.unusable || []) console.log(`    ✗ shape — ${u}`);
    for (const g of r.gaps || []) console.log(`    ! not mapped — ${g}`);
  }
}

if (failed.length) {
  console.error('\nNo overlay written for the failed units. Fix the source, do not patch the output.');
  process.exit(1);
}

writeFileSync(FRESHNESS, `${JSON.stringify(freshness, null, 2)}\n`);

const staleAll = results.flatMap((r) => r.stale || []);
if (staleAll.length) {
  console.log(`\n${staleAll.length} translation(s) STALE — the English moved after they were translated.`);
  console.log('They fall back to English until retranslated, and are listed in TRANSLATION-REQUEST.md:\n');
  for (const s of staleAll) console.log(`  ▲ ${s}`);
  console.log('\n  node scripts/build-translations.js --accept   if the edit did not need a retranslation\n');
}

const total = results.reduce((n, r) => n + (r.fields || 0), 0);
console.log(`\n${total} fields across ${results.filter((r) => !r.skipped).length} units → src/lib/content/translations/${LANG}/`);
