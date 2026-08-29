// localise.js — merging one language overlay over one English screen.
//
// Split out of i18n.js so that Node scripts can use it. i18n.js imports Svelte
// stores and the progress store, which reaches for localStorage; neither exists
// in a build script. scripts/audio-assets.js has to resolve the same localised
// text the app renders, or the recording script it generates would list English
// where the learner sees Burmese.
//
// The one import is the shared text hash, which is itself import-free.

import { textHash } from './text-hash.js';

/**
 * Answer surfaces, which are NEVER replaced by their translation.
 *
 * Anything the learner picks as an answer stays English and gains the Burmese
 * as a secondary gloss beneath it. The officer conducts the interview in
 * English, so an answer met only in Burmese is an answer they cannot give.
 *
 * A second benefit falls out of it: `correctIndex` indexes into `options`, and
 * each `sortItems` entry carries the `bucket` it scores against. Because these
 * arrays are never touched, a translation cannot shift or shorten them — a
 * delivery of `sortItems` as plain strings once erased every bucket index in
 * five units.
 */
export const GLOSS_FIELDS = {
  options: 'optionsGloss',
  buckets: 'bucketsGloss',
  orderItems: 'orderItemsGloss',
  sortItems: 'sortItemsGloss', // list of strings, aligned by index with sortItems[].text
};

/**
 * Apply overlay fields to one object: replace ordinary fields, gloss answers.
 *
 * A gloss is always a flat list of strings so components have one contract.
 * `sortItems` is the case worth naming: the English entries are
 * `{ text, bucket }` objects, and a translation of one may arrive as a bare
 * string or as an object of the same shape. Both reduce to the text here rather
 * than in nine template branches.
 */
export function applyFields(english, fields) {
  const out = { ...english };
  for (const [key, value] of Object.entries(fields)) {
    // VOCAB CARDS ARE A MIXED CASE, AND GETTING IT WRONG DELETES THE LESSON.
    //
    // A card has three parts doing two different jobs. `word` is the English
    // civics term the officer will actually use — every one of them appears in
    // the official question wording or the accepted answers ("branch", "veto",
    // "justice", "amendment", "federal", "right"). Replacing it with Burmese
    // removes the single thing a vocabulary screen exists to teach: a learner
    // who has only ever seen အခွဲ cannot recognise "branch" when it is said to
    // them. Same rule as an answer option, for the same reason.
    //
    // `def` and `example` are explanation, not terms, so they are replaced —
    // that is where the Burmese earns its place.
    //
    // The delivery format is unchanged: a translated card still arrives as
    // { word, def, example }. Its `word` becomes the GLOSS beside the English
    // rather than a replacement for it.
    if (key === 'cards' && Array.isArray(english.cards) && Array.isArray(value)) {
      out.cards = english.cards.map((card, i) => {
        const t = value[i] || {};
        return {
          ...card,
          ...(t.word ? { wordGloss: t.word } : {}),
          ...(t.def ? { def: t.def } : {}),
          ...(t.example ? { example: t.example } : {}),
        };
      });
      continue;
    }

    const glossKey = GLOSS_FIELDS[key];
    if (glossKey && Array.isArray(english[key]) && Array.isArray(value)) {
      out[glossKey] = value.map((v) => (typeof v === 'string' ? v : v?.text));
    } else if (!glossKey) {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Merge a screen with the overlay fields for that screen, if any.
 *
 * Shallow by field: an overlay supplies whole values, never partial ones.
 * Anything it does not carry stays English — a partial translation must never
 * break the course.
 */
export function localiseWith(screen, fields, freshness = null) {
  if (!screen || !fields) return screen;

  // Drop any field whose English has been rewritten since it was translated.
  //
  // A translation outlives the English it was made from and then says what the
  // page no longer says — nothing errors, nothing blanks, and only a Burmese
  // reader would ever notice. English is always current, so it takes over until
  // the translation catches up. The same choice recorded audio already makes,
  // for the same reason.
  //
  // U0-S04 is why this exists: its copy told the learner to answer out loud
  // while rendering three tappable options, and its Burmese said so too.
  const usable = freshness
    ? Object.fromEntries(
        Object.entries(fields).filter(([field]) => {
          const known = freshness[field];
          return !known || known.en === textHash(screen[field]);
        })
      )
    : fields;

  const { items, ...rest } = usable;
  const out = applyFields(screen, rest);

  // `items` (guided practice) is a list of objects, so merge item by item
  // rather than replacing the array and losing correctIndex/kind/bucket.
  if (items && Array.isArray(screen.items)) {
    out.items = screen.items.map((item, i) => applyFields(item, items[i] || {}));
  }
  return out;
}
