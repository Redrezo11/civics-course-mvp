/**
 * Reset has to return the app to a genuine first run, not just empty storage.
 *
 * The defect this guards: Help cleared progress and navigated to Home, but the
 * redirect that sends a learner without a language to the language screen lived
 * in App.svelte's onMount — which runs once at boot. After a reset it could not
 * fire, so the app sat on Home with language === null. Only a manual page reload
 * produced a real first run. The theme class had the same fault: storage said
 * light, <html> stayed dark.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import App from '../src/App.svelte';
import Help from '../src/lib/screens/Help.svelte';
import { tick } from 'svelte';
import { getState } from '../src/lib/storage.js';
import { progress } from '../src/lib/stores/progress.js';
import { route } from '../src/lib/router.js';

// Always mutate through the `progress` store, never the raw storage functions.
// The store is a module singleton holding its own snapshot and only refreshes
// when a mutation goes through it, so writing straight to storage leaves every
// component reading a stale value. Components read the store; tests must too.
beforeEach(() => {
  progress.resetAll();
  window.location.hash = '';
  document.documentElement.classList.remove('dark');
});

describe('storage reset', () => {
  it('returns every field to its default, including language', () => {
    progress.setLanguage('en');
    progress.setTheme('dark');
    progress.markUnitComplete('U1');
    progress.recordAnswer('Q2', true);
    progress.recordAnswer('Q7', false);
    expect(getState().unitsCompleted).toContain('U1');

    progress.resetAll();

    const s = getState();
    // language === null is what makes the app treat this as a first run.
    expect(s.language).toBeNull();
    expect(s.theme).toBe('light');
    expect(s.unitsCompleted).toEqual([]);
    expect(s.questionsAnswered).toEqual({});
    expect(s.reviewQueue).toEqual([]);
    expect(s.fullBankDone).toEqual([]);
    expect(s.reviewsDone).toEqual([]);
    expect(s.rehearsal.attempts).toBe(0);
    expect(s.epitomeSeen).toBe(false);
  });
});

describe('the app reacts to a reset without a reload', () => {
  it('redirects to the language screen when progress is cleared mid-session', async () => {
    // This is the actual defect. A FRESH mount would fire onMount and redirect
    // even with the old code, so mounting first with a language set and only
    // then resetting is what distinguishes reactive from once-at-boot.
    //
    // Drive the route store directly: setting window.location.hash relies on a
    // hashchange event jsdom delivers on a later tick, so the store would still
    // hold the old route at assertion time.
    progress.setLanguage('en');
    route.set('/');
    render(App, {});
    await tick();
    expect(window.location.hash).not.toBe('#/language');

    // Now clear progress while the app stays mounted — no reload.
    progress.resetAll();
    await tick();

    expect(getState().language).toBeNull();
    expect(window.location.hash).toBe('#/language');
  });

  it('applies the stored theme, and drops the dark class when reset clears it', async () => {
    progress.setTheme('dark');
    progress.setLanguage('en');
    route.set('/help');
    const { container } = render(App, {});
    await tick();
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    // Clear progress from Help, exactly as a learner would.
    const startOver = [...container.querySelectorAll('button')].find((b) =>
      /Start over/i.test(b.textContent)
    );
    expect(startOver).toBeTruthy();
    await fireEvent.click(startOver);

    const clear = [...container.querySelectorAll('button')].find((b) =>
      /Clear progress/i.test(b.textContent)
    );
    expect(clear).toBeTruthy();
    await fireEvent.click(clear);

    // Storage is empty AND the class followed it — no reload involved.
    expect(getState().language).toBeNull();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});

describe('the reset control is reachable', () => {
  it('Help offers start-over behind a confirmation', async () => {
    const { container } = render(Help, {});
    const startOver = [...container.querySelectorAll('button')].find((b) =>
      /Start over/i.test(b.textContent)
    );
    expect(startOver).toBeTruthy();

    // Nothing is destroyed until the second tap.
    progress.setLanguage('en');
    await fireEvent.click(startOver);
    expect(getState().language).toBe('en');

    const clear = [...container.querySelectorAll('button')].find((b) =>
      /Clear progress/i.test(b.textContent)
    );
    await fireEvent.click(clear);
    expect(getState().language).toBeNull();
  });
});
