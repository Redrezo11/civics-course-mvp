/**
 * Which screens offer narration at all.
 *
 * This file exists because Rehearsal's intro shipped without a Listen control
 * and nothing noticed. A missing control breaks no test: the screen renders,
 * the flow completes, every assertion about narration passes because they all
 * ask "does narration work" rather than "is it offered here". The only way to
 * catch it is to state where it belongs.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';

import Language from '../src/lib/screens/Language.svelte';
import Welcome from '../src/lib/screens/Welcome.svelte';
import Rehearsal from '../src/lib/screens/Rehearsal.svelte';
import FullBank from '../src/lib/screens/FullBank.svelte';
import Epitome from '../src/lib/screens/Epitome.svelte';
import Home from '../src/lib/screens/Home.svelte';
import NarrationButton from '../src/lib/components/NarrationButton.svelte';

import { progress } from '../src/lib/stores/progress.js';
import { cancel } from '../src/lib/narration.js';
import uiStrings from '../src/lib/content/ui-strings.json';
import {
  STANDALONE_NARRATION,
  RECORDABLE_STANDALONE,
  STANDALONE_IDS,
} from '../src/lib/content/standalone-narration.js';

const labels = (c) => [...c.querySelectorAll('button')].map((b) => b.textContent.trim());
const hasListen = (c) => labels(c).includes('Listen');

beforeEach(() => {
  progress.resetAll();
  cancel();
});
afterEach(() => cancel());

describe('screens that must offer narration', () => {
  it('Language — the first screen anyone sees', () => {
    expect(hasListen(render(Language, {}).container)).toBe(true);
  });

  it('Welcome', () => {
    expect(hasListen(render(Welcome, {}).container)).toBe(true);
  });

  it('Rehearsal intro — the screen that explains the rules', () => {
    // The reported bug. This screen says "at the real interview you will HEAR
    // these questions" and could not be heard.
    expect(hasListen(render(Rehearsal, {}).container)).toBe(true);
  });

  it('Rehearsal result, after a run', async () => {
    const { container } = render(Rehearsal, {});
    await fireEvent.click([...container.querySelectorAll('button')].find((b) => /Start/i.test(b.textContent)));

    // Answer until the run ends, marking everything wrong so it finishes fast.
    for (let i = 0; i < 40 && !/passed|ended/i.test(container.textContent); i += 1) {
      const check = [...container.querySelectorAll('button')].find((b) => /Check my answer/i.test(b.textContent));
      if (check) await fireEvent.click(check);
      const no = [...container.querySelectorAll('button')].find((b) => /Not yet/i.test(b.textContent));
      if (no) await fireEvent.click(no);
      await tick();
    }
    expect(container.textContent).toMatch(/passed|ended/i);
    expect(hasListen(container)).toBe(true);
  });

  it('FullBank entry', () => {
    expect(hasListen(render(FullBank, { props: { unitId: 'U4' } }).container)).toBe(true);
  });

  it('Epitome', () => {
    expect(hasListen(render(Epitome, {}).container)).toBe(true);
  });
});

describe('screens that deliberately do not', () => {
  it('Home, the lesson-selection dashboard', () => {
    expect(hasListen(render(Home, {}).container)).toBe(false);
  });
});

describe('the standalone registry', () => {
  it('is the single source the scripts and the app all read', () => {
    // Two lists used to be maintained separately — the app's and the audio
    // script's — plus a third of valid ids in the QA gate. They drifted, and a
    // recording named for a screen the map did not know about passed the gate
    // and then silently never played.
    expect(STANDALONE_IDS.length).toBeGreaterThan(RECORDABLE_STANDALONE.length);
    for (const [id, entry] of Object.entries(STANDALONE_NARRATION)) {
      expect(entry.label, `${id} has no label`).toBeTruthy();
      expect(typeof entry.recordable, `${id} does not declare recordable`).toBe('boolean');
      // Only recordable entries carry text — the rest are built at render from
      // live values, so there is nothing static to record.
      if (entry.recordable) {
        expect(entry.segments?.length, `${id} is recordable but has no text`).toBeGreaterThan(0);
      } else {
        expect(entry.segments, `${id} is speech-only but carries static text`).toBeUndefined();
      }
    }
  });

  it('never marks a screen recordable when its narration carries live values', () => {
    // A recorded tally is one learner's score read aloud to everybody, and the
    // freshness hash cannot catch it: the text varies per learner, not per edit.
    for (const id of ['rehearsal-end', 'fullbank-entry', 'fullbank-end', 'review-end', 'completion', 'epitome']) {
      expect(STANDALONE_NARRATION[id]?.recordable, `${id} must be speech-only`).toBe(false);
    }
  });
});

describe('the Language screen speaks both languages', () => {
  const segments = STANDALONE_NARRATION.language.segments;

  it('carries English and Burmese segments, each tagged', () => {
    // Nobody has chosen a language yet, so there is no current language to fall
    // back to — and on this screen English may be exactly the problem.
    expect(segments.some((s) => s.lang === 'en')).toBe(true);
    expect(segments.some((s) => s.lang === 'my')).toBe(true);
    for (const s of segments.filter((x) => x.lang === 'my')) {
      expect(/[က-႟]/.test(s.text), 'a my segment is not Burmese').toBe(true);
    }
  });

  it('uses the same wording as the screen itself', () => {
    // The registry holds literals so Node scripts can read it without JSON
    // import attributes. This is what stops those literals drifting from the
    // strings the screen actually renders.
    const texts = segments.map((s) => s.text);
    expect(texts).toContain(uiStrings['language.heading'].en);
    expect(texts).toContain(uiStrings['language.heading'].my);
    expect(texts).toContain(uiStrings['language.changeLater'].en);
    expect(texts).toContain(uiStrings['language.changeLater'].my);
  });

  it('plays through both without stopping at the language change', async () => {
    const { container } = render(NarrationButton, { props: { segments } });
    await fireEvent.click(container.querySelector('button'));

    const spoken = [];
    for (let i = 0; i < 20; i += 1) {
      const last = window.speechSynthesis.spoken[window.speechSynthesis.spoken.length - 1];
      if (last) spoken.push(last.lang);
      const before = window.speechSynthesis.spoken.length;
      window.speechSynthesis.finishCurrent();
      await tick();
      if (window.speechSynthesis.spoken.length === before) break;
    }
    expect(spoken).toContain('en-US');
    expect(spoken).toContain('my-MM');
  });
});

describe('Welcome still says what it narrates', () => {
  it('the registry text matches the rendered copy', () => {
    const { container } = render(Welcome, {});
    const rendered = container.textContent.replace(/\s+/g, ' ');
    // Sentence by sentence, so a rewrite of the markup that leaves the
    // narration behind fails here rather than in front of a learner.
    for (const sentence of STANDALONE_NARRATION.welcome.segments[0].text.split('. ')) {
      const s = sentence.replace(/\.$/, '').trim();
      if (s.length > 12) expect(rendered).toContain(s);
    }
  });
});
