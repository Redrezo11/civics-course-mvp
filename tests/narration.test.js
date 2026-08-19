/**
 * Narration.
 *
 * Most of these exist because of a specific browser defect rather than a
 * specific line of code — desktop Chrome truncating long utterances, Android
 * having no working pause(), engines firing `end` when you cancel them. Those
 * failures appear on a phone, weeks later, as "the Listen button is stuck" or
 * "it skips a sentence". The fakes in tests/setup.js exist to make them
 * reproducible here instead.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import { get } from 'svelte/store';

import NarrationButton from '../src/lib/components/NarrationButton.svelte';
import Lesson from '../src/lib/screens/Lesson.svelte';
import Home from '../src/lib/screens/Home.svelte';
import Welcome from '../src/lib/screens/Welcome.svelte';
import { narration, cancel, audioSourceFor } from '../src/lib/narration.js';
import { route } from '../src/lib/router.js';
import manifest from '../src/lib/content/audio-manifest.json';
import {
  narrationFor,
  narrationHash,
  splitForSpeech,
  SPEECH_CHUNK_MAX,
  NARRATED_FIELDS,
  NOT_NARRATED,
} from '../src/lib/narration-text.js';

import unit0 from '../src/lib/content/unit0.json';
import unit1 from '../src/lib/content/unit1.json';
import unit2 from '../src/lib/content/unit2.json';
import unit3 from '../src/lib/content/unit3.json';
import unit4 from '../src/lib/content/unit4.json';
import unit5 from '../src/lib/content/unit5.json';
import unit6 from '../src/lib/content/unit6.json';
import unit7 from '../src/lib/content/unit7.json';

const UNITS = [unit0, unit1, unit2, unit3, unit4, unit5, unit6, unit7];
const speech = () => window.speechSynthesis;

const SHORT = 'One short line.';
const LONG = Array.from({ length: 12 }, (_, i) => `This is sentence number ${i + 1} of the narration.`).join(' ');

const label = (c) => c.querySelector('button')?.textContent.trim();

/** Fire `end` until the engine stops queueing new utterances. */
async function playOut() {
  for (let guard = 0; guard < 200; guard += 1) {
    const before = speech().spoken.length;
    speech().finishCurrent();
    await tick();
    if (speech().spoken.length === before) return;
  }
  throw new Error('narration never finished');
}

beforeEach(() => cancel());
afterEach(() => cancel());

describe('splitting text for speech', () => {
  it('keeps a short line as one chunk', () => {
    expect(splitForSpeech(SHORT)).toEqual([SHORT]);
  });

  it('splits long text so no chunk can hit the ~15 second truncation', () => {
    // Desktop Chrome silently cuts a single utterance off around 200-250
    // characters. Every bigIdea screen in this course is longer than that.
    const chunks = splitForSpeech(LONG);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(SPEECH_CHUNK_MAX);
    expect(chunks.join(' ')).toBe(LONG);
  });

  it('splits BURMESE on ၊ and ။, which are its sentence marks', () => {
    // A splitter that knew only .?! would return one enormous chunk for every
    // Burmese screen — back into the truncation bug, in the language whose
    // support is already worst. Burmese also has no spaces between words, so
    // there is nothing else to break on.
    const my = 'ဤသင်တန်းသည် အလွန်ကောင်းပါသည်။ '.repeat(14);
    const chunks = splitForSpeech(my);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(SPEECH_CHUNK_MAX);
  });

  it('breaks a single unbroken run rather than emitting an oversized chunk', () => {
    const chunks = splitForSpeech('က'.repeat(SPEECH_CHUNK_MAX * 3));
    expect(chunks.length).toBeGreaterThan(2);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(SPEECH_CHUNK_MAX);
  });

  it('returns nothing for empty text, rather than one empty chunk', () => {
    expect(splitForSpeech('')).toEqual([]);
    expect(splitForSpeech(null)).toEqual([]);
  });
});

