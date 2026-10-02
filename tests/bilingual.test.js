/**
 * Burmese mode shows English and Burmese together.
 *
 * Reviewer feedback (2026-10-02): learners wanted both languages on the same
 * page. Burmese mode now renders every passage of lesson prose as the English
 * with its Burmese directly beneath; English mode is unchanged. Answer options
 * and vocab words already worked this way — this extends it to everything a
 * lesson screen says.
 *
 * What these hold:
 *   · Burmese mode shows BOTH, each tagged with its own lang.
 *   · English mode shows each passage ONCE and no Burmese at all.
 *   · Where there is no distinct Burmese (missing, stale, identical), one line.
 *   · The confusable-pair screens, which rendered both terms blank in Burmese
 *     before this, show every term and definition.
 *   · Read-aloud stays Burmese-only: the English line is a reading aid.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';

import Lesson from '../src/lib/screens/Lesson.svelte';
import Bilingual from '../src/lib/components/Bilingual.svelte';
import { progress } from '../src/lib/stores/progress.js';
import { cancel } from '../src/lib/narration.js';
import { localiseScreen } from '../src/lib/i18n.js';
import { narrationFor, flatten } from '../src/lib/narration-text.js';
import { getQuestion } from '../src/lib/content/questions.js';

import unit0 from '../src/lib/content/unit0.json';
import unit1 from '../src/lib/content/unit1.json';
import unit2 from '../src/lib/content/unit2.json';
import unit3 from '../src/lib/content/unit3.json';
import unit4 from '../src/lib/content/unit4.json';
import unit5 from '../src/lib/content/unit5.json';
import unit6 from '../src/lib/content/unit6.json';
import unit7 from '../src/lib/content/unit7.json';

const UNITS = [unit0, unit1, unit2, unit3, unit4, unit5, unit6, unit7];
const isBurmese = (s) => /[က-႟]/.test(String(s));
const squash = (s) => String(s).replace(/\s+/g, ' ').trim();
/** What the Burmese line shows: the translation, minus any English it quotes. */
const burmeseLine = (en, my) =>
  squash(my.includes(en) ? my.replace(en, '').replace(/^[\s—–:()-]+|[\s—–:()-]+$/g, '') : my);

beforeEach(() => {
  progress.resetAll();
  cancel();
  window.location.hash = '';
});

async function mount(unitId, screenId, lang) {
  progress.resetAll();
  progress.setLanguage(lang);
  progress.saveScreenPosition(unitId, screenId);
  const { container } = render(Lesson, { props: { unitId } });
  await tick();
  return container;
}

/** The [english, burmese] pairs a screen type shows the moment it mounts. */
const VISIBLE = {
  info: (e, m) => [[e.heading, m.heading], [e.body, m.body], ...(e.bodyList || []).map((x, i) => [x, m.bodyList?.[i]])],
  tryOne: (e, m) => [[e.body, m.body]],
  orient: (e, m) => ['unitLabel', 'heading', 'body', 'afterQuote', 'coverageLine', 'afterTest'].map((k) => [e[k], m[k]]),
  hook: (e, m) => [[e.question, m.question]],
  connect: (e, m) => [
    ...(e.bodyList || []).map((x, i) => [x, m.bodyList?.[i]]),
    ...(e.bodyList2 || []).map((x, i) => [x, m.bodyList2?.[i]]),
    [e.closing, m.closing],
  ],
  bigIdea: (e, m) => [
    ...(e.paragraphs || []).map((x, i) => [x, m.paragraphs?.[i]]),
    ...(e.twoColumn || []).flatMap((c, i) => [[c.heading, m.twoColumn?.[i]?.heading], [c.body, m.twoColumn?.[i]?.body]]),
    ...['closing', 'resolution', 'handle', 'handleSub'].map((k) => [e[k], m[k]]),
  ],
  seeItNotIt: (e, m) => ['heading', 'example', 'nonExample', 'takeaway'].map((k) => [e[k], m[k]]),
  confusablePair: (e, m) => [
    [e.heading, m.heading],
    [e.termA.name, m.termA?.name], [e.termA.def, m.termA?.def],
    [e.termB.name, m.termB?.name], [e.termB.def, m.termB?.def],
    [e.resolution, m.resolution],
  ],
  lockItIn: (e, m) => [[e.heading, m.heading], [e.learnedLine, m.learnedLine]],
  guidedPractice: (e, m) => [
    [e.items[0].instructions, m.items?.[0]?.instructions],
    [e.items[0].question, m.items?.[0]?.question],
  ],
};

/** Pairs with a distinct Burmese side — the ones that must render twice. */
const distinct = (pairs) => pairs.filter(([en, my]) => en && my && my !== en && isBurmese(my));

