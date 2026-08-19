// storage.js is a module singleton over localStorage, so tests must start from
// a clean slate or one test's progress leaks into the next.
//
// jsdom in this version does not provide a usable localStorage, so supply a
// minimal one. It must behave like the real thing for the cases storage.js
// relies on: getItem returns null when absent, setItem stringifies.
import { beforeEach } from 'vitest';

function memoryStorage() {
  let data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    clear: () => data.clear(),
    key: (i) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
  };
}

if (typeof window.localStorage?.clear !== 'function') {
  Object.defineProperty(window, 'localStorage', {
    value: memoryStorage(),
    configurable: true,
    writable: true,
  });
}

// jsdom provides no Web Speech API at all, so narration needs a fake — and a
// CONTROLLABLE one, not a set of no-op spies. The bugs worth testing here are
// about what happens between utterances: whether a cancelled chunk advances to
// the next, whether resume starts from the remembered chunk. That can only be
// asserted if the test decides when each utterance ends.
class FakeUtterance {
  constructor(text) {
    this.text = text;
    this.lang = '';
    this.onend = null;
    this.onerror = null;
  }
}

function fakeSpeech() {
  return {
    spoken: [], // every utterance ever passed to speak(), in order
    cancelled: 0,
    speaking: false,
    /** Fire `end` on the most recent utterance, as a real engine would. */
    finishCurrent() {
      const last = this.spoken[this.spoken.length - 1];
      this.speaking = false;
      last?.onend?.();
    },
    /** What a browser that fires `end` on cancel() does — several do. */
    cancel() {
      this.cancelled += 1;
      const last = this.spoken[this.spoken.length - 1];
      this.speaking = false;
      last?.onend?.();
    },
    speak(u) {
      this.spoken.push(u);
      this.speaking = true;
    },
    pause() {},
    resume() {},
    getVoices: () => [],
    reset() {
      this.spoken = [];
      this.cancelled = 0;
      this.speaking = false;
    },
  };
}

window.speechSynthesis = fakeSpeech();
window.SpeechSynthesisUtterance = FakeUtterance;

// Recorded audio. `play()` returns a promise in real browsers and the code
// depends on that, so the fake must too.
class FakeAudio {
  constructor(src) {
    this.src = src;
    this.preload = '';
    this.currentTime = 0;
    this.paused = true;
    this.onended = null;
    FakeAudio.instances.push(this);
    // NOT reset between tests. narration.js keeps one long-lived element for
    // the life of the page — iOS grants autoplay permission per element — so
    // the count of elements ever constructed is the thing worth asserting on.
    FakeAudio.constructed += 1;
    FakeAudio.last = this;
  }
  play() {
    this.paused = false;
    return FakeAudio.playRejects ? Promise.reject(new DOMException('interrupted', 'AbortError')) : Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  finish() {
    this.onended?.();
  }
  static reset() {
    FakeAudio.instances = [];
    FakeAudio.playRejects = false;
    // The shared element survives; put it back to a clean state instead.
    if (FakeAudio.last) {
      FakeAudio.last.paused = true;
      FakeAudio.last.currentTime = 0;
      FakeAudio.last.onended = null;
      FakeAudio.last.src = undefined;
    }
  }
}
FakeAudio.instances = [];
FakeAudio.playRejects = false;
FakeAudio.constructed = 0;
FakeAudio.last = null;
window.Audio = FakeAudio;

beforeEach(() => {
  window.localStorage.clear();
  window.speechSynthesis.reset();
  FakeAudio.reset();
});
