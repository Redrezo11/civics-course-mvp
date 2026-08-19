// text-hash.js — "has this text changed in a way that matters?"
//
// One function, two callers, because they are asking the same question about
// two kinds of derived artefact:
//
//   · a recorded narration outlives the screen text it was read from, and then
//     says what the page no longer says;
//   · a translation outlives the English it was translated from, and then says
//     what the page no longer says.
//
// Neither failure produces an error. Nothing 404s, nothing blanks — a learner
// simply receives different content from the one the author last wrote, in the
// one channel nobody proof-reads. Both are caught the same way.

/**
 * A hash of what the text MEANS, not of its bytes.
 *
 * Normalised first: lowercased, punctuation and symbols stripped, whitespace
 * collapsed. Fixing a comma or a capital must not cost a re-record or a
 * re-translation; changing the words must.
 *
 * Unicode-aware, so this works on Burmese as well as English — `\p{L}` keeps
 * Myanmar letters while dropping ၊ and ။.
 */
export function textHash(text) {
  const normalised = flattenish(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

  // FNV-1a, the same one the option shuffler uses. Not cryptographic — it only
  // has to notice that two strings differ.
  let h = 0x811c9dc5;
  for (let i = 0; i < normalised.length; i += 1) {
    h ^= normalised.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Accepts the shapes both callers actually hold: a string, a list of narration
 * segments, or a content field that may be a list of paragraphs or a list of
 * objects. Hashing has to survive whatever the field is, or the guard would
 * quietly skip exactly the long fields most likely to be edited.
 */
function flattenish(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(flattenish).join(' ');
  if (typeof value === 'object') return Object.values(value).map(flattenish).join(' ');
  return String(value);
}