describe('the four button states', () => {
  it('walks Listen → Pause → Resume → Listen again', async () => {
    const { container } = render(NarrationButton, { props: { text: LONG, screenId: 'T-1' } });
    expect(label(container)).toBe('Listen');

    await fireEvent.click(container.querySelector('button'));
    expect(label(container)).toBe('Pause');
    expect(speech().spoken.length).toBe(1);

    await fireEvent.click(container.querySelector('button'));
    expect(label(container)).toBe('Resume');

    await fireEvent.click(container.querySelector('button'));
    expect(label(container)).toBe('Pause');

    await playOut();
    expect(label(container)).toBe('Listen again');
  });

  it('restarts from the beginning after it has finished', async () => {
    const { container } = render(NarrationButton, { props: { text: SHORT, screenId: 'T-1' } });
    await fireEvent.click(container.querySelector('button'));
    await playOut();
    expect(label(container)).toBe('Listen again');

    const spokenBefore = speech().spoken.length;
    await fireEvent.click(container.querySelector('button'));
    expect(label(container)).toBe('Pause');
    expect(speech().spoken.length).toBe(spokenBefore + 1);
  });

  it('does not render at all when there is nothing to narrate', () => {
    const { container } = render(NarrationButton, { props: { text: '', screenId: 'T-1' } });
    expect(container.querySelector('button')).toBeNull();
  });

  it('never starts on its own', async () => {
    render(NarrationButton, { props: { text: SHORT, screenId: 'T-1' } });
    await tick();
    expect(speech().spoken.length).toBe(0);
    expect(get(narration).state).toBe('idle');
  });
});

describe('pausing', () => {
  it('does NOT advance to the next sentence when the engine fires end on cancel', async () => {
    // Several browsers fire `end` from cancel(). Without the generation guard
    // the pause would immediately start the next chunk, so pausing would read
    // as skipping — and the button would say "Resume" while still talking.
    const { container } = render(NarrationButton, { props: { text: LONG, screenId: 'T-1' } });
    await fireEvent.click(container.querySelector('button'));
    const afterStart = speech().spoken.length;

    await fireEvent.click(container.querySelector('button')); // pause
    expect(label(container)).toBe('Resume');
    expect(speech().spoken.length).toBe(afterStart);
  });

  it('resumes from the chunk it stopped on, not from the start', async () => {
    const { container } = render(NarrationButton, { props: { text: LONG, screenId: 'T-1' } });
    const chunks = splitForSpeech(LONG);
    await fireEvent.click(container.querySelector('button'));

    speech().finishCurrent(); // advance to chunk 2
    await tick();
    expect(speech().spoken[speech().spoken.length - 1].text).toBe(chunks[1]);

    await fireEvent.click(container.querySelector('button')); // pause
    await fireEvent.click(container.querySelector('button')); // resume
    expect(speech().spoken[speech().spoken.length - 1].text).toBe(chunks[1]);
  });

  it('reaches the end after a pause, rather than stalling on "Pause" forever', async () => {
    const { container } = render(NarrationButton, { props: { text: LONG, screenId: 'T-1' } });
    await fireEvent.click(container.querySelector('button'));
    await fireEvent.click(container.querySelector('button')); // pause
    await fireEvent.click(container.querySelector('button')); // resume
    await playOut();
    expect(label(container)).toBe('Listen again');
  });
});

describe('keyboard activation', () => {
  it('starts and pauses from the keyboard on a focused button', async () => {
    const user = userEvent.setup();
    const { container } = render(NarrationButton, { props: { text: LONG, screenId: 'T-1' } });
    const button = container.querySelector('button');

    button.focus();
    expect(document.activeElement).toBe(button);

    await user.keyboard('{Enter}');
    await tick();
    expect(label(container)).toBe('Pause');

    await user.keyboard(' ');
    await tick();
    expect(label(container)).toBe('Resume');
  });

  it('is a real button, so the keyboard works without handlers of our own', () => {
    const { container } = render(NarrationButton, { props: { text: SHORT, screenId: 'T-1' } });
    const button = container.querySelector('button');
    expect(button.tagName).toBe('BUTTON');
    // The visible text is the accessible name; nothing overrides it.
    expect(button.getAttribute('aria-label')).toBeNull();
    const svg = button.querySelector('svg');
    expect(svg.getAttribute('focusable')).toBe('false');
    expect(svg.closest('[aria-hidden="true"]')).toBeTruthy();
  });
});

