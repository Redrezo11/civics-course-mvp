/**
 * The i18n layer.
 *
 * Before this existed, selecting Burmese wrote a preference to localStorage and
 * nothing ever read it — the language could not change anything, in any browser.
 *
 * Two rules these tests hold to:
 *   · Burmese appears where a translation exists.
 *   · Everywhere else falls back to ENGLISH, never to blanks. A partial
 *     translation must not break the course (v1.1 plan §5).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Lesson from '../src/lib/screens/Lesson.svelte';
import Settings from '../src/lib/screens/Settings.svelte';
import { progress } from '../src/lib/stores/progress.js';
import { t, localiseScreen } from '../src/lib/i18n.js';
import unit1 from '../src/lib/content/unit1.json';
import unit2 from '../src/lib/content/unit2.json';

const isBurmese = (s) => /[က-႟]/.test(s);
const hasConsonant = (s) => /[က-ဟ]/.test(s);

beforeEach(() => {
  progress.resetAll();
  window.location.hash = '';
});

describe('the overlay resolver', () => {
  const s02 = unit1.screens.find((s) => s.id === 'U1-S02');

  it('leaves the screen untouched in English', () => {
    expect(localiseScreen(s02, 'U1', 'en')).toBe(s02);
  });

  it('replaces translated fields in Burmese, keeping the rest', () => {
    const out = localiseScreen(s02, 'U1', 'my');
    expect(isBurmese(out.question)).toBe(true);
    expect(hasConsonant(out.question)).toBe(true);
    // Structure survives: this is a merge, not a replacement.
    expect(out.id).toBe(s02.id);
    expect(out.type).toBe(s02.type);
    expect(out.options).toHaveLength(s02.options.length);
  });

  it('falls back to English for a unit with no translation', () => {
    const s = unit2.screens.find((x) => x.type === 'hook');
    expect(localiseScreen(s, 'U2', 'my')).toBe(s);
  });

  it('never returns an empty field where English had content', () => {
    for (const screen of unit1.screens) {
      const out = localiseScreen(screen, 'U1', 'my');
      for (const [k, v] of Object.entries(screen)) {
        if (typeof v === 'string' && v.length) {
          expect(out[k], `${screen.id}.${k} blanked`).toBeTruthy();
        }
        if (Array.isArray(v)) {
          expect(out[k], `${screen.id}.${k} length changed`).toHaveLength(v.length);
        }
      }
    }
  });

  it('merges guided-practice items without losing correctIndex or kind', () => {
    const gp = unit1.screens.find((s) => s.type === 'guidedPractice');
    const out = localiseScreen(gp, 'U1', 'my');
    out.items.forEach((item, i) => {
      expect(item.kind).toBe(gp.items[i].kind);
      if (gp.items[i].correctIndex !== undefined) {
        expect(item.correctIndex).toBe(gp.items[i].correctIndex);
      }
      if (gp.items[i].sortItems) {
        // bucket indices must survive, or the sort scores wrongly
        item.sortItems.forEach((si, n) =>
          expect(si.bucket).toBe(gp.items[i].sortItems[n].bucket)
        );
      }
    });
  });
});

describe('the UI string lookup', () => {
  it('returns English by default', () => {
    expect(get(t)('settings.title')).toBe('Settings');
  });

  it('falls back to English when a string has no Burmese yet', () => {
    progress.setLanguage('my');
    // settings.title is deliberately untranslated (my: null).
    expect(get(t)('settings.title')).toBe('Settings');
  });

  it('returns Burmese where it exists', () => {
    progress.setLanguage('my');
    const s = get(t)('settings.coverage.my');
    expect(isBurmese(s)).toBe(true);
  });

  it('makes an unknown key VISIBLE rather than blank', () => {
    // A silent empty string is how a broken interface ships looking fine.
    expect(get(t)('nope.does.not.exist')).toBe('nope.does.not.exist');
  });
});

describe('a Burmese learner in the app', () => {
  it('sees Burmese teaching text in Unit 1', async () => {
    progress.setLanguage('my');
    const { container } = render(Lesson, { props: { unitId: 'U1' } });
    // U1-S01 has no overlay (source shape differs), but S02 onward do; walk in.
    const next = [...container.querySelectorAll('button')].find((b) =>
      /^(Begin|Next)$/.test(b.textContent.trim())
    );
    if (next) next.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(hasConsonant(container.textContent)).toBe(true);
  });

  it('sees English CONTENT in Unit 2, not blanks, even though the chrome is Burmese', () => {
    progress.setLanguage('my');
    const { container } = render(Lesson, { props: { unitId: 'U2' } });

    // Unit 2 has no content overlay, so its teaching text falls back to English
    // rather than blanking — that is the rule the fallback exists for.
    expect(container.textContent).toContain('Three branches');
    expect(container.textContent.length).toBeGreaterThan(200);

    // The nav chrome IS translated, and legitimately shows Burmese here: UI
    // strings and course content are separate layers with separate coverage.
    // An earlier version of this test asserted no Burmese anywhere on the
    // screen, which stopped being true the moment the chrome was wired.
    const bar = container.querySelector('button');
    expect(hasConsonant(bar.textContent)).toBe(true);
  });

  it('is told what is actually translated, and that Burmese is a draft', () => {
    progress.setLanguage('my');
    const { container } = render(Settings, {});
    expect(container.textContent).toMatch(/draft/i);
    // The old copy promised "Lessons and buttons change language", which was
    // false. It must not come back.
    expect(container.textContent).not.toMatch(/Lessons and buttons change language/);
  });
});
