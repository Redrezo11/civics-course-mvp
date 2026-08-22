/**
 * The i18n layer.
 *
 * Before this existed, selecting Burmese wrote a preference to localStorage and
 * nothing ever read it — the language could not change anything, in any browser.
 *
 * Three rules these tests hold to:
 *   · Burmese appears where a translation exists.
 *   · Everywhere else falls back to ENGLISH, never to blanks. A partial
 *     translation must not break the course (v1.1 plan §5).
 *   · Official question wording and accepted answers stay English even in
 *     Burmese (G-3), because the interview is conducted in English.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Lesson from '../src/lib/screens/Lesson.svelte';
import Settings from '../src/lib/screens/Settings.svelte';
import GuidedPractice from '../src/lib/components/GuidedPractice.svelte';
import { progress } from '../src/lib/stores/progress.js';
import { t, localiseScreen, translatedUnits } from '../src/lib/i18n.js';
import uiStrings from '../src/lib/content/ui-strings.json';
import unit0 from '../src/lib/content/unit0.json';
import unit1 from '../src/lib/content/unit1.json';
import unit2 from '../src/lib/content/unit2.json';
import unit3 from '../src/lib/content/unit3.json';
import unit4 from '../src/lib/content/unit4.json';
import unit5 from '../src/lib/content/unit5.json';
import unit6 from '../src/lib/content/unit6.json';
import unit7 from '../src/lib/content/unit7.json';
import myUnit1 from '../src/lib/content/translations/my/unit1.json';

const UNITS = [unit0, unit1, unit2, unit3, unit4, unit5, unit6, unit7];

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

  it('falls back to English for a unit that has no overlay at all', () => {
    // Every real unit is now translated, so the fallback needs an id that is
    // not in OVERLAYS. The rule still has to hold — it is what stops a new
    // unit from rendering blank the day it is added.
    const s = unit2.screens.find((x) => x.type === 'hook');
    expect(localiseScreen(s, 'U9', 'my')).toBe(s);
  });

  it('falls back to English for a screen the overlay does not cover', () => {
    // Every U1 screen happens to be covered right now, so the id is synthesised
    // rather than searched for — the rule must hold whatever coverage reaches,
    // and a test that quietly finds nothing to assert on is no test at all.
    expect(myUnit1['U1-S99']).toBeUndefined();
    const uncovered = { ...s02, id: 'U1-S99' };
    expect(localiseScreen(uncovered, 'U1', 'my')).toBe(uncovered);
  });

  it('never returns an empty field where English had content, in any unit', () => {
    for (const unit of UNITS) {
      for (const screen of unit.screens) {
        const out = localiseScreen(screen, unit.id, 'my');
        for (const [k, v] of Object.entries(screen)) {
          if (typeof v === 'string' && v.length) {
            expect(out[k], `${screen.id}.${k} blanked`).toBeTruthy();
          }
          if (Array.isArray(v)) {
            expect(out[k], `${screen.id}.${k} length changed`).toHaveLength(v.length);
          }
        }
      }
    }
  });
});

describe('guided practice survives translation, in every unit', () => {
  // A translated option list that lost an entry, or a sort item that lost its
  // bucket index, scores the learner wrongly and looks completely normal doing
  // it. This is the failure mode worth a test in all eight units, not just U1.
  it('keeps correctIndex, kind and bucket indices intact', () => {
    let checked = 0;
    for (const unit of UNITS) {
      for (const gp of unit.screens.filter((s) => s.type === 'guidedPractice')) {
        const out = localiseScreen(gp, unit.id, 'my');
        expect(out.items, `${gp.id} lost items`).toHaveLength(gp.items.length);
        out.items.forEach((item, i) => {
          const en = gp.items[i];
          checked += 1;
          expect(item.kind, `${gp.id}.items[${i}].kind`).toBe(en.kind);
          if (en.correctIndex !== undefined) {
            expect(item.correctIndex, `${gp.id}.items[${i}].correctIndex`).toBe(en.correctIndex);
          }
          if (en.options) {
            expect(item.options, `${gp.id}.items[${i}].options`).toHaveLength(en.options.length);
          }
          if (en.sortItems) {
            expect(item.sortItems).toHaveLength(en.sortItems.length);
            item.sortItems.forEach((si, n) =>
              expect(si.bucket, `${gp.id}.items[${i}].sortItems[${n}].bucket`).toBe(
                en.sortItems[n].bucket
              )
            );
          }
          if (en.buckets) {
            expect(item.buckets, `${gp.id}.items[${i}].buckets`).toHaveLength(en.buckets.length);
          }
        });
      }
    }
    expect(checked).toBeGreaterThan(20);
  });
});

describe('G-3 — official English survives the Burmese overlay', () => {
  const questions = import.meta.glob('../src/lib/content/questions-u*.json', {
    eager: true,
    import: 'default',
  });
  const all = Object.values(questions).flat();
  const official = all.map((q) => q.official).filter((s) => s.length > 15);
  const accepted = new Set(all.flatMap((q) => q.acceptedAnswers).filter((s) => s.length > 12));

  it('keeps every quoted official question in English', () => {
    for (const unit of UNITS) {
      for (const screen of unit.screens) {
        const out = localiseScreen(screen, unit.id, 'my');
        for (const [k, v] of Object.entries(screen)) {
          if (typeof v !== 'string') continue;
          for (const o of official) {
            if (v.includes(o)) {
              expect(String(out[k]), `${screen.id}.${k} translated away "${o}"`).toContain(o);
            }
          }
        }
        for (const [i, item] of (screen.items || []).entries()) {
          const got = out.items[i];
          for (const [k, v] of Object.entries(item)) {
            if (typeof v !== 'string') continue;
            for (const o of official) {
              if (v.includes(o)) {
                expect(String(got[k]), `${screen.id}.items[${i}].${k} translated away "${o}"`).toContain(o);
              }
            }
          }
        }
      }
    }
  });

  it('keeps any option that restates an accepted answer verbatim', () => {
    for (const unit of UNITS) {
      for (const screen of unit.screens) {
        const out = localiseScreen(screen, unit.id, 'my');
        for (const [i, item] of (screen.items || []).entries()) {
          (item.options || []).forEach((opt, n) => {
            if (accepted.has(opt.trim())) {
              expect(out.items[i].options[n], `${screen.id}.items[${i}].options[${n}]`).toBe(opt);
            }
          });
        }
      }
    }
  });

  it('never renders ANY answer in Burmese — every unit, every screen', () => {
    // The core guarantee of the English-primary design, asserted on the
    // resolved screen rather than on the overlay files. An answer the learner
    // has only ever met in Burmese is an answer they cannot give the officer.
    let checked = 0;
    for (const unit of UNITS) {
      for (const screen of unit.screens) {
        const out = localiseScreen(screen, unit.id, 'my');
        for (const field of ['options', 'buckets', 'orderItems']) {
          if (!screen[field]) continue;
          checked += 1;
          expect(out[field], `${screen.id}.${field} was translated`).toEqual(screen[field]);
        }
        for (const [i, item] of (screen.items || []).entries()) {
          const got = out.items[i];
          for (const field of ['options', 'buckets', 'orderItems', 'sortItems']) {
            if (!item[field]) continue;
            checked += 1;
            expect(got[field], `${screen.id}.items[${i}].${field} was translated`).toEqual(item[field]);
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(40);
  });
});

describe('the Burmese gloss beneath an answer', () => {
  const glossPairs = () => {
    const out = [];
    for (const unit of UNITS) {
      for (const screen of unit.screens) {
        const loc = localiseScreen(screen, unit.id, 'my');
        const scan = (english, resolved, where) => {
          for (const [field, glossField] of [
            ['options', 'optionsGloss'],
            ['buckets', 'bucketsGloss'],
            ['orderItems', 'orderItemsGloss'],
            ['sortItems', 'sortItemsGloss'],
          ]) {
            if (resolved[glossField]) out.push([`${where}.${field}`, english[field], resolved[glossField]]);
          }
        };
        scan(screen, loc, screen.id);
        (screen.items || []).forEach((item, i) => scan(item, loc.items[i], `${screen.id}.items[${i}]`));
      }
    }
    return out;
  };

  it('exists at all', () => {
    expect(glossPairs().length).toBeGreaterThan(10);
  });

  it('always has exactly one entry per English answer', () => {
    // A gloss that drifts by one index labels every answer with the translation
    // of a different answer — and looks completely normal doing it.
    for (const [where, english, gloss] of glossPairs()) {
      expect(gloss, `${where} gloss length`).toHaveLength(english.length);
    }
  });

  it('never repeats the English it sits under', () => {
    for (const [where, english, gloss] of glossPairs()) {
      english.forEach((e, i) => {
        const enText = typeof e === 'string' ? e : e.text;
        if (gloss[i]) {
          expect(String(gloss[i]), `${where}[${i}] prints its English twice`).not.toContain(enText);
        }
      });
    }
  });

  it('is Burmese, or absent — never an English duplicate line', () => {
    for (const [where, , gloss] of glossPairs()) {
      gloss.forEach((g, i) => {
        if (g) expect(isBurmese(g), `${where}[${i}] gloss is not Burmese`).toBe(true);
      });
    }
  });
});

describe('an answer on screen', () => {
  it('shows the English and the Burmese together', async () => {
    progress.setLanguage('my');
    const gp = localiseScreen(
      unit1.screens.find((s) => s.id === 'U1-S09'),
      'U1',
      'my'
    );
    const item = gp.items.findIndex((x) => x.optionsGloss);
    expect(item, 'expected a guided item with a gloss').toBeGreaterThan(-1);

    const { container } = render(GuidedPractice, { props: { items: [gp.items[item]] } });
    const text = container.textContent;

    // Both languages, on the same button, at the same time.
    expect(text).toContain(gp.items[item].options[0]);
    expect(hasConsonant(text), 'no Burmese gloss rendered').toBe(true);

    // And the gloss carries lang="my", which is what switches a screen reader's
    // voice and scopes the bundled Myanmar font.
    expect(container.querySelector('[lang="my"]')).toBeTruthy();
  });
});

describe('the UI string lookup', () => {
  it('returns English by default', () => {
    expect(get(t)('settings.title')).toBe('Settings');
  });

  it('returns Burmese where it exists', () => {
    progress.setLanguage('my');
    expect(isBurmese(get(t)('settings.coverage.my'))).toBe(true);
  });

  it('has Burmese for every key but the ones known to be outstanding', () => {
    // Named rather than counted. A count would let a newly-added English string
    // slip in the moment an old one was translated, which is exactly when
    // nobody is looking. Anything appearing here that is not on this list is a
    // gap someone introduced without requesting the translation.
    const AWAITING = [
      // What the learner is told about where their progress goes, when a
      // learning management system is listening. `help.reset` is not new copy —
      // it was hardcoded in Help.svelte and untranslatable until it moved here
      // to gain an LMS variant, so it arrives already outstanding.
      'help.privacyLms',
      'help.reset',
      'help.resetLms',
      'narration.listen',
      'narration.listenAgain',
      'narration.pause',
      'narration.resume',
      'settings.answersStayEnglish',
    ];
    const missing = Object.entries(uiStrings)
      .filter(([k, v]) => k !== '_note' && !v.my)
      .map(([k]) => k);
    expect(missing.sort()).toEqual([...AWAITING].sort());
  });

  it('makes an unknown key VISIBLE rather than blank', () => {
    // A silent empty string is how a broken interface ships looking fine.
    expect(get(t)('nope.does.not.exist')).toBe('nope.does.not.exist');
  });
});

describe('a Burmese learner in the app', () => {
  it('has an overlay registered for all eight units', () => {
    expect(translatedUnits('my').sort()).toEqual(['U0', 'U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7']);
  });

  for (const unitId of ['U1', 'U2', 'U7']) {
    it(`sees Burmese teaching text in ${unitId}`, async () => {
      progress.setLanguage('my');
      const { container } = render(Lesson, { props: { unitId } });
      const next = [...container.querySelectorAll('button')].find((b) =>
        /^(Begin|Next|စတင်|ရှေ့သို့)/.test(b.textContent.trim())
      );
      if (next) next.click();
      await new Promise((r) => setTimeout(r, 0));
      expect(hasConsonant(container.textContent)).toBe(true);
    });
  }

  it('is told what is actually translated, and that Burmese is a draft', () => {
    progress.setLanguage('my');
    const { container } = render(Settings, {});
    expect(container.textContent).toMatch(/draft|မူကြမ်း/);
    // The old copy promised "Lessons and buttons change language", which was
    // false. It must not come back.
    expect(container.textContent).not.toMatch(/Lessons and buttons change language/);
  });
});
