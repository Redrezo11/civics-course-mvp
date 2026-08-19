// narration-text.js — what gets read aloud, and how it is cut up to be read.
//
// Deliberately free of Svelte, the DOM and the audio manifest, because the
// build script that generates the recording map imports THIS FILE. The script
// and the running app therefore compute the same narration text and the same
// hash from the same code. Two implementations of "what does this screen say"
// would drift, and the drift would only surface as a recording that quietly no
// longer matches its screen.

/**
 * Screens that get narration, and the fields read on each — in render order,
 * so the audio follows the eye down the page.
 *
 * Excluded on purpose:
 *   practice / hook / tryOne / guidedPractice — assessment, not instruction.
 *   vocab — a flip-card deck whose whole point is progressive reveal; reading
 *           every card on arrival gives away the answers.
 *
 * Interface controls are excluded by construction rather than by filtering:
 * this names the content fields to read, so Back, Exit, Next, primaryLabel and
 * the full-bank offer button can never be picked up by accident.
 */
export const NARRATED_FIELDS = {
  info: ['heading', 'clueList', 'bodyList', 'body'],
  orient: ['unitLabel', 'heading', 'body', '@question', 'afterQuote', 'coverageLine', 'afterTest'],
  connect: ['bodyList', 'bodyList2', 'closing'],
  bigIdea: ['paragraphs', 'twoColumn', 'closing', 'resolution', 'handle', 'handleSub'],
  seeItNotIt: ['heading', 'example', 'nonExample', 'takeaway'],
  confusablePair: ['heading', 'termA', 'termB', 'resolution'],
  lockItIn: ['heading', 'learnedLine'],
};

/**
 * Fields that exist on narrated screens but are never spoken: identifiers,
 * asset filenames, button labels, and the interactive payloads.
 *
 * Listed rather than ignored so that a NEW content field is neither narrated
 * nor silently dropped — a test asserts every field on a narrated screen
 * appears in one list or the other, and fails on anything unaccounted for.
 */
export const NOT_NARRATED = [
  'id', 'type', 'primaryLabel', 'image', 'alt', 'companionPose',
  'sampleQuestionId', 'questionId', 'unlocksReview', 'fullBankOffer',
  'items', 'options', 'optionsGloss', 'cards', 'feedback', 'feedbackExplain',
  'question', 'narrationText', 'audioSrc',
];

export const NARRATED_TYPES = Object.keys(NARRATED_FIELDS);

const TERMINATORS = '.!?။၊';
const endsSentence = (s) => TERMINATORS.includes(s.trim().slice(-1));

/** One field's visible text, flattened in the order it appears on screen. */
function fieldText(screen, field, officialQuestion) {
  if (field === '@question') return officialQuestion || '';
  const v = screen[field];
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) {
    return v
      .map((entry) => {
        if (typeof entry === 'string') return entry;
        // clueList is [word, meaning] pairs rendered as "word → meaning".
        if (Array.isArray(entry)) return `${entry[0]}: ${entry[1]}`;
        // twoColumn is { image, heading, body }; the image is a placeholder.
        if (entry && typeof entry === 'object') return [entry.heading, entry.body].filter(Boolean).join('. ');
        return '';
      })
      .filter(Boolean)
      .join(' ');
  }
  // termA / termB are { name, def }.
  if (typeof v === 'object') return [v.name, v.def].filter(Boolean).join(': ');
  return '';
}

/**
 * The narration for one screen.
 *
 * `screen.narrationText` wins when authored — the escape hatch for a screen
 * that should be spoken differently from how it reads. Otherwise the text is
 * DERIVED from the visible fields, which is what keeps narration in step with
 * the copy for free: pass a localised screen and the narration is localised
 * too, with no second set of strings to translate and no second copy to drift.
 *
 * @param screen           a screen object, ideally already localised
 * @param officialQuestion the official wording for an `orient` screen's card
 */
export function narrationFor(screen, { officialQuestion = '' } = {}) {
  if (!screen) return '';
  if (screen.narrationText) return String(screen.narrationText).trim();

  const fields = NARRATED_FIELDS[screen.type];
  if (!fields) return '';

  let out = '';
  for (const field of fields) {
    const part = fieldText(screen, field, officialQuestion).trim();
    if (!part) continue;
    if (!out) out = part;
    else out += `${endsSentence(out) ? ' ' : '. '}${part}`;
  }
  return out.trim();
}

// --- Chunking ---------------------------------------------------------------

/**
 * Desktop Chrome silently truncates a single utterance at about fifteen
 * seconds — roughly 200-250 characters — mid-sentence and with no error. Every
 * bigIdea and orient screen in this course is longer than that.
 *
 * The usual workaround is a timer calling resume() every fourteen seconds. That
 * is wrong here: it would fight the Pause button, restarting narration the
 * learner had just stopped. Chunking fixes the truncation instead, and the same
 * mechanism gives us a working Pause on Android, where the native pause() ends
 * the utterance and resume() does nothing at all.
 */
export const SPEECH_CHUNK_MAX = 180;

/** Hard-wrap one piece that is still too long after sentence splitting. */
function wrap(piece, max) {
  if (piece.length <= max) return [piece];
  const out = [];
  let buf = '';
  for (const word of piece.split(' ')) {
    if (!buf) buf = word;
    else if (buf.length + 1 + word.length <= max) buf += ` ${word}`;
    else {
      out.push(buf);
      buf = word;
    }
  }
  if (buf) out.push(buf);

  // Burmese is written without spaces between words, so a "word" here can be a
  // whole paragraph. Split what is left by character count — imperfect, but a
  // clause boundary in the wrong place is far better than being cut off.
  return out.flatMap((s) => (s.length <= max ? [s] : s.match(new RegExp(`.{1,${max}}`, 'gu')) || [s]));
}

/**
 * Split narration into utterance-sized chunks at sentence boundaries.
 *
 * Burmese does not end sentences with a full stop — it uses ၊ (U+104A) and
 * ။ (U+104B). A splitter that knew only `.?!` would return one enormous chunk
 * for every Burmese screen and walk straight back into the truncation bug, in
 * the language whose support is already worst.
 */
export function splitForSpeech(text, max = SPEECH_CHUNK_MAX) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  const sentences = clean.match(/[^.!?။၊]+[.!?။၊]*\s*/gu) || [clean];
  const out = [];
  let buf = '';

  for (const sentence of sentences) {
    for (const piece of wrap(sentence.trim(), max)) {
      if (!piece) continue;
      if (!buf) buf = piece;
      else if (buf.length + 1 + piece.length <= max) buf += ` ${piece}`;
      else {
        out.push(buf);
        buf = piece;
      }
    }
  }
  if (buf) out.push(buf);
  return out;
}

// --- Freshness --------------------------------------------------------------

/**
 * A recording keeps playing after its screen's text is rewritten. Nothing 404s
 * and nothing errors — the audio simply says something the page no longer says,
 * silently and indefinitely, so a learner who listens gets different content
 * from one who reads. This hash is how that is detected.
 *
 * Normalised first: lowercased, punctuation and symbols stripped, whitespace
 * collapsed. Fixing a comma or a capital must not cost a re-record; changing
 * the words must.
 */
export function narrationHash(text) {
  const normalised = String(text ?? '')
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
