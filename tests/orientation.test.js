/**
 * The screens that introduce a lesson.
 *
 * Two of them were written twice. `U0-S01` repeated the /welcome paragraph word
 * for word, so pressing Start appeared to do nothing but change the
 * illustration; and `afterQuote` — the line under the sample question card —
 * was one sentence shared by six of the seven orientation screens, saying the
 * same nothing in every unit.
 *
 * QA check 20 is the guard against either coming back. These pin the specific
 * facts about this course that the guard states only generically.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';

import Lesson from '../src/lib/screens/Lesson.svelte';
import Welcome from '../src/lib/screens/Welcome.svelte';
import { progress } from '../src/lib/stores/progress.js';

import unit0 from '../src/lib/content/unit0.json';
import unit1 from '../src/lib/content/unit1.json';
import unit2 from '../src/lib/content/unit2.json';
import unit3 from '../src/lib/content/unit3.json';
import unit4 from '../src/lib/content/unit4.json';
import unit5 from '../src/lib/content/unit5.json';
import unit6 from '../src/lib/content/unit6.json';
import unit7 from '../src/lib/content/unit7.json';

import q1 from '../src/lib/content/questions-u1.json';
import q2 from '../src/lib/content/questions-u2.json';
import q3 from '../src/lib/content/questions-u3.json';
import q4 from '../src/lib/content/questions-u4.json';
import q5 from '../src/lib/content/questions-u5.json';
import q6 from '../src/lib/content/questions-u6.json';
import q7 from '../src/lib/content/questions-u7.json';

const UNITS = [unit1, unit2, unit3, unit4, unit5, unit6, unit7];
const BANKS = [q1, q2, q3, q4, q5, q6, q7];

beforeEach(() => {
  progress.resetAll();
  window.location.hash = '';
});

describe('Test day opens on Test day, not on the welcome again', () => {
  it('does not repeat the paragraph /welcome renders', () => {
    // Read from the rendered Welcome screen rather than pasting the sentence
    // here, so the two cannot quietly converge again behind a test that only
    // ever compares the content to itself.
    const welcomeProse = render(Welcome, {}).container.textContent;
    const opener = unit0.screens[0];

    expect(welcomeProse).toContain('128 questions');
    expect(welcomeProse).not.toContain(opener.body);
  });

  it('introduces the interview and begins the lesson', () => {
    const { container } = render(Lesson, { props: { unitId: 'U0' } });
    expect(container.textContent).toContain('Test day');
    expect(container.querySelector('.btn-primary').textContent.trim()).toBe('Begin');
  });
});

describe('every orientation screen says something of its own', () => {
  it('has seven different afterQuote lines', () => {
    const quotes = UNITS.map((u) => u.screens[0].afterQuote);
    expect(quotes.filter(Boolean)).toHaveLength(7);
    expect(new Set(quotes).size, `repeated: ${quotes.join(' / ')}`).toBe(7);
  });

  it('never falls back to the sentence that used to be on six of them', () => {
    for (const u of UNITS) {
      expect(u.screens[0].afterQuote).not.toBe('This lesson will help you answer those questions.');
    }
  });
});

describe('the coverage boxes are honest', () => {
  // True today and untested today. The number is the promise a learner uses to
  // decide the course is complete, so it has to be the size of the bank rather
  // than a number someone typed.
  it('each unit claims exactly as many questions as it has', () => {
    for (const [i, u] of UNITS.entries()) {
      const n = BANKS[i].length;
      expect(u.questionCount, `${u.id} questionCount`).toBe(n);
      expect(u.screens[0].coverageLine, `${u.id} coverage line`).toContain(String(n));
    }
  });

  it('and the seven add up to 128', () => {
    expect(UNITS.reduce((n, u) => n + u.questionCount, 0)).toBe(128);
  });
});

describe('one picture, one description', () => {
  // Alt text describes the file, not the screen. The Constitution photograph
  // had drifted into three descriptions across three screens, one of which
  // stated a fact about the Bill of Rights that is nowhere in the image.
  it('never describes the same image two ways', () => {
    const seen = new Map();
    for (const u of [unit0, ...UNITS]) {
      for (const s of u.screens) {
        const slots = [
          [s.image, s.alt],
          ...(s.twoColumn || []).map((c) => [c.image, c.alt]),
          ...(s.imageRow || []).map((p) => [p.image, p.alt]),
        ];
        for (const [image, alt] of slots) {
          if (!image || !alt) continue;
          if (seen.has(image)) {
            expect(alt, `${image} on ${s.id}`).toBe(seen.get(image));
          } else seen.set(image, alt);
        }
      }
    }
    expect(seen.size).toBeGreaterThan(5);
  });
});
