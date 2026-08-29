/**
 * Does this device actually have a voice for this language?
 *
 * The defect: availability checked only that `window.speechSynthesis` existed,
 * then set `utterance.lang = 'my-MM'` and trusted the engine. A phone with the
 * Web Speech API and no Burmese voice does not refuse — it hands Myanmar script
 * to an English voice, which produces sounds that are not words. The learner is
 * offered a button that reads the page aloud and gets noise, which is worse
 * than no button, because it looks like it worked.
 *
 * These cover what is INSTALLED, when the device says so, and what happens when
 * the answer is no.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { tick } from 'svelte';

import NarrationButton from '../src/lib/components/NarrationButton.svelte';
import {
  narrationAvailability,
  canNarrate,
  voiceFor,
  voices,
  __refreshVoices,
  play,
  cancel,
} from '../src/lib/narration.js';
import manifest from '../src/lib/content/audio-manifest.json';
import { narrationHash } from '../src/lib/narration-text.js';

const EN = { name: 'English (US)', lang: 'en-US', default: true };
const MY = { name: 'Burmese', lang: 'my-MM' };

const BURMESE = 'ဤသင်ခန်းစာသည် အမေရိကန် နိုင်ငံသားခံယူခြင်း စာမေးပွဲအတွက် ဖြစ်သည်။';
const SEGMENTS_MY = [{ text: BURMESE, lang: 'my', screenPart: true }];

/** Install a voice list and tell the app the device has answered. */
function installVoices(list, { ready = true } = {}) {
  window.speechSynthesis.voices = list;
  if (ready) window.speechSynthesis.emitVoicesChanged();
  else __refreshVoices(false);
}

/** Put a recording in the manifest for one screen, and take it out after. */
function withRecording(screenId, lang, text, run) {
  const before = manifest[lang][screenId];
  manifest[lang][screenId] = { hash: narrationHash(text) };
  try {
    return run();
  } finally {
    if (before === undefined) delete manifest[lang][screenId];
    else manifest[lang][screenId] = before;
  }
}

const labelOf = (c) => c.querySelector('button, [role="button"]')?.textContent.trim() || '';

beforeEach(() => {
  cancel();
  window.speechSynthesis.reset();
  // NOT `listeners = {}` — narration.js registers its voiceschanged handler once
  // at module load, and clearing the map deafens the thing under test.
  installVoices([EN, MY]);
});

afterEach(() => {
  installVoices([EN, MY]);
});

// --- A ----------------------------------------------------------------------

describe('A. a Burmese recording exists and the device has no Burmese voice', () => {
  it('is still available, because the recording is what the recording is for', () => {
    installVoices([EN]);

    withRecording('U9-S01', 'my', BURMESE, () => {
      const a = narrationAvailability({
        segments: SEGMENTS_MY,
        screenId: 'U9-S01',
        lang: 'my',
      });
      expect(a.state).toBe('ready');
    });
  });

  it('and the button renders as normal', () => {
    installVoices([EN]);

    withRecording('U9-S01', 'my', BURMESE, () => {
      const { container } = render(NarrationButton, {
        props: { segments: SEGMENTS_MY, screenId: 'U9-S01', lang: 'my' },
      });
      expect(container.querySelector('button')).toBeTruthy();
      expect(labelOf(container)).toBe('Listen');
    });
  });
});

// --- B ----------------------------------------------------------------------

describe('B. no recording, and a my-MM voice is installed', () => {
  it('is available through speech', () => {
    const a = narrationAvailability({ segments: SEGMENTS_MY, lang: 'my' });
    expect(a.state).toBe('ready');
  });

  it('assigns the Burmese voice to the utterance, not just the tag', () => {
    const { container } = render(NarrationButton, {
      props: { segments: SEGMENTS_MY, lang: 'my' },
    });
    fireEvent.click(container.querySelector('button'));

    const spoken = window.speechSynthesis.spoken;
    expect(spoken.length).toBeGreaterThan(0);
    expect(spoken[0].lang).toBe('my-MM');
    expect(spoken[0].voice, 'no voice object was attached').toBe(MY);
  });
});

// --- C ----------------------------------------------------------------------

describe('C. no recording, speech exists, but no Burmese voice', () => {
  beforeEach(() => installVoices([EN]));

  it('reports Burmese unavailable rather than falling back', () => {
    const a = narrationAvailability({ segments: SEGMENTS_MY, lang: 'my' });
    expect(a.state).toBe('unavailable');
    expect(a.missing).toContain('my');
    expect(canNarrate({ segments: SEGMENTS_MY, lang: 'my' })).toBe(false);
  });

  it('never speaks Burmese with the English voice, even if playback is forced', () => {
    // The control is not offered — but the engine is the last line, so ask it
    // directly. Silence is the correct failure; a wrong-language reading is not
    // a degraded success.
    play({ owner: {}, segments: SEGMENTS_MY, lang: 'my' });
    expect(window.speechSynthesis.spoken).toHaveLength(0);
  });

  it('says so, in a control a keyboard user can still reach', () => {
    const { container } = render(NarrationButton, {
      props: { segments: SEGMENTS_MY, lang: 'my' },
    });

    expect(container.querySelector('button'), 'the Listen control must be gone').toBeNull();

    const notice = container.querySelector('[role="button"]');
    expect(notice).toBeTruthy();
    expect(notice.getAttribute('aria-disabled')).toBe('true');
    // `disabled` would drop it out of the tab order, and the person who most
    // needs the explanation is the one navigating by keyboard.
    expect(notice.getAttribute('tabindex')).toBe('0');
    expect(notice.textContent).toContain('Burmese speech is not available');
  });
});

