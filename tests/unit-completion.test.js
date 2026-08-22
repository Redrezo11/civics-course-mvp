/**
 * What "finished" means for a unit.
 *
 * Resume was broken for the whole life of the project — a reactive save
 * overwrote the stored position at index 0 before onMount could read it — and
 * fixing it turned resume on everywhere, including where it should not be. A
 * completed unit kept its position, so tapping it dropped the learner on the
 * last slide of a lesson that was ticked as done.
 *
 * These hold both halves at once: an unfinished unit resumes, a finished one
 * starts over.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';

import Lesson from '../src/lib/screens/Lesson.svelte';
import Home from '../src/lib/screens/Home.svelte';
import { progress } from '../src/lib/stores/progress.js';
import { getState } from '../src/lib/storage.js';
import unit1 from '../src/lib/content/unit1.json';

const position = (c) => c.querySelector('span')?.textContent.trim() || '';
/** Home's primary card — the page also lists every unit by name below it. */
const firstCard = (c) => c.querySelector('a, button');

beforeEach(() => {
  progress.resetAll();
  window.location.hash = '';
});

describe('finishing a unit ends its session', () => {
  it('clears the saved position', () => {
    progress.saveScreenPosition('U1', 'U1-S11');
    expect(getState().screenPosition.U1).toBe('U1-S11');

    progress.markUnitComplete('U1');
    expect(getState().screenPosition.U1, 'a finished unit has no position to be at').toBeUndefined();
  });

  it('opens a completed unit on its first screen, not its last', () => {
    progress.saveScreenPosition('U1', 'U1-S11');
    progress.markUnitComplete('U1');

    const { container } = render(Lesson, { props: { unitId: 'U1' } });
    expect(position(container)).toContain(`1 of ${unit1.screens.length}`);
  });

  it('still opens a completed unit at the start even if a position is written while revisiting', () => {
    // Walking back through a finished lesson saves a position on every screen.
    // Without the guard in onMount, the next visit would be stranded mid-lesson
    // again — the same bug, arrived at from the other direction.
    progress.markUnitComplete('U1');
    progress.saveScreenPosition('U1', 'U1-S11');

    const { container } = render(Lesson, { props: { unitId: 'U1' } });
    expect(position(container)).toContain(`1 of ${unit1.screens.length}`);
  });
});

describe('an unfinished unit still resumes', () => {
  it('opens on the screen the learner left', () => {
    // The fix this change must not undo.
    progress.saveScreenPosition('U1', 'U1-S11');

    const { container } = render(Lesson, { props: { unitId: 'U1' } });
    expect(position(container)).toContain(`12 of ${unit1.screens.length}`);
  });
});

describe('Continue after finishing a unit', () => {
  it('names the next unfinished unit, not the one just completed', () => {
    // lastUnit used to win outright, so finishing U1 offered "CONTINUE — Unit 1"
    // and sent the learner back to its final screen.
    progress.saveScreenPosition('U1', 'U1-S16');
    progress.markUnitComplete('U1');

    const { container } = render(Home, {});
    const card = firstCard(container);
    expect(card.textContent).toContain('CONTINUE');
    expect(card.textContent, 'Continue points back at the finished unit').not.toContain('We the People');
  });

  it('still names an unfinished unit that was left part-way', () => {
    progress.saveScreenPosition('U3', 'U3-S05');

    const card = firstCard(render(Home, {}).container);
    expect(card.textContent).toContain('Who represents you');
  });
});

describe('the check mark', () => {
  it('is absent while a unit is merely in progress', () => {
    progress.saveScreenPosition('U1', 'U1-S11');
    const { container } = render(Home, {});
    const row = [...container.querySelectorAll('button')].find((b) =>
      b.textContent.includes('We the People')
    );
    expect(row.textContent).not.toContain('✓');
  });

  it('appears once the unit is completed, and stays while revisiting', () => {
    progress.markUnitComplete('U1');
    // Revisiting writes a position again; the tick records that the unit WAS
    // finished, which is still true. Taking it away would count re-reading
    // against the learner.
    progress.saveScreenPosition('U1', 'U1-S05');

    const { container } = render(Home, {});
    const row = [...container.querySelectorAll('button')].find((b) =>
      b.textContent.includes('We the People')
    );
    expect(row.textContent).toContain('✓');
  });
});
