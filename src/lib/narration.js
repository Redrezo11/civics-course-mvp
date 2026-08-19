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
import { narrationHash, splitForSpeech } from './narration-text.js';

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

// --- Engines ----------------------------------------------------------------

/**
 * Speech synthesis, chunked by sentence.
 *
 * Chunking is not an optimisation. It is the only way to get past two defects
 * at once: desktop Chrome truncating any utterance longer than about fifteen
 * seconds, and Chrome for Android having no working pause() at all. Owning the
 * position means Pause can be implemented as cancel-and-remember, which works
 * everywhere, instead of a pause() that silently does nothing on the phone this
 * course is mostly read on.
 */
function speechEngine(text, lang, onEnd) {
  const chunks = splitForSpeech(text);
  let index = 0;
  let live = null; // GC guard — see below

  // Engine-local, and deliberately NOT the module's session token. Pausing has
  // to invalidate the in-flight chunk callback without invalidating the
  // session's onEnd, or the narration could never report that it finished and
  // the button would never reach "Listen again".
  let gen = 0;

  const speakFrom = (from) => {
    index = from;
    if (index >= chunks.length) {
      live = null;
      onEnd();
      return;
    }

    const mine = ++gen;
    const utterance = new SpeechSynthesisUtterance(chunks[index]);
    // Android will not pick the right language without this, and reports its
    // own voice languages with an underscore ("en_US") if they are ever read.
    utterance.lang = lang === 'my' ? 'my-MM' : 'en-US';

    const advance = () => {
      // cancel() fires `end` on some browsers and not others. Without this
      // check, pausing would immediately start the next sentence — the pause
      // would look like a skip.
      if (mine !== gen) return;
      speakFrom(index + 1);
    };
    utterance.onend = advance;
    utterance.onerror = advance;

    // Chrome can garbage-collect an utterance mid-speech, after which `end`
    // never fires and the button stays on "Pause" for good. Holding the
    // reference for the utterance's lifetime is the documented fix.
    live = utterance;
    window.speechSynthesis.speak(utterance);
  };

  return {
    play() {
      // Also the documented prophylactic for the first speak() after a page
      // load failing silently.
      window.speechSynthesis.cancel();
      speakFrom(0);
    },
    pause() {
      gen += 1; // invalidate the in-flight `end` so it cannot advance
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

/** Recorded audio. None of the speech defects apply; this one just works. */
function audioEngine(src, onEnd) {
  const el = new Audio(src);
  el.preload = 'none'; // fetched on tap, never ahead of it — prepaid data
  let pending = null;
  let stopped = false;

  el.onended = () => {
    if (!stopped) onEnd();
  };

  const start = () => {
    // play() rejects with NotAllowedError without a user gesture, and with
    // AbortError if a pause() lands while it is still pending. Both are
    // expected here, neither should reach the console as an unhandled rejection.
    pending = el.play();
    if (pending?.catch) pending.catch(() => {});
  };

  const settle = async () => {
    try {
      await pending;
    } catch {
      /* already handled above */
    }
  };

  return {
    play() {
      el.currentTime = 0;
      start();
    },
    async pause() {
      await settle(); // pausing a pending play() is what triggers AbortError
      el.pause();
    },
    resume: start,
    async stop() {
      stopped = true;
      await settle();
      el.pause();
      el.currentTime = 0;
    },
  };
}

// --- Public interface -------------------------------------------------------

/**
 * Start narrating. Cancels whatever was playing first, which is what makes
 * "two narrations never overlap" structural rather than a rule to remember.
 *
 * Resolution is SYNCHRONOUS on purpose. This runs inside a click handler, and
 * awaiting anything before speak()/play() loses the user activation that iOS
 * and Chrome both require.
 */
export function play({ owner, screenId, text, audioSrc, lang = 'en' }) {
  cancel();

  const src = audioSrc || audioSourceFor(screenId, lang, text);
  if (!src && !(text && hasSpeech())) return;

  const mine = ++token;
  const onEnd = () => {
    if (mine !== token) return;
    current = null;
    narration.set({ owner, state: 'ended' });
  };

  const engine = src ? audioEngine(src, onEnd) : speechEngine(text, lang, onEnd);
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

/** Whether a source exists at all — the button does not render without one. */
export function canNarrate({ text, audioSrc, screenId, lang = 'en' }) {
  if (audioSrc) return true;
  if (audioSourceFor(screenId, lang, text)) return true;
  return Boolean(text) && hasSpeech();
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
