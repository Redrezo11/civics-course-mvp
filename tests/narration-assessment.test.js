/**
 * Narration on assessment screens.
 *
 * The load-bearing test here is the one nobody would think to write: that the
 * options are spoken in the order they are DISPLAYED. Everything else about
 * this feature fails loudly. That one fails silently, and only for the learner
 * who cannot see the screen — the exact person it was built for.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';

import NarrationButton from '../src/lib/components/NarrationButton.svelte';
import Rehearsal from '../src/lib/screens/Rehearsal.svelte';
import { cancel, questionAudioFor } from '../src/lib/narration.js';
import { presentOptions } from '../src/lib/content/questions.js';
import manifest from '../src/lib/content/audio-manifest.json';
import unit1 from '../src/lib/content/unit1.json';
import {
  flatten,
  narrationFor,
  narrationHash,
  practiceSegments,
  rehearsalSegments,
  guidedItemSegments,
} from '../src/lib/narration-text.js';

const speech = () => window.speechSynthesis;
const isBurmese = (s) => /[က-႟]/.test(s);
const label = (c) => c.querySelector('button')?.textContent.trim();

const allQuestions = Object.values(
  import.meta.glob('../src/lib/content/questions-u*.json', { eager: true, import: 'default' })
).flat();

beforeEach(() => cancel());
afterEach(() => cancel());

describe('multiple choice — every option read, none given away', () => {
  const REVEALING = /correct answer|✓|✗|accepted answers are marked/i;

  it('reads every option, for all 128 questions, with nothing marking the right one', () => {
    let checked = 0;
    for (const q of allQuestions) {
      if (q.dynamic || !q.options) continue;
      checked += 1;
      const presented = presentOptions(q);
      const spoken = flatten(
        practiceSegments({
          label: 'Practice — the official test question',
          official: q.official,
          questionId: q.id,
          presented,
          multiSelectCount: q.multiSelect || 0,
          answered: false,
        })
      );
      for (const opt of presented.options) {
        expect(spoken, `${q.id} omits an option`).toContain(opt);
      }
      expect(spoken, `${q.id} leaks which option is correct`).not.toMatch(REVEALING);
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('speaks options in the DISPLAYED order, not the authored order', () => {
    const shuffled = allQuestions.filter(
      (q) => q.options && presentOptions(q).options.join('|') !== q.options.join('|')
    );
    expect(shuffled.length, 'expected some questions to be shuffled').toBeGreaterThan(10);

    for (const q of shuffled) {
      const presented = presentOptions(q);
      const spoken = flatten(practiceSegments({ official: q.official, presented }));
      const positions = presented.options.map((o) => spoken.indexOf(o));
      expect([...positions].sort((a, b) => a - b), `${q.id} spoken out of order`).toEqual(positions);
    }
  });

  it('states the required count for a multi-select without saying which are accepted', () => {
    const multi = allQuestions.find((q) => q.multiSelect);
    const spoken = flatten(
      practiceSegments({
        official: multi.official,
        presented: presentOptions(multi),
        multiSelectCount: multi.multiSelect,
      })
    );
    expect(spoken).toContain(`Choose ${multi.multiSelect}`);
    expect(spoken).not.toMatch(REVEALING);
  });

  it('adds the answer and the explanation only after answering', () => {
    const q = allQuestions.find((x) => x.options && !x.dynamic);
    const after = flatten(
      practiceSegments({
        official: q.official,
        presented: presentOptions(q),
        answered: true,
        correctAnswerText: q.acceptedAnswers[0],
        explain: 'Because it is the rulebook.',
      })
    );
    expect(after).toContain('The correct answer is');
    expect(after).toContain(q.acceptedAnswers[0]);
    expect(after).toContain('Because it is the rulebook.');
  });

  it('never presents an unverified dynamic answer as fact', () => {
    const spoken = flatten(
      practiceSegments({ official: 'Who is the President?', currentAnswer: { verified: false } })
    );
    expect(spoken).toContain('has not been checked yet');
  });

  it('reads a guided item without exposing its correctIndex', () => {
    const gp = unit1.screens.find((s) => s.type === 'guidedPractice');
    for (const item of gp.items) {
      const spoken = flatten(guidedItemSegments(item));
      if (item.options) for (const o of item.options) expect(spoken).toContain(o);
      if (item.sortItems) for (const si of item.sortItems) expect(spoken).toContain(si.text);
      expect(spoken).not.toMatch(/✓|✗|correct answer/i);
    }
  });
});

describe('Rehearsal narration', () => {
  const q = {
    id: 'Q1',
    official: 'What is the supreme law of the land?',
    acceptedAnswers: ['the Constitution'],
  };

  it('says NOTHING about the answer before the reveal', () => {
    const spoken = flatten(
      rehearsalSegments({ official: q.official, questionId: q.id, revealed: false, accepted: q.acceptedAnswers })
    );
    expect(spoken).toContain(q.official);
    expect(spoken).not.toContain('the Constitution');
    expect(spoken).not.toMatch(/accepted/i);
  });

  it('reads the accepted answers once revealed', () => {
    const spoken = flatten(
      rehearsalSegments({ official: q.official, questionId: q.id, revealed: true, accepted: q.acceptedAnswers })
    );
    expect(spoken).toContain('the Constitution');
  });

  it('offers a Listen control on the question screen', async () => {
    const { container } = render(Rehearsal, {});
    const start = [...container.querySelectorAll('button')].find((b) => /Start|Begin/i.test(b.textContent));
    if (start) await fireEvent.click(start);
    const labels = [...container.querySelectorAll('button')].map((b) => b.textContent.trim());
    expect(labels).toContain('Listen');
  });
});

describe('bilingual segments', () => {
  it('keeps the official question in English inside Burmese narration', () => {
    // The whole reason narration is segmented. One utterance carries one lang:
    // my-MM mangles the English question, en-US mangles the Burmese prose.
    const segs = practiceSegments({
      label: 'လေ့ကျင့်ခန်း',
      official: 'What is the supreme law of the land?',
      questionId: 'Q1',
      presented: { options: ['the Constitution', 'the flag'], correctIndex: 0 },
      lang: 'my',
    });
    const official = segs.find((s) => s.text.includes('supreme law'));
    const prose = segs.find((s) => isBurmese(s.text));

    expect(official.lang, 'the officer asks in English').toBe('en');
    expect(prose.lang, 'the teaching prose is Burmese').toBe('my');
    expect(official.questionId, 'so one recording serves every screen').toBe('Q1');
  });

  it('tags an orient screen the same way', () => {
    const orient = unit1.screens.find((s) => s.type === 'orient');
    const segs = narrationFor(orient, {
      officialQuestion: 'What is the supreme law of the land?',
      lang: 'my',
    });
    expect(segs.find((s) => s.text.includes('supreme law')).lang).toBe('en');
  });
});

describe('the playlist', () => {
  const TWO = [
    { text: 'First segment.', lang: 'en' },
    { text: 'Second segment.', lang: 'en' },
  ];

  it('plays each segment in turn and only then reports the end', async () => {
    const { container } = render(NarrationButton, { props: { segments: TWO } });
    await fireEvent.click(container.querySelector('button'));
    expect(speech().spoken[0].text).toBe('First segment.');

    speech().finishCurrent();
    await tick();
    expect(speech().spoken[1].text).toBe('Second segment.');
    expect(label(container), 'ended before the last segment').toBe('Pause');

    speech().finishCurrent();
    await tick();
    expect(label(container)).toBe('Listen again');
  });

  it('uses ONE audio element for every recorded segment', async () => {
    // iOS grants autoplay permission per element, so a second element created
    // for segment two would never have received a gesture and would silently
    // fail — on iPhone only. jsdom has no autoplay policy; nothing else here
    // would catch it.
    manifest.q.Q1 = { hash: narrationHash('What is the supreme law of the land?') };
    manifest.q.Q2 = { hash: narrationHash('What does the Constitution do?') };
    const before = window.Audio.constructed;

    const { container } = render(NarrationButton, {
      props: {
        segments: [
          { text: 'What is the supreme law of the land?', lang: 'en', questionId: 'Q1' },
          { text: 'What does the Constitution do?', lang: 'en', questionId: 'Q2' },
        ],
      },
    });
    await fireEvent.click(container.querySelector('button'));
    window.Audio.last.finish();
    await tick();

    expect(window.Audio.last.src).toMatch(/Q2\.mp3$/);
    expect(window.Audio.constructed - before, 'a second element was created').toBeLessThanOrEqual(1);

    delete manifest.q.Q1;
    delete manifest.q.Q2;
  });

  it('resolves one question recording for every screen that asks it', () => {
    manifest.q.Q2 = { hash: narrationHash('What does the Constitution do?') };
    // No language folder — the officer asks in English whatever the learner reads.
    expect(questionAudioFor('Q2', 'What does the Constitution do?')).toMatch(/audio\/q\/Q2\.mp3$/);
    expect(questionAudioFor('Q2', 'different wording now')).toBeNull();
    delete manifest.q.Q2;
  });
});

describe('narration follows the screen as it changes', () => {
  it('resets when the content changes, rather than reading the old state', async () => {
    const { container, rerender } = render(NarrationButton, {
      props: { segments: [{ text: 'Before the answer.', lang: 'en' }] },
    });
    await fireEvent.click(container.querySelector('button'));
    expect(label(container)).toBe('Pause');

    // What an answer submission does: the visible content changes underneath.
    await rerender({ segments: [{ text: 'After the answer, with feedback.', lang: 'en' }] });
    await tick();
    expect(label(container), 'kept reading the previous state').toBe('Listen');
  });
});

describe('the control announces itself once', () => {
  it('never puts the play state in a live region — the name already changes', async () => {
    // A focused button announces its own name change. A live region repeating
    // it says everything twice, which is worst on assessment screens where an
    // answer changes the feedback and resets this button at the same moment.
    //
    // There IS now a status region, for the one thing a name change cannot say:
    // that the device has not finished listing its voices. It must stay empty
    // through ordinary playback, which is what this asserts — a stricter rule
    // than "no live region exists", and the one that actually matters.
    const { container } = render(NarrationButton, { props: { text: 'Some narration.' } });
    const live = () => container.querySelector('[aria-live]');

    expect(live()?.textContent ?? '').toBe('');
    expect(container.querySelector('button').getAttribute('aria-pressed')).toBeNull();

    await fireEvent.click(container.querySelector('button')); // play
    expect(label(container)).toBe('Pause');
    expect(live()?.textContent ?? '', 'the play state was announced twice').toBe('');

    await fireEvent.click(container.querySelector('button')); // pause
    expect(label(container)).toBe('Resume');
    expect(live()?.textContent ?? '', 'the pause state was announced twice').toBe('');
  });

  it('keeps the live region polite, never assertive', () => {
    // Assertive interrupts whatever the learner is being read. Nothing this
    // control has to say is worth cutting off a lesson.
    const { container } = render(NarrationButton, { props: { text: 'Some narration.' } });
    const live = container.querySelector('[aria-live]');
    if (live) expect(live.getAttribute('aria-live')).toBe('polite');
  });
});
