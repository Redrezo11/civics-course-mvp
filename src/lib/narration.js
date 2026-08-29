// narration.js — one narration plays at a time, and it stops when it should.
//
// Two engines sit behind one interface. Recorded audio is the destination;
// speech synthesis is what runs until the recordings exist. Nothing above this
// module knows which one is playing, so adding audio is a data change.
//
// See docs/NARRATION.md for the file naming convention and the workflow, and
// for the browser defects the speech engine below is shaped around.

import { writable, get } from 'svelte/store';
import { route } from './router.js';
import manifest from './content/audio-manifest.json';
import { flatten, narrationHash, splitForSpeech } from './narration-text.js';

/**
 * Playback state, keyed by OWNER rather than global.
 *
 * A button renders `idle` unless it holds the current playback. With a single
 * shared state every mounted button would mirror whichever one was playing —
 * and the guarantee that only one narration runs at a time would be untestable,
 * because two buttons would agree by accident rather than by design.
 */
export const narration = writable({ owner: null, state: 'idle' });

const BASE = import.meta.env?.BASE_URL ?? './';

let current = null; // { owner, engine } — the single active narration
let token = 0; // invalidates callbacks from an engine we have moved on from

const hasSpeech = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

// --- Voices -----------------------------------------------------------------
//
// SETTING utterance.lang IS A REQUEST, NOT A GUARANTEE.
//
// The engine used to check only that `speechSynthesis` existed, then set
// `utterance.lang = 'my-MM'` and hope. A phone with the Web Speech API but no
// Burmese voice does not refuse: it hands the Burmese to whatever voice it has,
// and an English voice reading Myanmar script produces sounds that are not
// words. The learner is told the page is being read to them and gets noise —
// which is worse than no button at all, because it looks like it worked.
//
// So availability is decided by what is INSTALLED, and a voice is assigned
// explicitly rather than inferred from the tag.

/**
 * The voice list, as a store, because it arrives late.
 *
 * `getVoices()` returns [] on the first call in every Chromium browser and
 * fills in after `voiceschanged`. A component that asked once at mount would
 * conclude "no Burmese on this device" before the device had answered.
 */
export const voices = writable({ ready: false, list: [] });

/**
 * Implementations are inconsistent about tags: "my-MM", "my_MM" and bare "my"
 * all occur, and Android reports underscores. Compare on a normalised form.
 */
const normaliseTag = (tag) => String(tag ?? '').replace(/_/g, '-').toLowerCase();

/** The primary subtag: "my-MM" → "my". */
const primary = (tag) => normaliseTag(tag).split('-')[0];

/** What we ask for, per course language. */
export const SPEECH_LANG = { en: 'en-US', my: 'my-MM' };

/**
 * Best installed voice for a course language, or null.
 *
 * Ranked rather than filtered: an exact region match first, then the bare
 * language, then any region of the same language. A device with only "my-MM" and
 * one with only "my" both work, and neither is served an English voice.
 */
export function voiceFor(lang, list = null) {
  const all = list ?? readVoiceList();
  const want = normaliseTag(SPEECH_LANG[lang] || lang);
  const base = primary(want);
  const same = all.filter((v) => primary(v.lang) === base);
  if (!same.length) return null;
  return (
    same.find((v) => normaliseTag(v.lang) === want) ||
    same.find((v) => normaliseTag(v.lang) === base) ||
    same.find((v) => v.default) ||
    same[0]
  );
}

function readVoiceList() {
  if (!hasSpeech()) return [];
  try {
    return window.speechSynthesis.getVoices() || [];
  } catch {
    // Some embedded browsers throw here rather than returning nothing.
    return [];
  }
}

/**
 * Publish whatever the engine currently reports.
 *
 * `ready` means "the device has answered", not "voices exist". A device with no
 * voices at all is a real answer, and the difference matters: not-yet-answered
 * must not render as unavailable, and unavailable must not render forever as
 * loading.
 */
function publishVoices(ready) {
  const list = readVoiceList();
  voices.set({ ready: ready || list.length > 0, list });
}

if (typeof window !== 'undefined' && hasSpeech()) {
  publishVoices(false);
  window.speechSynthesis.addEventListener?.('voiceschanged', () => publishVoices(true));

  // A device with genuinely no voices never fires `voiceschanged`, and the
  // button would sit disabled-and-waiting for the life of the page. Give the
  // engine a moment, then take silence for an answer.
  setTimeout(() => publishVoices(true), 2000);
}

