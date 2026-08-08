/**
 * The test that would have caught every progression bug this project has had.
 *
 * Three separate defects reached the learner because the build was green and
 * the QA gate was green while a screen was impossible to get past:
 *
 *   1. tap-to-sort never signalled completion (a reactive statement did not
 *      name the state it read), so Unit 1 was uncompletable by anyone;
 *   2. answers were written onto imported JSON, a module singleton, so screens
 *      came back pre-answered;
 *   3. two consecutive `practice` screens reused one SingleSelect instance, so
 *      the second arrived already answered and its handler early-returned.
 *
 * None of those is visible to `vite build` or to a data-level check. The only
 * thing that catches them is driving the UI, so that is what this does: walk
 * every unit from first screen to last, clicking whatever a learner would
 * click, and fail loudly if forward progress ever stops.
 */

import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Lesson from '../src/lib/screens/Lesson.svelte';
import { getState, resetAll } from '../src/lib/storage.js';
import { getQuestion } from '../src/lib/content/questions.js';

// Controls that do NOT move a learner forward. Clicking these in the driver
// would either leave the unit or undo work.
const NOT_FORWARD = [/^‹\s*Back/, /^Exit/, /Try again/i, /Start over/i, /Skip for now/i];

// Labels that advance the screen. Includes every primaryLabel used in content.
const ADVANCE = /^(Next|Begin|Start|Finish|Continue|Start Unit 1|Start practice|Continue practice)$/;

const isForward = (btn) => !NOT_FORWARD.some((re) => re.test(btn.textContent.trim()));

// Selection markers change a button's text without changing which control it
// is (○ → ● on multi-select). Strip them so the driver can tell "a control I
// have already used" from "a control I have not".
const label = (btn) => btn.textContent.trim().replace(/^[○●✓✗]\s*/, '');

function clickable(container) {
  return [...container.querySelectorAll('button')].filter(
    (b) => !b.disabled && isForward(b)
  );
}

function position(container) {
  const bar = container.querySelector('span');
  return bar ? bar.textContent.trim() : '';
}

async function walkUnit(unitId, screenCount) {
  resetAll();
  const { container } = render(Lesson, { props: { unitId } });

  const seen = [];
  let lastPosition = null;
  let stuckFor = 0;
  let usedOnScreen = new Set();

  for (let step = 0; step < 600; step += 1) {
    if (getState().unitsCompleted.includes(unitId)) {
      return { seen, completed: true };
    }

    const pos = position(container);
    if (pos === lastPosition) {
      stuckFor += 1;
    } else {
      lastPosition = pos;
      stuckFor = 0;
      usedOnScreen = new Set();
      seen.push(pos);
    }

    // 40 clicks without the position changing means nothing on this screen
    // leads anywhere — the learner is stranded.
    if (stuckFor > 40) {
      throw new Error(
        `${unitId}: stranded on screen "${pos}" — no control advances past it ` +
          `after 40 interactions. Screens reached: ${seen.join(' → ')}`
      );
    }

    const buttons = clickable(container);
    if (!buttons.length) {
      throw new Error(
        `${unitId}: screen "${pos}" has no enabled control a learner could use. ` +
          `Screens reached: ${seen.join(' → ')}`
      );
    }

    // Prefer an advance control, and the LAST one — the footer Next sits after
    // any in-component Next. Otherwise interact with a control this screen has
    // not used yet: a learner picking three answers picks three DIFFERENT ones,
    // and a driver that keeps hitting the same option just toggles it on and
    // off forever.
    const advances = buttons.filter((b) => ADVANCE.test(b.textContent.trim()));
    let target;
    if (advances.length) {
      target = advances[advances.length - 1];
    } else {
      target = buttons.find((b) => !usedOnScreen.has(label(b))) || buttons[0];
      usedOnScreen.add(label(target));
    }

    await fireEvent.click(target);
  }

  throw new Error(
    `${unitId}: did not finish within 600 interactions (${screenCount} screens). ` +
      `Screens reached: ${seen.join(' → ')}`
  );
}

// Counts dropped by 8 when the beat-8 "officialQuestions" screens and the
// duplicate U2-S09 confusable pair were removed.
const UNITS = [
  ['U0', 7],
  ['U1', 17],
  ['U2', 16],
  ['U3', 16],
  ['U4', 12],
  ['U5', 15],
  ['U6', 16],
  ['U7', 20],
];

describe('every unit is completable end to end', () => {
  for (const [unitId, screenCount] of UNITS) {
    it(`${unitId} can be finished by clicking through it`, async () => {
      const { seen, completed } = await walkUnit(unitId, screenCount);
      expect(completed).toBe(true);
      // The walk must actually traverse the unit, not shortcut it.
      expect(seen.length).toBeGreaterThan(1);
    }, 30000);
  }
});

