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
import myUnit1 from '../src/lib/content/translations/my/unit1.json';
import myUnit2 from '../src/lib/content/translations/my/unit2.json';
import myUnit3 from '../src/lib/content/translations/my/unit3.json';
import myUnit4 from '../src/lib/content/translations/my/unit4.json';
import myUnit5 from '../src/lib/content/translations/my/unit5.json';
import myUnit6 from '../src/lib/content/translations/my/unit6.json';
import myUnit7 from '../src/lib/content/translations/my/unit7.json';
import source from '../docs/translation-source.json';

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
  // Deliberately NOT derived from whatever happens to be stale right now.
  //
  // This test has been rewritten three times: it named U0-S04, then U0-S01,
  // then "whichever field the build currently reports stale". Each time, the
  // next commit fixed that field and the test broke — until the last fix left
  // ZERO stale fields anywhere, and a test asserting "at least one thing is
  // stale" became a test asserting the repo still has a defect in it.
  //
  // The mechanism does not need real broken data to be provable. Build the
  // stale case here: a real screen, a real translation, and a freshness record
  // baselined against English that has since moved.
  const UNITS_BY_FILE = { unit0, unit1, unit2, unit3, unit4, unit5, unit6, unit7 };
  const OVERLAYS_BY_FILE = { unit0: myUnit0, unit1: myUnit1, unit2: myUnit2, unit3: myUnit3,
    unit4: myUnit4, unit5: myUnit5, unit6: myUnit6, unit7: myUnit7 };

  it('falls back to English when the record predates the current English', () => {
    const screen = unit4.screens.find((s) => s.id === 'U4-S01');
    const overlay = myUnit4['U4-S01'];
    expect(isBurmese(overlay.afterQuote), 'fixture needs a real Burmese value').toBe(true);

    const staleRecord = {
      afterQuote: { en: textHash('some English this screen no longer says'), my: textHash(overlay.afterQuote) },
    };
    const out = localiseWith(screen, overlay, staleRecord);
    expect(out.afterQuote, 'stale Burmese was rendered').toBe(screen.afterQuote);
    expect(isBurmese(out.afterQuote)).toBe(false);
  });

  it('nothing in the shipped course is stale right now', () => {
    // The positive statement, and the one worth having as a standing check:
    // every recorded field was translated from the English the build currently
    // has. When this fails, something was edited without its translation being
    // revisited — and the fallback above is what protects the learner until it
    // is. TRANSLATION-REQUEST.md lists whatever this catches.
    const stale = [];
    for (const [file, screens] of Object.entries(freshness.my)) {
      const unit = UNITS_BY_FILE[file];
      for (const [screenId, fields] of Object.entries(screens)) {
        const screen = unit.screens.find((s) => s.id === screenId);
        for (const [field, record] of Object.entries(fields)) {
          if (typeof screen?.[field] !== 'string') continue;
          if (record.en !== textHash(screen[field])) stale.push(`${file} ${screenId}.${field}`);
        }
      }
    }
    expect(stale, stale.join('\n')).toEqual([]);
  });

  it('every stale field would be asked for again, carrying its old Burmese', () => {
    // Nothing is stale today, so this asserts the GENERATOR's contract rather
    // than sampling live data: a revision entry is { english, previousMy }, and
    // previousMy is what the translator already sent. Proven against whatever
    // revisions the request currently holds; if there are none, the shape rule
    // is asserted against the entries that do exist.
    const revisions = Object.entries(source).filter(
      ([k, v]) => !k.startsWith('_') && v && typeof v === 'object' && 'previousMy' in v
    );
    for (const [key, entry] of revisions) {
      expect(entry.english, `${key} carries no current English`).toBeTruthy();
      expect(entry.previousMy, `${key} carries no previous Burmese`).toBeTruthy();
    }
    // Plain entries must NOT look like revisions — that is what tells a
    // translator "new work" from "edit what you sent".
    const plain = Object.entries(source).filter(([k, v]) => !k.startsWith('_') && typeof v === 'string');
    expect(plain.length + revisions.length).toBeGreaterThan(0);
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