/** Test seam: re-read the engine now. Never called by the app. */
export function __refreshVoices(ready = true) {
  publishVoices(ready);
}

// --- Source resolution ------------------------------------------------------

/**
 * Where a screen's recording lives, or null if it has none it can use.
 *
 * The manifest is consulted rather than probing the network: trying to load and
 * falling back on error means a 404 and a stall on every screen without audio,
 * on connections that can least afford it.
 *
 * A recording whose stored hash no longer matches the current text is treated
 * as absent. Audio that contradicts the screen is not a lesser form of working
 * — it is the accessibility failure this feature exists to prevent — so speech,
 * which is always current, takes over until the recording catches up.
 */
export function audioSourceFor(screenId, lang, text) {
  if (!screenId) return null;
  const entry = manifest?.[lang]?.[screenId];
  if (!entry) return null;
  if (entry.hash && entry.hash !== narrationHash(text)) return null;
  return `${BASE}audio/${lang}/${screenId}.mp3`;
}

/**
 * An official question's recording. No language folder: the officer asks in
 * English whatever the learner's language is (G-3), so one recording serves
 * both — and it plays wherever that question is asked, including Rehearsal and
 * the full-bank sets, which draw at random and could never have a per-screen
 * recording.
 */
export function questionAudioFor(questionId, text) {
  if (!questionId) return null;
  const entry = manifest?.q?.[questionId];
  if (!entry) return null;
  if (entry.hash && entry.hash !== narrationHash(text)) return null;
  return `${BASE}audio/q/${questionId}.mp3`;
}

// --- Engines ----------------------------------------------------------------

/**
 * ONE audio element for the whole app, reused for every segment of every
 * narration by swapping `src`.
 *
 * Not a micro-optimisation. iOS grants autoplay permission PER ELEMENT, unlocked
 * by a user gesture. A playlist that constructed `new Audio(src)` per segment
 * would create elements that never received a gesture, so segment two onward
 * would silently fail — on iPhone only, after segment one had played perfectly.
 * Reusing one unlocked element is the documented fix.
 */
let sharedAudio = null;
function audioElement() {
  if (!sharedAudio && typeof Audio !== 'undefined') {
    sharedAudio = new Audio();
    sharedAudio.preload = 'none'; // fetched on tap, never ahead of it
  }
  return sharedAudio;
}

/**
 * Play one recorded file to completion.
 *
 * Because the element is shared, a segment must only ever act on it while it
 * still owns it. `stop()` settles the pending play promise first, so it can
 * land AFTER the next narration has already started — without this claim check
 * it would pause the playback that replaced it. A test caught exactly that.
 */
let audioOwner = 0;
function fileSegment(src, onDone) {
  const el = audioElement();
  const claim = ++audioOwner;
  const mine = () => audioOwner === claim;
  let pending = null;
  let stopped = false;

  const settle = async () => {
    try {
      await pending;
    } catch {
      // play() rejects with NotAllowedError without a gesture and AbortError if
      // a pause lands while it is still pending. Both are expected; neither
      // should surface as an unhandled rejection.
    }
  };

  const onEnded = () => {
    if (!stopped && mine()) onDone();
  };

  return {
    start() {
      el.src = src;
      el.currentTime = 0;
      el.onended = onEnded;
      pending = el.play();
      if (pending?.catch) pending.catch(() => {});
    },
    async pause() {
      await settle();
      if (mine()) el.pause();
    },
    resume() {
      if (!mine()) return;
      pending = el.play(); // keeps currentTime — resumes mid-file
      if (pending?.catch) pending.catch(() => {});
    },
    async stop() {
      stopped = true;
      await settle();
      // Only if this segment still holds the element. Another narration may
      // have claimed it while the promise above was settling.
      if (mine()) {
        el.onended = null;
        el.pause();
      }
    },
  };
}

/**
 * Speak one segment, chunked by sentence.
 *
 * Chunking is not an optimisation. Desktop Chrome truncates any single
 * utterance at about fifteen seconds with no error, and Chrome for Android has
 * no working pause() — it ends the utterance and resume() does nothing. Owning
 * the chunk index solves both, and needs no UA sniffing.
 */