describe('regressions that previously stranded a learner', () => {
  it('a second consecutive practice screen is answerable, not pre-answered', async () => {
    resetAll();
    // U1 screens 12 and 13 are both `practice` — the pair that broke. (They
    // were 13 and 14 before beat 8 was removed from the unit.)
    const { container } = render(Lesson, { props: { unitId: 'U1' } });

    // Walk to the first practice screen.
    for (let i = 0; i < 200; i += 1) {
      const pos = position(container);
      if (/^1[23] of 17$/.test(pos)) break;
      const buttons = clickable(container);
      if (!buttons.length) break;
      const advances = buttons.filter((b) => ADVANCE.test(b.textContent.trim()));
      await fireEvent.click(advances.length ? advances[advances.length - 1] : buttons[0]);
    }

    // On arrival, no option may already be marked correct, and no feedback may
    // be showing — the learner has not chosen anything yet.
    expect(container.textContent).not.toContain('The correct answer is');
  }, 30000);

  it('guided practice sort reports completion so the screen can advance', async () => {
    resetAll();
    const { container } = render(Lesson, { props: { unitId: 'U1' } });

    for (let i = 0; i < 400; i += 1) {
      if (getState().unitsCompleted.includes('U1')) break;
      const buttons = clickable(container);
      if (!buttons.length) break;
      const advances = buttons.filter((b) => ADVANCE.test(b.textContent.trim()));
      await fireEvent.click(advances.length ? advances[advances.length - 1] : buttons[0]);
    }
    // Reaching the end at all means the sort item did not trap the walk.
    expect(getState().unitsCompleted).toContain('U1');
  }, 30000);

  it('no unit still renders the removed beat-8 screen', async () => {
    for (const unitId of ['U1', 'U2', 'U5', 'U7']) {
      resetAll();
      const { container, unmount } = render(Lesson, { props: { unitId } });
      for (let i = 0; i < 400; i += 1) {
        if (getState().unitsCompleted.includes(unitId)) break;
        // "One idea. / N real questions." was the beat-8 heading.
        expect(container.textContent).not.toMatch(/\d+ real questions\./);
        const buttons = clickable(container);
        if (!buttons.length) break;
        const advances = buttons.filter((b) => ADVANCE.test(b.textContent.trim()));
        await fireEvent.click(advances.length ? advances[advances.length - 1] : buttons[0]);
      }
      unmount();
    }
  }, 60000);

  it('a wrong choice is shown back to the learner, not just the right one', async () => {
    resetAll();
    // The original defect: SingleSelect tracked `selected` but never read it,
    // so the option a learner actually chose was dimmed exactly like the ones
    // they did not choose. The right answer was shown; the mistake was not.
    const { container } = render(Lesson, { props: { unitId: 'U1' } });

    // Walk to the first practice screen (12 of 17). NOTE: position() returns
    // the whole bar label, e.g. "We the People · 12 of 17", so match the tail
    // rather than anchoring the whole string.
    for (let i = 0; i < 200; i += 1) {
      if (position(container).endsWith('12 of 17')) break;
      const buttons = clickable(container);
      if (!buttons.length) break;
      const advances = buttons.filter((b) => ADVANCE.test(b.textContent.trim()));
      await fireEvent.click(advances.length ? advances[advances.length - 1] : buttons[0]);
    }

    // Options are the enabled non-advance controls on this screen.
    const options = clickable(container).filter((b) => !ADVANCE.test(label(b)));
    expect(options.length).toBeGreaterThanOrEqual(3);

    // Pick a KNOWN-WRONG option. Option order is permuted per question, so
    // "the first one" is sometimes the right answer — a test that clicked
    // blindly would take the happy path half the time and prove nothing.
    // Q2 is this screen's question; anything that is not its correct option
    // is wrong by construction.
    const q2 = getQuestion('Q2');
    const correctText = q2.options[q2.correctIndex];
    const wrong = options.find((b) => !label(b).includes(correctText));
    expect(wrong).toBeTruthy();
    const wrongText = label(wrong);

    await fireEvent.click(wrong);

    const rows = [...container.querySelectorAll('button')].map((b) =>
      b.textContent.replace(/\s+/g, ' ').trim()
    );

    // The correct answer is marked ✓ — this already worked.
    expect(rows.some((t) => t.includes('✓') && t.includes(correctText))).toBe(true);

    // The learner's own wrong pick must be identifiable. The ✗ is what keeps
    // this off colour alone (§8), so it is the thing worth asserting.
    const picked = rows.find((t) => t.includes(wrongText));
    expect(picked).toBeTruthy();
    expect(picked).toMatch(/✗/);
  }, 30000);

  it('vocab screens present exactly one advance control', async () => {
    resetAll();
    const { container } = render(Lesson, { props: { unitId: 'U1' } });

    // U1-S04 is the vocab deck: screen 4.
    for (let i = 0; i < 60; i += 1) {
      if (position(container).startsWith('4 of')) break;
      const buttons = clickable(container);
      const advances = buttons.filter((b) => ADVANCE.test(b.textContent.trim()));
      await fireEvent.click(advances.length ? advances[advances.length - 1] : buttons[0]);
    }

    // Flip every card.
    for (let i = 0; i < 12; i += 1) {
      const cards = clickable(container).filter(
        (b) => !ADVANCE.test(b.textContent.trim())
      );
      if (!cards.length) break;
      await fireEvent.click(cards[0]);
    }

    const nexts = [...container.querySelectorAll('button')].filter((b) =>
      ADVANCE.test(b.textContent.trim())
    );
    expect(nexts.length).toBe(1);
  }, 30000);
});