/** One translated screen of each type, chosen from the data. */
function sample(type, extra = () => true) {
  for (const unit of UNITS) {
    for (const screen of unit.screens) {
      if (screen.type !== type || !extra(screen)) continue;
      const loc = localiseScreen(screen, unit.id, 'my');
      const pairs = distinct(VISIBLE[type](screen, loc));
      if (pairs.length) return { unitId: unit.id, screen, loc, pairs };
    }
  }
  throw new Error(`no translated ${type} screen found — the sampler is wrong`);
}

const CASES = [
  ...Object.keys(VISIBLE).map((type) => [type, sample(type)]),
  ['bigIdea (twoColumn)', sample('bigIdea', (s) => Array.isArray(s.twoColumn))],
];

const textIn = (container, selector) =>
  squash([...container.querySelectorAll(selector)].map((el) => el.textContent).join(' | '));

describe('Burmese mode: English with the Burmese beneath', () => {
  for (const [label, c] of CASES) {
    it(`${label} (${c.screen.id}) shows both languages, each tagged`, async () => {
      const container = await mount(c.unitId, c.screen.id, 'my');
      const english = textIn(container, '[lang="en"]');
      const burmese = textIn(container, '[lang="my"]');
      for (const [en, my] of c.pairs) {
        expect(english, `${c.screen.id}: English line missing`).toContain(squash(en));
        expect(burmese, `${c.screen.id}: Burmese line missing`).toContain(burmeseLine(en, my));
      }
    });
  }

  it('bigIdea two-column screens keep their pictures in Burmese', async () => {
    // The overlay's twoColumn entries carry no `image`, and rendering from the
    // localised screen used to drop every one of them.
    const c = CASES.find(([l]) => l === 'bigIdea (twoColumn)')[1];
    const container = await mount(c.unitId, c.screen.id, 'my');
    const srcs = [...container.querySelectorAll('img')].map((img) => img.getAttribute('src') || '');
    for (const col of c.screen.twoColumn) {
      expect(srcs.some((s) => s.endsWith(col.image)), `${c.screen.id}: ${col.image} not rendered`).toBe(true);
    }
  });

  it('a hook shows its feedback in both languages once answered', async () => {
    const c = sample('hook', (s) => s.feedback);
    const container = await mount(c.unitId, c.screen.id, 'my');
    const btn = [...container.querySelectorAll('button')].find((b) => b.textContent.includes(c.screen.options[0]));
    await fireEvent.click(btn);
    expect(textIn(container, '[lang="en"]')).toContain(squash(c.screen.feedback));
    expect(textIn(container, '[lang="my"]')).toContain(squash(c.loc.feedback));
  });

  it('a practice screen shows its explanation in both languages once answered', async () => {
    const c = (() => {
      for (const unit of UNITS) for (const s of unit.screens) {
        if (s.type !== 'practice' || !s.feedbackExplain) continue;
        const q = getQuestion(s.questionId);
        if (!q || q.dynamic || q.multiSelect) continue;
        const loc = localiseScreen(s, unit.id, 'my');
        if (isBurmese(loc.feedbackExplain)) return { unitId: unit.id, screen: s, loc, q };
      }
      throw new Error('no translated single-select practice explanation found');
    })();
    const container = await mount(c.unitId, c.screen.id, 'my');
    // Found by the option's own text: the Listen control is also a rounded
    // button and comes first.
    const option = [...container.querySelectorAll('button')].find((b) =>
      c.q.options.some((o) => squash(b.textContent).includes(squash(o)))
    );
    await fireEvent.click(option);
    expect(textIn(container, '[lang="en"]')).toContain(squash(c.screen.feedbackExplain));
    expect(textIn(container, '[lang="my"]')).toContain(squash(c.loc.feedbackExplain));
  });

  it('a vocab card shows its definition and example in both languages', async () => {
    const c = (() => {
      for (const unit of UNITS) for (const s of unit.screens) {
        if (s.type !== 'vocab') continue;
        const loc = localiseScreen(s, unit.id, 'my');
        if (isBurmese(loc.cards?.[0]?.def)) return { unitId: unit.id, screen: s, loc };
      }
      throw new Error('no translated vocab screen found');
    })();
    const container = await mount(c.unitId, c.screen.id, 'my');
    const card = [...container.querySelectorAll('button')].find((b) => b.textContent.includes(c.screen.cards[0].word));
    await fireEvent.click(card);
    expect(textIn(container, '[lang="en"]')).toContain(squash(c.screen.cards[0].def));
    expect(textIn(container, '[lang="my"]')).toContain(squash(c.loc.cards[0].def));
    expect(textIn(container, '[lang="en"]')).toContain(squash(c.screen.cards[0].example));
  });
});