// --- D ----------------------------------------------------------------------

describe('D. getVoices() is empty at first, then voiceschanged brings my-MM', () => {
  it('does not conclude "unavailable" before the device has answered', () => {
    installVoices([], { ready: false });

    const a = narrationAvailability({ segments: SEGMENTS_MY, lang: 'my' });
    expect(a.state, 'an empty first call is not an answer').toBe('loading');
  });

  it('shows the control, inert, rather than flashing an unavailable state', async () => {
    installVoices([], { ready: false });
    const { container } = render(NarrationButton, {
      props: { segments: SEGMENTS_MY, lang: 'my' },
    });

    const btn = container.querySelector('button');
    expect(btn, 'nothing should be hidden while we are still waiting').toBeTruthy();
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    expect(labelOf(container)).toBe('Listen');

    await fireEvent.click(btn);
    expect(window.speechSynthesis.spoken, 'must not start before voices exist').toHaveLength(0);
    expect(container.querySelector('[role="status"]').textContent).toContain('Preparing');
  });

  it('becomes available once voiceschanged fires', async () => {
    installVoices([], { ready: false });
    const { container } = render(NarrationButton, {
      props: { segments: SEGMENTS_MY, lang: 'my' },
    });
    expect(container.querySelector('button').getAttribute('aria-disabled')).toBe('true');

    installVoices([EN, MY]); // the browser finishes loading
    await tick();

    expect(get(voices).ready).toBe(true);
    expect(container.querySelector('button').getAttribute('aria-disabled')).toBeNull();

    await fireEvent.click(container.querySelector('button'));
    expect(window.speechSynthesis.spoken[0].voice).toBe(MY);
  });

  it('and reports unavailable once voiceschanged says there is no Burmese', async () => {
    installVoices([], { ready: false });
    const { container } = render(NarrationButton, {
      props: { segments: SEGMENTS_MY, lang: 'my' },
    });

    installVoices([EN]);
    await tick();

    expect(container.querySelector('button')).toBeNull();
    expect(container.textContent).toContain('Burmese speech is not available');
  });
});

// --- E ----------------------------------------------------------------------

describe('E. English still works', () => {
  const SEGMENTS_EN = [{ text: 'The Constitution is the supreme law of the land.', lang: 'en' }];

  it('is available and uses an English voice explicitly', () => {
    const { container } = render(NarrationButton, {
      props: { segments: SEGMENTS_EN, lang: 'en' },
    });
    fireEvent.click(container.querySelector('button'));

    expect(window.speechSynthesis.spoken[0].lang).toBe('en-US');
    expect(window.speechSynthesis.spoken[0].voice).toBe(EN);
  });

  it('is unavailable on a device with no English voice either', () => {
    installVoices([MY]);
    const a = narrationAvailability({ segments: SEGMENTS_EN, lang: 'en' });
    expect(a.state).toBe('unavailable');
  });

  it('skips an English quote inside a Burmese narration rather than mangling it', () => {
    // A Burmese screen carries the official question in English (G-3). On a
    // device with Burmese but no English, the Burmese must still play and the
    // quoted sentence must be silent — never read by the Burmese voice.
    installVoices([MY]);
    const mixed = [
      { text: BURMESE, lang: 'my' },
      { text: 'What is the supreme law of the land?', lang: 'en' },
    ];
    expect(narrationAvailability({ segments: mixed, lang: 'my' }).state).toBe('ready');

    const { container } = render(NarrationButton, { props: { segments: mixed, lang: 'my' } });
    fireEvent.click(container.querySelector('button'));

    const texts = window.speechSynthesis.spoken.map((u) => u.text).join(' ');
    expect(texts).toContain('ဤသင်ခန်းစာ');
    expect(texts, 'the English was read by a Burmese voice').not.toContain('supreme law');
  });
});

// --- F ----------------------------------------------------------------------

describe('F. language tags are normalised before comparing', () => {
  const variants = [
    ['my_MM', 'Android reports underscores'],
    ['my-MM', 'the tag we ask for'],
    ['my', 'no region at all'],
    ['MY-mm', 'case is not significant'],
  ];

  for (const [tag, why] of variants) {
    it(`matches "${tag}" — ${why}`, () => {
      const voice = { name: `Burmese (${tag})`, lang: tag };
      installVoices([EN, voice]);

      expect(voiceFor('my')).toBe(voice);
      expect(narrationAvailability({ segments: SEGMENTS_MY, lang: 'my' }).state).toBe('ready');
    });
  }

  it('does not match a different language that starts with the same letters', () => {
    installVoices([EN, { name: 'Malay', lang: 'ms-MY' }]);
    expect(voiceFor('my'), 'ms-MY is Malay, not Burmese').toBeNull();
  });

  it('prefers the exact region over a bare tag', () => {
    const bare = { name: 'Burmese', lang: 'my' };
    const exact = { name: 'Burmese (Myanmar)', lang: 'my-MM' };
    installVoices([EN, bare, exact]);
    expect(voiceFor('my')).toBe(exact);
  });
});