describe('only one narration at a time', () => {
  it('stops the first when the second starts', async () => {
    const a = render(NarrationButton, { props: { text: LONG, screenId: 'A' } });
    const b = render(NarrationButton, { props: { text: LONG, screenId: 'B' } });

    await fireEvent.click(a.container.querySelector('button'));
    expect(label(a.container)).toBe('Pause');

    await fireEvent.click(b.container.querySelector('button'));
    await tick();

    expect(label(b.container)).toBe('Pause');
    expect(label(a.container)).toBe('Listen'); // the first went back to idle
  });

  it('actually stops the first ENGINE, not just its label', async () => {
    // The label alone proves nothing: the store's owner changes when the second
    // starts, so the first button reads "Listen" whether or not its audio is
    // still playing. Two voices talking over each other looks exactly like this
    // test passing. Assert on the engine.
    const a = render(NarrationButton, { props: { text: LONG, screenId: 'A', audioSrc: 'a.mp3' } });
    const b = render(NarrationButton, { props: { text: LONG, screenId: 'B', audioSrc: 'b.mp3' } });

    await fireEvent.click(a.container.querySelector('button'));
    expect(window.Audio.instances[0].paused).toBe(false);

    await fireEvent.click(b.container.querySelector('button'));
    await new Promise((r) => setTimeout(r, 0)); // stop() settles the play promise

    expect(window.Audio.instances[0].paused, 'the first is still playing').toBe(true);
    expect(window.Audio.instances[1].paused, 'the second never started').toBe(false);
  });

  it('stops a speaking engine before starting the next', async () => {
    const a = render(NarrationButton, { props: { text: LONG, screenId: 'A' } });
    const b = render(NarrationButton, { props: { text: LONG, screenId: 'B' } });

    await fireEvent.click(a.container.querySelector('button'));
    const cancelledBefore = speech().cancelled;

    await fireEvent.click(b.container.querySelector('button'));
    expect(speech().cancelled).toBeGreaterThan(cancelledBefore);
  });
});

describe('cleanup', () => {
  it('cancels when the component is destroyed', async () => {
    const { container, unmount } = render(NarrationButton, { props: { text: LONG, screenId: 'T-1' } });
    await fireEvent.click(container.querySelector('button'));
    expect(get(narration).state).toBe('playing');

    unmount();
    await tick();
    expect(get(narration).state).toBe('idle');
  });

  it('cancels on a route change — Exit, or anything else that navigates', async () => {
    const { container } = render(NarrationButton, { props: { text: LONG, screenId: 'T-1' } });
    await fireEvent.click(container.querySelector('button'));
    expect(get(narration).state).toBe('playing');

    route.set('/settings');
    await tick();
    expect(get(narration).state).toBe('idle');
    expect(label(container)).toBe('Listen');
  });
});

describe('recorded audio', () => {
  it('plays a file instead of speaking when one is given', async () => {
    const { container } = render(NarrationButton, {
      props: { text: LONG, screenId: 'T-1', audioSrc: 'audio/en/T-1.mp3' },
    });
    await fireEvent.click(container.querySelector('button'));

    expect(speech().spoken.length).toBe(0); // nothing was synthesised
    expect(window.Audio.instances.length).toBe(1);
    expect(window.Audio.instances[0].src).toBe('audio/en/T-1.mp3');
    expect(window.Audio.instances[0].preload).toBe('none'); // never preloaded
    expect(label(container)).toBe('Pause');
  });

  it('reports the end of the file', async () => {
    const { container } = render(NarrationButton, {
      props: { text: SHORT, screenId: 'T-1', audioSrc: 'audio/en/T-1.mp3' },
    });
    await fireEvent.click(container.querySelector('button'));
    window.Audio.instances[0].finish();
    await tick();
    expect(label(container)).toBe('Listen again');
  });

  it('survives a rejected play() without wedging', async () => {
    // play() rejects with AbortError when a pause lands while it is pending,
    // and NotAllowedError without a user gesture. Neither may become an
    // unhandled rejection or leave the button stuck.
    window.Audio.playRejects = true;
    const { container } = render(NarrationButton, {
      props: { text: SHORT, screenId: 'T-1', audioSrc: 'audio/en/T-1.mp3' },
    });
    await fireEvent.click(container.querySelector('button'));
    await fireEvent.click(container.querySelector('button')); // pause mid-flight
    await tick();
    expect(label(container)).toBe('Resume');
  });
});