function speechSegment(text, lang, onDone) {
  const chunks = splitForSpeech(text);
  let index = 0;
  let live = null; // GC guard — see below
  let gen = 0;

  // Finishing has to be idempotent. The NEXT segment's start() calls
  // speechSynthesis.cancel(), and browsers that fire `end` from cancel() then
  // re-run this segment's handler — which would report it finished a second
  // time and skip the playlist to the end. Cost one test to find.
  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    gen += 1; // nothing from this segment may fire again
    live = null;
    onDone();
  };

  const speakFrom = (from) => {
    index = from;
    if (index >= chunks.length) {
      done();
      return;
    }

    const mine = ++gen;
    const utterance = new SpeechSynthesisUtterance(chunks[index]);
    // Android will not pick the right language without this, and reports its
    // own voice languages with an underscore ("en_US") if they are ever read.
    utterance.lang = SPEECH_LANG[lang] || SPEECH_LANG.en;

    // The voice is ASSIGNED, not left to the tag.
    //
    // `lang` alone is a hint the engine may ignore, and the way it ignores it is
    // to read Burmese with an English voice. canNarrate refuses to offer the
    // control in that case, so reaching here without a voice should be
    // impossible — but if it ever happens, silence is the correct failure. A
    // wrong-language reading is not a degraded success.
    const voice = voiceFor(lang);
    if (!voice) {
      done();
      return;
    }
    utterance.voice = voice;

    const advance = () => {
      // cancel() fires `end` on some browsers and not others. Without this the
      // pause would immediately start the next sentence — Pause would read as
      // Skip.
      if (mine !== gen) return;
      speakFrom(index + 1);
    };
    utterance.onend = advance;
    utterance.onerror = advance;

    // Chrome can garbage-collect an utterance mid-speech, after which `end`
    // never fires and the button stays on "Pause" for good.
    live = utterance;
    window.speechSynthesis.speak(utterance);
  };

  return {
    start() {
      window.speechSynthesis.cancel(); // also the fix for the first speak() failing
      speakFrom(0);
    },
    pause() {
      gen += 1;
      window.speechSynthesis.cancel();
    },
    resume() {
      window.speechSynthesis.cancel();
      speakFrom(index);
    },
    stop() {
      gen += 1;
      live = null;
      window.speechSynthesis.cancel();
    },
  };
}

/**
 * A narration: a list of segments played end to end, each resolving on its own
 * to a recording or to speech.
 *
 * That independence is what lets recorded audio arrive piecemeal. The 128
 * official questions can be recorded once and reused everywhere they are asked
 * — including Rehearsal and the full-bank sets, which draw at random and could
 * never have a per-screen recording — while everything around them stays
 * synthesised until someone records it.
 */
function playlist(segments, onEnd) {
  let at = 0;
  let currentSegment = null;
  let stopped = false;

  const startAt = (i) => {
    at = i;
    if (stopped) return;
    if (at >= segments.length) {
      currentSegment = null;
      onEnd();
      return;
    }
    const s = segments[at];
    const src = s.audioSrc || null;

    // A segment in a language this device cannot speak is SKIPPED, never read
    // in another voice. The common case is a Burmese screen quoting the
    // official question in English on a device with no English voice: the
    // Burmese still plays, and the quoted sentence is silent rather than
    // mangled. canNarrate already refuses the control when it is the learner's
    // own language that is missing.
    if (!src && !voiceFor(s.lang)) {
      startAt(at + 1);
      return;
    }

    currentSegment = src
      ? fileSegment(src, () => startAt(at + 1))
      : speechSegment(s.text, s.lang, () => startAt(at + 1));
    currentSegment.start();
  };

  return {
    play: () => startAt(0),
    pause: () => currentSegment?.pause(),
    resume: () => currentSegment?.resume(),
    async stop() {
      stopped = true;
      await currentSegment?.stop();
      currentSegment = null;
    },
  };
}

// --- Public interface -------------------------------------------------------

/**
 * Attach a recording to any segment that has one.
 *
 * Screen prose resolves by screen id and language; an official question
 * resolves by question id with no language at all, because official wording is
 * English in every language and recording it twice would be wrong.
 */
function resolve(segments, { screenId, lang }) {
  return segments.map((s) => {
    if (s.audioSrc) return s;
    if (s.questionId) {
      const src = questionAudioFor(s.questionId, s.text);
      return src ? { ...s, audioSrc: src } : s;
    }
    if (s.screenPart && screenId) {
      const src = audioSourceFor(screenId, lang, s.text);
      return src ? { ...s, audioSrc: src } : s;
    }
    return s;
  });
}

/**
 * Start narrating. Cancels whatever was playing first, which is what makes
 * "two narrations never overlap" structural rather than a rule to remember.
 *
 * Resolution is SYNCHRONOUS on purpose. This runs inside a click handler, and
 * awaiting anything before speak()/play() loses the user activation that iOS
 * and Chrome both require.
 */
