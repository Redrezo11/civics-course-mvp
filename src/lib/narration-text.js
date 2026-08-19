// narration-text.js — what gets read aloud, and how it is cut up to be read.
//
// Deliberately free of Svelte, the DOM and the audio manifest, because the
// build script that generates the recording map imports THIS FILE. The script
// and the running app therefore compute the same narration text and the same
// hash from the same code. Two implementations of "what does this screen say"
// would drift, and the drift would only surface as a recording that quietly no
// longer matches its screen.

import { textHash } from './text-hash.js';

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

// --- Segments ---------------------------------------------------------------
//
// Narration is a list of { text, lang } rather than one string, because an
// assessment screen in Burmese is genuinely bilingual: Burmese prose around an
// ENGLISH official question, because the officer asks in English (G-3). One
// utterance carries one language — `my-MM` mangles the English, `en-US` mangles
// the Burmese — so the language has to travel with the text.

/** One segment, or none if the text is empty. */
export function seg(text, lang = 'en') {
  const s = String(text ?? '').trim();
  return s ? [{ text: s, lang }] : [];
}

/** Everything spoken, as one string — for hashing and for the recording script. */
export function flatten(segments) {
  if (typeof segments === 'string') return segments;
  return (segments || []).map((s) => s.text).join(' ');
}

/**
 * Answer options, spoken in the order they are DISPLAYED.
 *
 * The caller passes the array the buttons render, never `q.options`.
 * `presentOptions()` shuffles per question, so reading the authored order would
 * speak them in a different order from the screen — for a learner who cannot
 * see them, worse than no audio at all.
 *
 * Nothing here distinguishes the correct option. The ✓/✗ markers only exist in
 * the answered branch of the templates, and no accepted-answer list is consulted.
 *
 * Numbered because four unlabelled choices in a row are hard to hold by ear.
 * The buttons carry no visible numbers, so this is the one place narration adds
 * text rather than reading it.
 */
export function optionSegments(options, { glosses = [], lang = 'en' } = {}) {
  return (options || []).flatMap((opt, i) => [
    ...seg(`${i + 1}. ${opt}`, 'en'),
    ...(glosses[i] ? seg(glosses[i], lang) : []),
  ]);
}

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
export function narrationFor(screen, { officialQuestion = '', lang = 'en' } = {}) {
  if (!screen) return [];
  if (screen.narrationText) return seg(screen.narrationText, lang);

  const fields = NARRATED_FIELDS[screen.type];
  if (!fields) return [];

  const out = [];
  let prose = '';
  const flush = () => {
    if (prose) out.push(...seg(prose, lang));
    prose = '';
  };

  for (const field of fields) {
    // The official question stays English even inside Burmese teaching prose,
    // so it breaks the run and becomes its own segment.
    if (field === '@question') {
      flush();
      out.push(...seg(officialQuestion, 'en'));
      continue;
    }
    const part = fieldText(screen, field, officialQuestion).trim();
    if (!part) continue;
    prose += prose ? `${endsSentence(prose) ? ' ' : '. '}${part}` : part;
  }
  flush();
  return out;
}

// --- Assessment surfaces ----------------------------------------------------
//
// The rule is the same everywhere: narrate exactly what is on screen right now.
// Anything only rendered after an answer is only narrated after an answer, so
// the pre-answer narration cannot give the answer away — it does not have it.

/**
 * One official test question, as rendered by PracticeItem: lesson practice,
 * the full-bank sets, and R1–R3.
 */
export function practiceSegments({
  label = '',
  official = '',
  questionId = '',
  presented = null,
  multiSelectCount = 0,
  answered = false,
  correctAnswerText = '',
  explain = '',
  currentAnswer = null,
  lang = 'en',
} = {}) {
  // The official question is tagged with its id, so the playlist can find a
  // recording for it. One file per question serves every screen that asks it —
  // including Rehearsal and the full-bank sets, which draw at random.
  const out = [...seg(label, lang), ...seg(official, 'en').map((x) => ({ ...x, questionId }))];

  // ◆ Dynamic questions have no options at all — a current-answer card instead,
  // which may say the answer has not been checked. Read what is there; never
  // present an unverified value as fact.
  if (currentAnswer !== null) {
    if (currentAnswer?.verified && currentAnswer?.value) {
      out.push(...seg(currentAnswer.label || 'Current answer', lang), ...seg(currentAnswer.value, 'en'));
    } else {
      out.push(
        ...seg('This answer has not been checked yet.', lang),
        ...seg(
          'This one changes with elections or appointments. Look it up before your interview — never rely on an old answer.',
          lang
        )
      );
    }
    return out;
  }

  if (multiSelectCount) out.push(...seg(`Choose ${multiSelectCount}.`, lang));
  out.push(...optionSegments(presented?.options, { lang }));

  if (answered) {
    out.push(
      ...(multiSelectCount
        ? seg('Accepted answers are marked with a tick.', lang)
        : seg('The correct answer is', lang)),
      ...(multiSelectCount ? [] : seg(correctAnswerText, 'en')),
      ...seg(explain, lang)
    );
  }
  return out;
}

/**
 * Rehearsal, which is self-scored: the learner answers from memory, then
 * reveals. Narrating the accepted answers before the reveal would destroy the
 * exercise, so they only exist here once `revealed`.
 */
export function rehearsalSegments({ official = '', questionId = '', revealed = false, accepted = [], lang = 'en' } = {}) {
  const out = seg(official, 'en').map((x) => ({ ...x, questionId }));
  if (!revealed) return out;
  out.push(...seg('Accepted answers', lang));
  for (const a of accepted) out.push(...seg(a, 'en'));
  return out;
}

/** One guided-practice item, in whichever of its four shapes it takes. */
export function guidedItemSegments(item, { answered = false, lang = 'en' } = {}) {
  if (!item) return [];
  const out = [...seg(item.instructions, lang), ...seg(item.question, lang)];
  if (item.cardText) out.push(...seg(item.cardText, 'en'));

  if (item.buckets) {
    out.push(...seg('Categories:', lang), ...optionSegments(item.buckets, { glosses: item.bucketsGloss || [], lang }));
  }
  if (item.sortItems) {
    out.push(
      ...seg('Items to sort:', lang),
      ...optionSegments(item.sortItems.map((s) => s.text), { glosses: item.sortItemsGloss || [], lang })
    );
  }
  if (item.orderItems) {
    out.push(...seg('Put these in order:', lang), ...optionSegments(item.orderItems, { glosses: item.orderItemsGloss || [], lang }));
  }
  if (item.options) {
    out.push(...optionSegments(item.options, { glosses: item.optionsGloss || [], lang }));
  }
  if (answered && item.pairedOfficial) {
    out.push(...seg('It asks the same thing as the official question:', lang), ...seg(item.pairedOfficial, 'en'));
  }
  return out;
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
 * from one who reads.
 *
 * Shared with translation freshness, which has the identical problem: see
 * src/lib/text-hash.js.
 */
export function narrationHash(text) {
  return textHash(flatten(text));
}
