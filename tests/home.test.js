/**
 * The Home primary card has to describe the learner's actual state.
 *
 * The defect this guards: the label was the literal string "CONTINUE" and the
 * unit was "the first one you have not completed". So a fresh install told a
 * learner to continue something they had never opened, and a learner who jumped
 * ahead to U3 was told to continue Unit 0, because no unit was complete yet.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import Home from '../src/lib/screens/Home.svelte';
import { progress } from '../src/lib/stores/progress.js';

// Always mutate through the store: it holds its own snapshot and only refreshes
// when a change goes through it, so writing straight to storage would leave the
// component reading a stale value.
beforeEach(() => {
  progress.resetAll();
  window.location.hash = '';
});

const ALL_UNITS = ['U0', 'U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7'];

// The primary card is the first button on the screen. Assertions about which
// unit it names must be scoped to it — the unit list underneath contains every
// unit title, so a page-wide textContent check proves nothing.
const firstCard = (container) => container.querySelector('button');

describe('Home primary card', () => {
  it('says START on a fresh install, never CONTINUE', () => {
    const { container } = render(Home, {});
    expect(container.textContent).toContain('START');
    // The whole point: nothing has been opened, so nothing can be continued.
    expect(container.textContent).not.toContain('CONTINUE');
  });

  it('says CONTINUE and names the unit actually left off in', () => {
    // Jump straight to U3 without completing anything — the case the old logic
    // got wrong, because it keyed off unitsCompleted rather than position.
    progress.saveScreenPosition('U3', 'U3-S05');

    const { container } = render(Home, {});
    expect(container.textContent).toContain('CONTINUE');
    expect(container.textContent).not.toContain('START');

    // Assert on the CARD, not the page. The unit list below also contains
    // "Who represents you", so a page-wide check passes even when the card
    // names the wrong unit — verified: it did.
    const card = firstCard(container);
    expect(card.textContent).toContain('Who represents you');
    expect(card.textContent).not.toContain('Test day');
  });

  it('does not name Unit 0 when the learner is mid-way through a later unit', () => {
    progress.saveScreenPosition('U5', 'U5-S06');
    const { container } = render(Home, {});

    // "Unit 0 — Test day" must not be the headline; "Unit 5 — Rights" must be.
    const card = firstCard(container);
    expect(card).toBeTruthy();
    expect(card.textContent).toContain('Unit 5');
    expect(card.textContent).not.toContain('Unit 0');
  });

  it('points at Rehearsal once every unit is finished', () => {
    for (const id of ALL_UNITS) progress.markUnitComplete(id);
    const { container } = render(Home, {});

    expect(container.textContent).toContain('PRACTICE THE INTERVIEW');
    // Telling someone who finished the course to "continue Unit 0" was the
    // third face of the same bug.
    expect(container.textContent).not.toContain('CONTINUE');
  });

  it('returns to START after progress is cleared', () => {
    progress.saveScreenPosition('U3', 'U3-S05');
    progress.resetAll();

    const { container } = render(Home, {});
    expect(container.textContent).toContain('START');
    expect(container.textContent).not.toContain('CONTINUE');
  });
});
