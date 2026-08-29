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
  // Not pinned to one screen id. U0-S01 was this test's example, then got
  // fixed and had to be swapped for U0-S04 as its own predecessor, which had
  // already been swapped for U0-S01 — every fix here breaks the test that
  // proved the mechanism, on a field that has nothing to do with the fix.
  // Derived instead: whichever fields the build currently reports stale
  // (there is always at least one — TRANSLATION-REQUEST.md lists them) prove
  // the same property, and stay proof after the next one is fixed too.
  const UNITS_BY_FILE = { unit0, unit1, unit2, unit3, unit4, unit5, unit6, unit7 };
  const OVERLAYS_BY_FILE = { unit0: myUnit0, unit1: myUnit1, unit2: myUnit2, unit3: myUnit3,
    unit4: myUnit4, unit5: myUnit5, unit6: myUnit6, unit7: myUnit7 };

  it('a field currently reported stale falls back to English', () => {
    let checked = 0;
    for (const [file, screens] of Object.entries(freshness.my)) {
      const unit = UNITS_BY_FILE[file];
      for (const [screenId, fields] of Object.entries(screens)) {
        const screen = unit.screens.find((s) => s.id === screenId);
        for (const [field, record] of Object.entries(fields)) {
          if (typeof screen?.[field] !== 'string') continue;
          if (record.en === textHash(screen[field])) continue; // current, not stale

          checked += 1;
          // The third argument is the freshness map for the WHOLE screen — it
          // looks itself up by field name — not one field's own {en, my}
          // record. Passing `record` here made this test fail on real, working
          // code: with no `afterQuote` key inside `record` to find, the lookup
          // came back empty and localiseWith treated it as "no record", not
          // "stale", and let the old Burmese through.
          const out = localiseWith(screen, OVERLAYS_BY_FILE[file][screenId], fields);
          expect(out[field], `${file} ${screenId}.${field}`).toBe(screen[field]);
          expect(isBurmese(out[field]), `${file} ${screenId}.${field} rendered Burmese while stale`).toBe(
            false
          );
        }
      }
    }
    expect(checked, 'nothing is stale, so this proved nothing').toBeGreaterThan(0);
  });

  it('U0-S04 is fixed: current, and renders Burmese', () => {
    // The positive half of the same fact. A regression here means either the
    // English moved again without a new translation, or freshness lost the
    // record — QA check 23 guards the second case directly.
    const s04 = unit0.screens.find((s) => s.id === 'U0-S04');
    const record = freshness.my.unit0['U0-S04'];

    expect(record?.body).toBeTruthy();
    expect(record.body.en).toBe(textHash(s04.body));

    const out = localiseWith(s04, myUnit0['U0-S04'], record);
    expect(isBurmese(out.body)).toBe(true);
  });

  it('every stale field is asked for again, as a revision carrying its old Burmese', () => {
    // Falling back to English is only half of it. The other half is the
    // translator ever finding out — and a stale row used to look exactly like
    // a never-translated one, so the fix was to retype from scratch a line
    // already delivered, with no way to see what about the English changed.
    //
    // Derived from the data rather than from a list, so it fails if the
    // generator regresses OR if one artefact is regenerated without the other.
    const OVERLAYS = { unit0: myUnit0, unit1: myUnit1, unit2: myUnit2, unit3: myUnit3,
      unit4: myUnit4, unit5: myUnit5, unit6: myUnit6, unit7: myUnit7 };
    const stale = [];

    for (const [file, screens] of Object.entries(freshness.my)) {
      const english = UNITS.find((u) => `unit${u.id[1]}` === file);
      for (const [screenId, fields] of Object.entries(screens)) {
        const screen = english?.screens.find((s) => s.id === screenId);
        for (const [field, record] of Object.entries(fields)) {
          // `items` is a list, and the request keys it per item — outside the
          // scalar contract this asserts. None is stale today.
          if (typeof screen?.[field] !== 'string') continue;
          if (record.en !== textHash(screen[field])) stale.push([file, screenId, field]);
        }
      }
    }

    expect(stale.length, 'nothing is stale, so this asserts nothing').toBeGreaterThan(0);
    for (const [file, screenId, field] of stale) {
      const entry = source[`${screenId}.${field}`];
      expect(entry, `${screenId}.${field} is stale but absent from the request`).toBeTruthy();
      expect(
        entry.previousMy,
        `${screenId}.${field} is asked for as new work — the translator loses what they sent`
      ).toBe(OVERLAYS[file][screenId][field]);
      expect(entry.english, `${screenId}.${field} must carry the CURRENT English`).toBeTruthy();
    }
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