describe('English mode is untouched', () => {
  for (const [label, c] of CASES) {
    it(`${label} (${c.screen.id}) shows each passage once and no Burmese`, async () => {
      const container = await mount(c.unitId, c.screen.id, 'en');
      // The lesson body only: the lesson bar also shows the unit title, which
      // is the same words as some headings ("Test day", "We the People").
      const all = squash(container.querySelector('.overflow-y-auto').textContent);
      for (const [en] of c.pairs) {
        const needle = squash(en);
        expect(all.split(needle).length - 1, `${c.screen.id}: "${needle.slice(0, 40)}" not exactly once`).toBe(1);
      }
      expect(container.querySelector('[lang="my"]'), `${c.screen.id}: Burmese in English mode`).toBeNull();
      expect(isBurmese(all), `${c.screen.id}: Myanmar script in English mode`).toBe(false);
    });
  }
});

describe('one line when there is no distinct Burmese', () => {
  it('renders a single line when the Burmese equals the English (missing or stale)', () => {
    const { container } = render(Bilingual, { props: { en: 'Three branches.', my: 'Three branches.' } });
    expect(container.querySelectorAll('span').length).toBe(1);
    expect(container.querySelector('[lang="my"]')).toBeNull();
    expect(container.textContent.split('Three branches.').length - 1).toBe(1);
  });

  it('renders a single line when there is no Burmese at all', () => {
    const { container } = render(Bilingual, { props: { en: 'Three branches.', my: '' } });
    expect(container.querySelector('[lang="my"]')).toBeNull();
  });

  it('does not repeat English that the translation already quotes', () => {
    const { container } = render(Bilingual, {
      props: { en: 'Constitution — 1787', my: 'Constitution — 1787 (ဖွဲ့စည်းပုံအခြေခံဥပဒေ)' },
    });
    expect(container.textContent.split('Constitution').length - 1).toBe(1);
    expect(container.querySelector('[lang="my"]').textContent).toBe('ဖွဲ့စည်းပုံအခြေခံဥပဒေ');
  });

  it('renders two lines, Burmese second, when they differ', () => {
    const { container } = render(Bilingual, { props: { en: 'Three branches.', my: 'အခွဲ သုံးခု။' } });
    const spans = container.querySelectorAll('span');
    expect(spans[0].getAttribute('lang')).toBe('en');
    expect(spans[1].getAttribute('lang')).toBe('my');
  });
});

describe('confusable pairs render every term', () => {
  // Six of these rendered both term lines blank in Burmese mode: the overlay
  // delivered "The Cabinet (အစိုးရအဖွဲ့) — …" as one string where the screen
  // expects { name, def }, and the string replaced the object.
  const pairs = UNITS.flatMap((u) =>
    u.screens.filter((s) => s.type === 'confusablePair').map((s) => [u.id, s])
  );

  it('found the screens', () => expect(pairs.length).toBeGreaterThanOrEqual(7));

  for (const [unitId, screen] of pairs) {
    it(`${screen.id} shows both terms and a Burmese definition for each`, async () => {
      const loc = localiseScreen(screen, unitId, 'my');
      expect(typeof loc.termA, `${screen.id}: termA is not { name, def }`).toBe('object');
      expect(typeof loc.termB, `${screen.id}: termB is not { name, def }`).toBe('object');
      expect(isBurmese(loc.termA.def), `${screen.id}: termA.def has no Burmese`).toBe(true);
      expect(isBurmese(loc.termB.def), `${screen.id}: termB.def has no Burmese`).toBe(true);

      const container = await mount(unitId, screen.id, 'my');
      const text = squash(container.textContent);
      // English names always; a Burmese name only where one exists (U7-S10/S11
      // have none — "Memorial Day" collapses to one line).
      expect(text).toContain(squash(screen.termA.name));
      expect(text).toContain(squash(screen.termB.name));
      expect(text).toContain(squash(loc.termA.def));
      expect(text).toContain(squash(loc.termB.def));
    });
  }
});

describe('read-aloud stays Burmese-only', () => {
  // A decision, recorded as a test (2026-10-02): the English line is a reading
  // aid, not spoken, so listening time does not double. Whoever adds a Burmese-
  // mode case to narration-coverage.test.js will find the English "unnarrated"
  // — that is this, not a bug.
  it('no English prose that has a distinct Burmese is spoken in Burmese mode', () => {
    const leaks = [];
    for (const unit of UNITS) {
      for (const screen of unit.screens) {
        if (!VISIBLE[screen.type]) continue;
        const loc = localiseScreen(screen, unit.id, 'my');
        const spoken = squash(flatten(narrationFor(loc, { lang: 'my' })));
        for (const [en, my] of distinct(VISIBLE[screen.type](screen, loc))) {
          // A translation that quotes its own English ("Constitution — 1787
          // (…)") speaks it as part of the Burmese — that is the translation.
          if (squash(my).includes(squash(en))) continue;
          if (squash(en).length > 20 && spoken.includes(squash(en))) leaks.push(`${screen.id}: "${en.slice(0, 40)}"`);
        }
      }
    }
    expect(leaks, leaks.join('\n')).toEqual([]);
  });
});
