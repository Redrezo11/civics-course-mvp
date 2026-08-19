// localise.js — merging one language overlay over one English screen.
//
// Split out of i18n.js so that Node scripts can use it. i18n.js imports Svelte
// stores and the progress store, which reaches for localStorage; neither exists
// in a build script. scripts/audio-assets.js has to resolve the same localised
// text the app renders, or the recording script it generates would list English
// where the learner sees Burmese.
//
// Nothing in here imports anything.

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
export function localiseWith(screen, fields) {
  if (!screen || !fields) return screen;

  const { items, ...rest } = fields;
  const out = applyFields(screen, rest);

  // `items` (guided practice) is a list of objects, so merge item by item
  // rather than replacing the array and losing correctIndex/kind/bucket.
  if (items && Array.isArray(screen.items)) {
    out.items = screen.items.map((item, i) => applyFields(item, items[i] || {}));
  }
  return out;
}