export function play({ owner, screenId, segments, text, audioSrc, lang = 'en' }) {
  cancel();

  // A bare string is still accepted — a one-segment narration.
  let list = segments && segments.length ? segments : text ? [{ text, lang, screenPart: true }] : [];
  if (audioSrc && list.length) list = [{ ...list[0], audioSrc }];
  if (!list.length) return;

  list = resolve(list, { screenId, lang });
  // Nothing would be heard: no recording, and no voice for anything in it.
  // Returning here rather than starting an engine keeps the button out of a
  // "playing" state that produces silence.
  if (!list.some((s) => s.audioSrc || voiceFor(s.lang))) return;

  // iOS wants the first speak() inside the gesture, and later segments start
  // from an `end` handler. Priming here means the handoff is never the first
  // call the engine has seen.
  if (hasSpeech() && list.some((s) => !s.audioSrc)) window.speechSynthesis.cancel();

  const mine = ++token;
  const engine = playlist(list, () => {
    if (mine !== token) return;
    current = null;
    narration.set({ owner, state: 'ended' });
  });

  current = { owner, engine };
  engine.play();
  narration.set({ owner, state: 'playing' });
}

export function pause() {
  if (!current) return;
  current.engine.pause();
  narration.set({ owner: current.owner, state: 'paused' });
}

export function resume() {
  if (!current) return;
  current.engine.resume();
  narration.set({ owner: current.owner, state: 'playing' });
}

export function cancel() {
  token += 1;
  if (current) current.engine.stop();
  else if (hasSpeech()) window.speechSynthesis.cancel();
  current = null;
  narration.set({ owner: null, state: 'idle' });
}

/**
 * Can this narration actually be played, and if not, why not.
 *
 * Returns one of:
 *   { state: 'ready' }         something will be heard
 *   { state: 'loading' }       the device has not finished listing its voices
 *   { state: 'unavailable', missing }  nothing will be heard, and what is absent
 *
 * THE PRIORITY IS RECORDING, THEN A REAL VOICE, THEN NOTHING.
 *
 * A recorded file makes a screen available whatever the device has installed —
 * that is the whole point of shipping audio, and a phone with no Burmese voice
 * is exactly the phone the recordings are for.
 *
 * Judged against the LEARNER'S language, not against every language in the
 * narration. A Burmese screen also carries the official question in English
 * (G-3): if Burmese cannot be spoken, reading only that question aloud would be
 * a button that appears to work and delivers one sentence out of eight.
 */
export function narrationAvailability(
  { segments, text, audioSrc, screenId, lang = 'en' },
  voiceState = null
) {
  const list = segments && segments.length ? segments : text ? [{ text, lang }] : [];
  if (!list.length) return { state: 'unavailable', missing: [] };

  // 1. Recordings.
  const resolved = audioSrc
    ? [{ ...list[0], audioSrc }, ...list.slice(1)]
    : resolve(list, { screenId, lang });
  const spoken = resolved.filter((s) => !s.audioSrc);
  if (!spoken.length) return { state: 'ready' };

  // 2. A voice that can actually say it.
  if (!hasSpeech()) return { state: 'unavailable', missing: [lang] };

  const { ready, list: installed } = voiceState ?? get(voices);
  if (!ready) return { state: 'loading' };

  const needed = [...new Set(spoken.map((s) => s.lang || lang))];
  const missing = needed.filter((l) => !voiceFor(l, installed));
  if (!missing.length) return { state: 'ready' };

  // The learner's own language is the content; anything else in the narration
  // is incidental and can be skipped silently.
  if (missing.includes(lang)) return { state: 'unavailable', missing };
  return { state: 'ready' };
}

/** Boolean form, for callers that only need to know whether to render. */
export function canNarrate(opts, voiceState = null) {
  return narrationAvailability(opts, voiceState).state === 'ready';
}

// --- Cleanup ----------------------------------------------------------------
//
// Next and Back are covered by the button living inside Lesson's {#key screen.id}
// block: a screen change destroys it and its onDestroy cancels. Exit and every
// other navigation lands here.

if (typeof window !== 'undefined') {
  let first = true;
  route.subscribe(() => {
    // A store fires immediately on subscribe; that first call is module load,
    // not a navigation.
    if (first) {
      first = false;
      return;
    }
    cancel();
  });

  // Chrome keeps talking across a real document change, so leaving the app
  // entirely would otherwise carry the narration with it.
  window.addEventListener('pagehide', cancel);
}
