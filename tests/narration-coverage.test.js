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
import Lesson from '../src/lib/screens/Lesson.svelte';
import PracticeItem from '../src/lib/components/PracticeItem.svelte';
import unit1 from '../src/lib/content/unit1.json';
import { presentOptions } from '../src/lib/content/questions.js';
import { practiceSegments, rehearsalSegments, guidedItemSegments } from '../src/lib/narration-text.js';
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

// ---------------------------------------------------------------------------
// Does the narration say what the screen says?
//
// Every other narration test asks whether narration WORKS. This asks whether
// what it says matches what is rendered — which is the question none of them
// asked, and why the Rehearsal prompt, the guided-practice feedback, the
// multi-select rule and the checked date were all silently missing.
// ---------------------------------------------------------------------------

/**
 * Text the learner can read, excluding what narration deliberately skips:
 * controls (buttons and links) and decorative content (aria-hidden).
 */
function readableText(container) {
  const clone = container.cloneNode(true);
  for (const el of clone.querySelectorAll('button, a, [aria-hidden="true"]')) el.remove();
  return clone.textContent || '';
}

// Letters and digits only. Whitespace cannot be trusted — `<br />` makes
// textContent run two sentences together with no space — and the screen uses
// symbols the narration has no way to speak (✓ 2 right · ✗ 1 wrong).
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Sentence by sentence: whole-block comparison fails where this passes. */
const sentences = (s) =>
  s
    .split(/(?<=[.!?])/)
    .map((x) => x.trim())
    .filter((x) => norm(x).length >= 12);

function assertCovered(container, segments, where) {
  const spoken = norm(segments.map((x) => x.text).join(' '));
  for (const sentence of sentences(readableText(container))) {
    expect(spoken, `${where} does not narrate: "${sentence.trim()}"`).toContain(norm(sentence));
  }
}

describe('narration covers what is rendered', () => {
  const q = {
    id: 'Q2',
    official: 'What is the supreme law of the land?',
    options: ['the Constitution', 'the flag', 'the President'],
    correctIndex: 0,
    acceptedAnswers: ['the Constitution'],
    unit: 'U1',
  };

  it('a practice question, before answering', () => {
    const { container } = render(PracticeItem, { props: { q } });
    assertCovered(container, practiceSegments({
      label: 'Practice — the official test question',
      official: q.official,
      questionId: q.id,
      presented: presentOptions(q),
    }), 'PracticeItem');
  });

  it('a Rehearsal question — the reported bug', () => {
    // Read the question and stop, and the learner never hears the instruction.
    const segments = rehearsalSegments({
      official: q.official,
      questionId: q.id,
      revealed: false,
      correct: 2,
      wrong: 1,
    });
    const spoken = norm(segments.map((s) => s.text).join(' '));
    expect(spoken).toContain(norm('2 right'));
    expect(spoken).toContain(norm('1 wrong'));
    expect(spoken).toContain(norm('Do you know the answer?'));
    expect(spoken).toContain(norm('Say it out loud to yourself before you look.'));
  });

  it('a Rehearsal question after the reveal', () => {
    const spoken = norm(
      rehearsalSegments({
        official: q.official,
        revealed: true,
        accepted: q.acceptedAnswers,
        correct: 2,
        wrong: 1,
      })
        .map((s) => s.text)
        .join(' ')
    );
    expect(spoken).toContain(norm('Did you get it right?'));
  });

  it('a guided-practice item, including its disclaimer', () => {
    const gp = unit1.screens.find((s) => s.type === 'guidedPractice');
    const spoken = norm(
      guidedItemSegments(gp.items[0], {
        position: `Practice 1 of ${gp.items.length} — not an official test question.`,
      })
        .map((s) => s.text)
        .join(' ')
    );
    // G-22: these are authored items, not the official 128, and the screen says so.
    expect(spoken).toContain(norm('not an official test question'));
  });

  it('a multi-select keeps the rule that is the point of the item', () => {
    const multi = { ...q, multiSelect: 2 };
    const spoken = norm(
      practiceSegments({
        official: multi.official,
        presented: presentOptions(multi),
        multiSelectCount: 2,
        answered: true,
      })
        .map((s) => s.text)
        .join(' ')
    );
    // G-19 — never encourage more answers than the officer asked for.
    expect(spoken).toContain(norm('Any 2 of them is enough'));
    expect(spoken).toContain(norm('so give 2 and stop'));
  });

  it('a dynamic answer says when it was checked', () => {
    const spoken = norm(
      practiceSegments({
        official: 'Who is the President?',
        currentAnswer: { verified: true, value: 'Someone', label: 'Current answer' },
        checked: 'Aug 2026',
      })
        .map((s) => s.text)
        .join(' ')
    );
    expect(spoken).toContain(norm('Checked: Aug 2026'));
  });
});

describe('guided-practice feedback is not spoken early', () => {
  it('does NOT read the sort answers before the item is done', () => {
    // The compare feedback names the correct bucket for every misplaced item.
    // Spoken before answering, it hands the exercise over — the same failure
    // the Rehearsal reveal gate exists to prevent.
    const gp = unit1.screens.find((s) => s.type === 'guidedPractice');
    const compare = gp.items.find((i) => i.kind === 'compare');
    const leak = ['One belongs somewhere else:', `${compare.sortItems[0].text} goes in ${compare.buckets[0]}.`];

    const before = norm(guidedItemSegments(compare, { answered: false, feedback: leak }).map((s) => s.text).join(' '));
    const after = norm(guidedItemSegments(compare, { answered: true, feedback: leak }).map((s) => s.text).join(' '));

    expect(before).not.toContain(norm('goes in'));
    expect(after).toContain(norm('goes in'));
  });
});

describe('every practice screen offers narration', () => {
  it('a lesson practice screen has a Listen control', () => {
    // 38 screens had none: Lesson rendered its own copy of PracticeItem's
    // markup, so adding narration to the component missed all of them.
    const idx = unit1.screens.findIndex((s) => s.type === 'practice');
    expect(idx, 'expected a practice screen in U1').toBeGreaterThan(-1);
    progress.saveScreenPosition('U1', unit1.screens[idx].id);
    const { container } = render(Lesson, { props: { unitId: 'U1' } });

    // Assert we ARRIVED on the practice screen before asserting about it.
    // The first version of this test checked only for a Listen control and
    // passed against a broken build, because it never left screen 1 — an
    // `orient` screen, which has a control of its own.
    expect(container.textContent, 'never reached a practice screen').toContain(
      'Practice — the official test question'
    );
    expect(labels(container)).toContain('Listen');
  });

  it('resumes on the screen the learner left, rather than restarting the unit', () => {
    // Found while fixing the above. Lesson's reactive save runs during
    // initialisation, while index is still 0, so it overwrote the stored
    // position with screen 1 before onMount could read it — and onMount then
    // restored the value it had just clobbered.
    //
    // U0-S07 promises "stop anytime, the course remembers your place". It did
    // not. Nothing caught it because every other test starts at screen 1, which
    // is precisely what the bug produced.
    progress.saveScreenPosition('U1', 'U1-S11');
    const { container } = render(Lesson, { props: { unitId: 'U1' } });
    expect(container.querySelector('span').textContent).toContain('12 of 17');
  });
});