describe('resolving a recording by convention', () => {
  const TEXT = 'The Constitution sets up the government.';

  afterEach(() => {
    delete manifest.en['U1-S01'];
  });

  it('finds nothing when the manifest has no entry', () => {
    expect(audioSourceFor('U1-S01', 'en', TEXT)).toBeNull();
  });

  it('resolves <lang>/<screen id>.mp3 when the entry is fresh', () => {
    manifest.en['U1-S01'] = { hash: narrationHash(TEXT) };
    expect(audioSourceFor('U1-S01', 'en', TEXT)).toMatch(/audio\/en\/U1-S01\.mp3$/);
  });

  it('IGNORES a recording whose text has since been rewritten', () => {
    // The whole point: a stale file still resolves and still plays, saying
    // something the page no longer says. Silence about that is the bug.
    manifest.en['U1-S01'] = { hash: narrationHash(TEXT) };
    expect(audioSourceFor('U1-S01', 'en', 'Completely different wording now.')).toBeNull();
  });

  it('does not treat punctuation or capitalisation as a rewrite', () => {
    manifest.en['U1-S01'] = { hash: narrationHash(TEXT) };
    expect(audioSourceFor('U1-S01', 'en', 'The Constitution sets up the government!')).not.toBeNull();
  });
});

describe('where the button appears', () => {
  it('is on a lesson screen, below the header and above the content', async () => {
    const { container } = render(Lesson, { props: { unitId: 'U1' } });
    const buttons = [...container.querySelectorAll('button')];
    const listen = buttons.find((b) => b.textContent.trim() === 'Listen');
    expect(listen, 'no Listen control on the lesson screen').toBeTruthy();

    // Below the header: Back and Exit both come before it in document order.
    const order = buttons.map((b) => b.textContent.trim());
    expect(order.indexOf('Listen')).toBeGreaterThan(order.findIndex((t) => t.includes('Back')));
    // Above the content: the heading follows it.
    const heading = container.querySelector('h1');
    expect(listen.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('is NOT on the lesson-selection dashboard', () => {
    const { container } = render(Home, {});
    const labels = [...container.querySelectorAll('button')].map((b) => b.textContent.trim());
    expect(labels).not.toContain('Listen');
  });

  it('is on Welcome, as the mockup draws it', () => {
    const { container } = render(Welcome, {});
    const labels = [...container.querySelectorAll('button')].map((b) => b.textContent.trim());
    expect(labels).toContain('Listen');
  });
});

describe('what gets narrated', () => {
  it('derives an orient screen in render order, including its question card', () => {
    const orient = unit1.screens.find((s) => s.type === 'orient');
    const text = narrationFor(orient, { officialQuestion: 'What is the supreme law of the land?' });
    expect(text).toContain(orient.heading);
    expect(text).toContain(orient.body);
    expect(text).toContain('What is the supreme law of the land?');
    expect(text.indexOf(orient.heading)).toBeLessThan(text.indexOf(orient.body));
  });

  it('prefers an authored narrationText when a screen has one', () => {
    expect(narrationFor({ type: 'info', heading: 'Shown', narrationText: 'Spoken' })).toBe('Spoken');
  });

  it('says nothing on assessment screens', () => {
    for (const type of ['practice', 'hook', 'tryOne', 'guidedPractice', 'vocab']) {
      expect(narrationFor({ type, heading: 'x', question: 'y' }), type).toBe('');
    }
  });

  it('never reads interface controls', () => {
    const text = narrationFor({
      type: 'lockItIn',
      heading: 'What you learned',
      learnedLine: 'The Constitution is the supreme law.',
      primaryLabel: 'Next',
      fullBankOffer: { label: 'Practice all 14 questions' },
    });
    expect(text).not.toContain('Next');
    expect(text).not.toContain('Practice all');
  });

  it('produces narration for every narrated screen in the course', () => {
    let count = 0;
    for (const unit of UNITS) {
      for (const screen of unit.screens) {
        if (!NARRATED_FIELDS[screen.type]) continue;
        count += 1;
        const text = narrationFor(screen, { officialQuestion: 'Q' });
        expect(text.length, `${screen.id} narrates as empty`).toBeGreaterThan(20);
      }
    }
    expect(count).toBeGreaterThan(50);
  });

  it('accounts for every field on a narrated screen — the drift guard', () => {
    // A new content field must be either narrated or explicitly not narrated.
    // Without this, adding a paragraph field to a screen type would silently
    // drop it from the audio, and nothing would ever say so.
    const unaccounted = new Set();
    for (const unit of UNITS) {
      for (const screen of unit.screens) {
        const fields = NARRATED_FIELDS[screen.type];
        if (!fields) continue;
        for (const key of Object.keys(screen)) {
          if (fields.includes(key) || NOT_NARRATED.includes(key)) continue;
          unaccounted.add(`${screen.type}.${key}`);
        }
      }
    }
    expect([...unaccounted]).toEqual([]);
  });
});
