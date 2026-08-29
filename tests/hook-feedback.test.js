/**
 * Hook screens answer the learner.
 *
 * A hook is the question that opens each unit — "Who is the boss of America?"
 * — asked before the lesson teaches anything. It renders three tappable
 * options and looks exactly like the graded questions elsewhere in the course.
 *
 * It did not behave like them. Tapping dimmed every option identically and
 * printed a paragraph underneath; the correct answer was named in that prose
 * but never marked on the buttons. So the screen that looks most like a quiz
 * was the one that answered you least, and a learner who picked wrongly had no
 * idea which one they had picked.
 *
 * Every other answer surface — SingleSelect, MultiSelect, GuidedPractice —
 * marks the correct option ✓ green and the learner's wrong pick ✗ red. These
 * hold hooks to the same contract.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';

import Lesson from '../src/lib/screens/Lesson.svelte';
import { progress } from '../src/lib/stores/progress.js';
import { cancel } from '../src/lib/narration.js';

import unit0 from '../src/lib/content/unit0.json';
import unit1 from '../src/lib/content/unit1.json';
import unit2 from '../src/lib/content/unit2.json';
import unit3 from '../src/lib/content/unit3.json';
import unit4 from '../src/lib/content/unit4.json';
import unit5 from '../src/lib/content/unit5.json';
import unit6 from '../src/lib/content/unit6.json';
import unit7 from '../src/lib/content/unit7.json';

const UNITS = { U0: unit0, U1: unit1, U2: unit2, U3: unit3, U4: unit4, U5: unit5, U6: unit6, U7: unit7 };
const hooks = Object.entries(UNITS).flatMap(([id, u]) =>
  u.screens.filter((s) => s.type === 'hook').map((s) => [id, s])
);

/** The option buttons, found by their own text rather than by class — the
 *  narration control is also a rounded-full button and was picked up first. */
const optionButtons = (container, screen) =>
  screen.options.map((opt) =>
    [...container.querySelectorAll('button')].find((b) => b.textContent.includes(opt))
  );

beforeEach(() => {
  progress.resetAll();
  cancel();
});

describe('every hook declares which answer the lesson endorses', () => {
  it('has a correctIndex in range', () => {
    expect(hooks.length, 'no hook screens found — the selector is wrong').toBeGreaterThan(5);
    for (const [, s] of hooks) {
      expect(s.correctIndex, `${s.id} has no correctIndex`).toBeTypeOf('number');
      expect(s.correctIndex).toBeGreaterThanOrEqual(0);
      expect(s.correctIndex).toBeLessThan(s.options.length);
    }
  });

  it('names that answer in its feedback prose too', () => {
    // The index and the paragraph must agree. If they drift, the buttons say
    // one thing and the explanation underneath says another — worse than the
    // silence this replaced.
    for (const [, s] of hooks) {
      const answer = s.options[s.correctIndex].toLowerCase();
      const words = answer.split(/\s+/).filter((w) => w.length > 3);
      const feedback = s.feedback.toLowerCase();
      const hit = words.length === 0 || words.some((w) => feedback.includes(w));
      expect(hit, `${s.id}: feedback never mentions "${s.options[s.correctIndex]}"`).toBe(true);
    }
  });
});

describe('a hook marks the answer, like every other assessment surface', () => {
  for (const [unitId, screen] of hooks) {
    it(`${screen.id} marks the correct option green and a wrong pick red`, async () => {
      progress.saveScreenPosition(unitId, screen.id);
      const { container } = render(Lesson, { props: { unitId } });

      // Pick something that is NOT the answer.
      const wrong = screen.correctIndex === 0 ? 1 : 0;
      await fireEvent.click(optionButtons(container, screen)[wrong]);

      const after = optionButtons(container, screen);
      expect(after[screen.correctIndex].className, 'correct option not green').toMatch(/gotit/);
      expect(after[screen.correctIndex].textContent).toContain('✓');
      expect(after[wrong].className, 'wrong pick not red').toMatch(/notyet/);
      expect(after[wrong].textContent).toContain('✗');
    });
  }

  it('shows no red when the learner picks correctly', async () => {
    const [unitId, screen] = hooks[0];
    progress.saveScreenPosition(unitId, screen.id);
    const { container } = render(Lesson, { props: { unitId } });

    await fireEvent.click(optionButtons(container, screen)[screen.correctIndex]);
    const after = optionButtons(container, screen);
    expect(after[screen.correctIndex].className).toMatch(/gotit/);
    expect(after.map((b) => b.className).join(' ')).not.toMatch(/notyet/);
  });
});

describe('a hook is still not graded', () => {
  it('records no answer against the learner', () => {
    // A hook is asked BEFORE the lesson teaches. Counting it would score
    // someone on material they have not been given — G-1. Showing which answer
    // the lesson endorses is feedback; recording it would be scoring.
    const [unitId, screen] = hooks[0];
    progress.saveScreenPosition(unitId, screen.id);
    const { container } = render(Lesson, { props: { unitId } });

    const before = { ...progress.subscribe };
    fireEvent.click(optionButtons(container, screen)[0]);

    let state;
    progress.subscribe((s) => (state = s))();
    expect(Object.keys(state.questionsAnswered), 'a hook was recorded as a graded answer').toEqual([]);
    expect(before).toBeTruthy();
  });
});
