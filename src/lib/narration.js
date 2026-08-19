// narration.js — one narration plays at a time, and it stops when it should.
//
// Two engines sit behind one interface. Recorded audio is the destination;
// speech synthesis is what runs until the recordings exist. Nothing above this
// module knows which one is playing, so adding audio is a data change.
//
// See docs/NARRATION.md for the file naming convention and the workflow, and
// for the browser defects the speech engine below is shaped around.

import { writable } from 'svelte/store';
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
    utterance.lang = lang === 'my' ? 'my-MM' : 'en-US';

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
  if (!list.some((s) => s.audioSrc) && !hasSpeech()) return;

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

/** Whether there is anything to play at all — the button does not render without one. */
export function canNarrate({ segments, text, audioSrc, screenId, lang = 'en' }) {
  if (audioSrc) return true;
  const list = segments && segments.length ? segments : text ? [{ text }] : [];
  if (!list.length) return false;
  if (list.some((s) => s.questionId && questionAudioFor(s.questionId, s.text))) return true;
  if (screenId && audioSourceFor(screenId, lang, flatten(list))) return true;
  return hasSpeech();
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
