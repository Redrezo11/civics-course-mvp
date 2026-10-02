/**
 * Official questions and answers carry Burmese beneath them in Burmese mode.
 *
 * Reported 2026-10-02 from a phone: on U2-S10 the answer options showed English
 * with Burmese beneath, while the official question above them sat alone in
 * English. G-3 had been read as "official wording is never translated", so the
 * 128 questions, their options and their accepted answers never had Burmese at
 * all — the one part of the course a Burmese learner most needed to understand.
 *
 * G-3 still holds where it matters: the English is always shown, always first,
 * and is what read-aloud speaks first. The Burmese is a gloss beneath it, the
 * same shape every other answer in the course already had.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';

import GuidedPractice from '../src/lib/components/GuidedPractice.svelte';
import QuestionCard from '../src/lib/components/QuestionCard.svelte';
import PracticeItem from '../src/lib/components/PracticeItem.svelte';
import QuestionBank from '../src/lib/screens/QuestionBank.svelte';
import { progress } from '../src/lib/stores/progress.js';
import { cancel } from '../src/lib/narration.js';
import { officialGloss, localiseScreen } from '../src/lib/i18n.js';
import unit2 from '../src/lib/content/unit2.json';
import { practiceSegments } from '../src/lib/narration-text.js';
import { getQuestion, presentOptions } from '../src/lib/content/questions.js';
import glossFile from '../src/lib/content/translations/official-glosses-my.json';

import q1 from '../src/lib/content/questions-u1.json';
import q2 from '../src/lib/content/questions-u2.json';
import q3 from '../src/lib/content/questions-u3.json';
import q4 from '../src/lib/content/questions-u4.json';
import q5 from '../src/lib/content/questions-u5.json';
import q6 from '../src/lib/content/questions-u6.json';
import q7 from '../src/lib/content/questions-u7.json';

const QUESTIONS = [q1, q2, q3, q4, q5, q6, q7].flat();
const isBurmese = (s) => /[က-႟]/.test(String(s));

beforeEach(() => {
  progress.resetAll();
  cancel();
  window.location.hash = '';
});

describe('every official string has Burmese', () => {
  it('found all 128 questions', () => expect(QUESTIONS.length).toBe(128));

  it('every question, answer option and accepted answer has a Burmese gloss', () => {
    const missing = [];
    for (const q of QUESTIONS) {
      const strings = [q.official, ...(q.dynamic ? [] : [...(q.options || []), ...(q.acceptedAnswers || [])])];
      for (const s of strings) if (!isBurmese(officialGloss(s, 'my'))) missing.push(`${q.id}: ${s}`);
    }
    expect(missing, missing.join('\n')).toEqual([]);
  });

  it('carries no gloss for text that is not official wording', () => {
    const official = new Set(QUESTIONS.flatMap((q) => [q.official, ...(q.options || []), ...(q.acceptedAnswers || [])]));
    const strays = Object.keys(glossFile.glosses).filter((k) => !official.has(k));
    expect(strays, strays.join('\n')).toEqual([]);
  });

  it('never returns Burmese in English mode', () => {
    expect(officialGloss(QUESTIONS[0].official, 'en')).toBe('');
  });
});

describe('the Q box', () => {
  const q = getQuestion('Q15');

  it('shows the English, then the Burmese, in Burmese mode', () => {
    progress.setLanguage('my');
    const { container } = render(QuestionCard, { props: { text: q.official } });
    const en = container.querySelector('[lang="en"]');
    const my = container.querySelector('[lang="my"]');
    expect(en.textContent).toBe(q.official);
    expect(isBurmese(my.textContent)).toBe(true);
    expect(en.compareDocumentPosition(my) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows the English alone in English mode', () => {
    progress.setLanguage('en');
    const { container } = render(QuestionCard, { props: { text: q.official } });
    expect(container.querySelector('[lang="my"]')).toBeNull();
    expect(container.textContent).toContain(q.official);
  });

  it('U2-S10 — the reported screen — glosses its question card', async () => {
    // The guided item that quotes Q15 in a Q box above bilingual options,
    // rendered on its own: the same component and the same localised data,
    // without clicking through the three items before it.
    progress.setLanguage('my');
    const screen = unit2.screens.find((s) => s.id === 'U2-S10');
    const loc = localiseScreen(screen, 'U2', 'my');
    const i = screen.items.findIndex((it) => it.cardText === q.official);
    expect(i, 'U2-S10 no longer quotes Q15').toBeGreaterThanOrEqual(0);
    const { container } = render(GuidedPractice, { props: { items: [loc.items[i]], english: [screen.items[i]] } });
    await tick();
    const card = container.querySelector('.question-card');
    expect(card, 'U2-S10 never reached its Q box').toBeTruthy();
    expect(card.textContent).toContain(q.official);
    expect(isBurmese(card.querySelector('[lang="my"]')?.textContent)).toBe(true);
  });
});

describe('official practice', () => {
  const single = QUESTIONS.find((q) => !q.dynamic && !q.multiSelect);
  const multi = QUESTIONS.find((q) => q.multiSelect);

  for (const [label, q] of [['single-select', single], ['multi-select', multi]]) {
    it(`${label} (${q.id}) glosses every option in Burmese mode`, () => {
      progress.setLanguage('my');
      const { container } = render(PracticeItem, { props: { q } });
      for (const opt of presentOptions(q).options) {
        const btn = [...container.querySelectorAll('button')].find((b) => b.textContent.includes(opt));
        expect(btn, `${q.id}: no button for "${opt}"`).toBeTruthy();
        expect(isBurmese(btn.querySelector('[lang="my"]')?.textContent), `${q.id}: "${opt}" has no Burmese`).toBe(true);
      }
    });

    it(`${label} (${q.id}) shows no Burmese in English mode`, () => {
      progress.setLanguage('en');
      const { container } = render(PracticeItem, { props: { q } });
      expect(container.querySelector('[lang="my"]')).toBeNull();
    });
  }
});

describe('the question bank', () => {
  it('glosses the question and every accepted answer in Burmese mode', async () => {
    progress.setLanguage('my');
    const q = getQuestion('Q15');
    const { container } = render(QuestionBank);
    const row = [...container.querySelectorAll('button')].find((b) => b.textContent.includes(q.official));
    expect(isBurmese(row.textContent)).toBe(true);
    await fireEvent.click(row);
    const burmese = [...container.querySelectorAll('[lang="my"]')].map((e) => e.textContent).join(' | ');
    for (const a of q.acceptedAnswers) expect(burmese).toContain(officialGloss(a, 'my'));
  });
});

describe('read-aloud keeps the English first', () => {
  const q = getQuestion('Q15');
  const gloss = (t) => officialGloss(t, 'my');

  it('speaks the official question in English, then its Burmese', () => {
    const segs = practiceSegments({ official: q.official, questionId: q.id, presented: presentOptions(q), lang: 'my', gloss });
    const i = segs.findIndex((s) => s.text === q.official);
    expect(segs[i].lang).toBe('en');
    expect(segs[i + 1]).toEqual({ text: gloss(q.official), lang: 'my' });
  });

  it('speaks each option in English, then its Burmese', () => {
    const presented = presentOptions(q);
    const segs = practiceSegments({ official: q.official, presented, lang: 'my', gloss });
    for (const opt of presented.options) {
      const i = segs.findIndex((s) => s.text.endsWith(opt));
      expect(segs[i].lang, opt).toBe('en');
      expect(segs[i + 1].text).toBe(gloss(opt));
    }
  });

  it('speaks no Burmese without a gloss lookup (English mode)', () => {
    const segs = practiceSegments({ official: q.official, presented: presentOptions(q), lang: 'en' });
    expect(segs.some((s) => isBurmese(s.text))).toBe(false);
  });
});
