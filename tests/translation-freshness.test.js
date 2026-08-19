/**
 * Translation freshness, and the copy bug that revealed the need for it.
 *
 * U0-S04 told the learner "read it, and answer out loud" and then rendered
 * three tappable options. Its Burmese said so too — so a Burmese learner was
 * given an instruction the screen could not accept, in a language nobody
 * reviewing the English would have checked.
 *
 * Fixing the English alone would have left the Burmese saying the old thing
 * indefinitely. Nothing errors when that happens; nothing blanks. These tests
 * cover both halves: the copy, and the mechanism that notices next time.
 */

import { describe, it, expect } from 'vitest';

import { localiseWith } from '../src/lib/localise.js';
import { textHash } from '../src/lib/text-hash.js';
import freshness from '../src/lib/content/translations/freshness.json';
import myUnit0 from '../src/lib/content/translations/my/unit0.json';

import unit0 from '../src/lib/content/unit0.json';
import unit1 from '../src/lib/content/unit1.json';
import unit2 from '../src/lib/content/unit2.json';
import unit3 from '../src/lib/content/unit3.json';
import unit4 from '../src/lib/content/unit4.json';
import unit5 from '../src/lib/content/unit5.json';
import unit6 from '../src/lib/content/unit6.json';
import unit7 from '../src/lib/content/unit7.json';

const UNITS = [unit0, unit1, unit2, unit3, unit4, unit5, unit6, unit7];
const isBurmese = (s) => /[က-႟]/.test(s);

// Screen types that hand the learner options to tap. An instruction to answer
// out loud is a contradiction on any of these.
const HAS_OPTIONS = new Set(['practice', 'tryOne', 'hook', 'guidedPractice']);

describe('no screen asks for an answer it cannot accept', () => {
  it('never instructs an oral answer on a screen with tappable options', () => {
    // Rehearsal DOES ask for an answer out loud, and is right to: it is free
    // recall with no options at all. This is only about screens that contradict
    // themselves.
    const ORAL = /\b(out loud|aloud|say it|say your answer)\b/i;
    const offenders = [];

    for (const unit of UNITS) {
      for (const screen of unit.screens) {
        if (!HAS_OPTIONS.has(screen.type)) continue;
        for (const [field, value] of Object.entries(screen)) {
          if (typeof value === 'string' && ORAL.test(value)) {
            offenders.push(`${screen.id}.${field}: "${value}"`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('still teaches that the real interview is spoken', () => {
    // The fix must not remove the fact that the test is oral — that is what
    // U0-S02 is for, and it is the reason the course exists in this shape.
    const s02 = unit0.screens.find((s) => s.id === 'U0-S02');
    expect(s02.body).toMatch(/out loud/);
  });

  it('U0-S04 asks the learner to choose', () => {
    const s04 = unit0.screens.find((s) => s.id === 'U0-S04');
    expect(s04.body).toMatch(/choose/i);
    expect(s04.body).not.toMatch(/out loud/i);
  });
});

describe('a translation of English that has changed', () => {
  const screen = { id: 'X-1', type: 'info', body: 'The original English.' };
  const overlay = { body: 'မြန်မာဘာသာ စာသား' };

  it('falls back to English rather than showing the stale translation', () => {
    const stale = { body: { en: textHash('Something else entirely.'), my: textHash(overlay.body) } };
    const out = localiseWith(screen, overlay, stale);
    expect(out.body).toBe('The original English.');
  });

  it('still renders the translation while the English is unchanged', () => {
    const fresh = { body: { en: textHash(screen.body), my: textHash(overlay.body) } };
    const out = localiseWith(screen, overlay, fresh);
    expect(out.body).toBe(overlay.body);
  });

  it('does not treat punctuation or capitalisation as a rewrite', () => {
    // Fixing a comma must never cost a retranslation.
    const record = { body: { en: textHash('the original english'), my: textHash(overlay.body) } };
    const out = localiseWith({ ...screen, body: 'The original English!' }, overlay, record);
    expect(out.body).toBe(overlay.body);
  });

  it('renders the translation when there is no record at all', () => {
    // Absence of a record is not evidence of staleness — an overlay built
    // before this mechanism existed must keep working.
    expect(localiseWith(screen, overlay, null).body).toBe(overlay.body);
    expect(localiseWith(screen, overlay, {}).body).toBe(overlay.body);
  });
});

describe('the real case', () => {
  it('U0-S04 is recorded as stale, and renders English', () => {
    const s04 = unit0.screens.find((s) => s.id === 'U0-S04');
    const record = freshness.my.unit0['U0-S04'];

    expect(record?.body, 'no freshness record for the string that prompted this').toBeTruthy();
    expect(record.body.en, 'the record was re-baselined against the new English').not.toBe(
      textHash(s04.body)
    );

    const out = localiseWith(s04, myUnit0['U0-S04'], record);
    expect(out.body).toBe(s04.body);
    expect(isBurmese(out.body)).toBe(false);
  });

  it('leaves the rest of Unit 0 in Burmese', () => {
    let burmese = 0;
    for (const screen of unit0.screens) {
      const fields = myUnit0[screen.id];
      if (!fields?.body) continue;
      const out = localiseWith(screen, fields, freshness.my.unit0[screen.id]);
      if (isBurmese(out.body)) burmese += 1;
    }
    expect(burmese, 'the guard swallowed more than the one stale field').toBeGreaterThan(2);
  });
});
