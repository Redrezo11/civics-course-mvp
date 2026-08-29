/**
 * Does every screen actually change language?
 *
 * The defect, found on /welcome and then everywhere: a learner picks Burmese
 * and the screen stays English, because its prose was a literal in the markup
 * rather than a key. Nothing caught it — $t() covers UI chrome and
 * localiseScreen covers unit content, and text hand-written into a component
 * went through neither. It did not even appear in TRANSLATION-REQUEST.md, so
 * nobody would have known to translate it.
 *
 * These render each screen in Burmese and assert that Burmese comes out. They
 * are deliberately coarse: the point is "does this screen speak the learner's
 * language at all", which is the question that went unasked.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';

import Welcome from '../src/lib/screens/Welcome.svelte';
import Epitome from '../src/lib/screens/Epitome.svelte';
import Rehearsal from '../src/lib/screens/Rehearsal.svelte';
import Completion from '../src/lib/screens/Completion.svelte';
import FullBank from '../src/lib/screens/FullBank.svelte';
import QuestionBank from '../src/lib/screens/QuestionBank.svelte';
import Review from '../src/lib/screens/Review.svelte';
import Home from '../src/lib/screens/Home.svelte';
import Help from '../src/lib/screens/Help.svelte';
import LevelsDiagram from '../src/lib/components/LevelsDiagram.svelte';

import { progress } from '../src/lib/stores/progress.js';
import { cancel } from '../src/lib/narration.js';
import uiStrings from '../src/lib/content/ui-strings.json';

const isBurmese = (s) => /[က-႟]/.test(s);

/** Latin prose, ignoring the things that are English ON PURPOSE. */
function stubbornEnglish(text) {
  return text
    // Official question wording and accepted answers stay English (G-3), and
    // so do question ids, unit codes, counters and the language names on the
    // language picker.
    .replace(/[A-Z]\d+/g, ' ')
    .replace(/uscis\.gov|USCIS|M-1778|National Archives|Library of Congress/g, ' ')
    .replace(/English|Burmese|civics/gi, ' ')
    .replace(/[^A-Za-z ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3);
}

beforeEach(() => {
  progress.resetAll();
  cancel();
  progress.setLanguage('my');
});

describe('every screen renders in the learner’s language', () => {
  const screens = [
    ['Welcome', Welcome, {}],
    ['Epitome', Epitome, { rerun: true }],
    ['Rehearsal', Rehearsal, {}],
    ['Completion', Completion, {}],
    ['FullBank', FullBank, { unitId: 'U1' }],
    ['QuestionBank', QuestionBank, {}],
    ['Home', Home, {}],
    ['Help', Help, {}],
    ['LevelsDiagram', LevelsDiagram, {}],
  ];

  for (const [name, Component, props] of screens) {
    it(`${name} shows Burmese`, () => {
      const { container } = render(Component, { props });
      expect(isBurmese(container.textContent), `${name} rendered no Burmese at all`).toBe(true);
    });
  }

  it('Review shows Burmese on its loading state', () => {
    // Rendered without a real review id, so it sits on "preparing" — which was
    // itself hardcoded English.
    const { container } = render(Review, { props: { reviewId: 'R1' } });
    expect(isBurmese(container.textContent)).toBe(true);
  });

  it('the federal/state diagram is labelled in Burmese, alt text included', () => {
    // SVG text is outside both translation paths, which is exactly why this
    // one stayed English through every previous pass.
    const { container } = render(LevelsDiagram, {});
    const svgText = [...container.querySelectorAll('text')].map((n) => n.textContent).join(' ');
    expect(isBurmese(svgText), 'the labels inside the drawing are still English').toBe(true);
    expect(isBurmese(container.querySelector('[role="img"]').getAttribute('aria-label'))).toBe(true);
  });
});

describe('the string table itself', () => {
  it('has no key whose Burmese is identical to its English', () => {
    // A copy-paste rather than a translation. Two legitimate exceptions:
    //
    //   · language names — the picker shows each language in its own script;
    //   · the federal/state diagram's two box labels. "Federal" and "State" are
    //     accepted answers and appear in official question wording, so they
    //     stay English exactly as an answer option does. The Burmese for each
    //     box is carried by its subtitle line beneath (diagram.oneNational,
    //     diagram.schools/police/licences), which IS translated — so the box
    //     reads English term over Burmese explanation, not English alone.
    const EXPECTED_SAME = new Set(['language.english', 'diagram.federal', 'diagram.state']);
    const same = Object.entries(uiStrings)
      .filter(([k]) => k !== '_note')
      .filter(([k, v]) => v.my && v.my === v.en && !EXPECTED_SAME.has(k))
      .map(([k]) => k);
    expect(same).toEqual([]);
  });

  it('keeps every placeholder that its English has', () => {
    // {n} dropped from a translation renders a sentence missing its number, and
    // nothing errors — the interpolation simply has nothing to replace.
    const wrong = [];
    for (const [key, v] of Object.entries(uiStrings)) {
      if (key === '_note' || !v.my) continue;
      const en = [...v.en.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      const my = [...v.my.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      if (en.join() !== my.join()) wrong.push(`${key}: en{${en}} my{${my}}`);
    }
    expect(wrong).toEqual([]);
  });
});
