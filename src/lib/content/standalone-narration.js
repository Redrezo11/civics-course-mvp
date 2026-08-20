// standalone-narration.js — narration for screens that are not unit page data.
//
// Unit screens derive their narration from the fields they render, so the two
// cannot disagree. These screens have their prose in the markup, so they need a
// registry — and until now there were TWO: one in the components, one in
// scripts/audio-assets.js, plus a third list of valid ids in scripts/qa-check.js.
//
// They drifted immediately. `epitome` and `completion` were added to the QA list
// and not to the audio script, so a recording named epitome.mp3 passed the gate,
// never reached the manifest, and would have silently never played. This module
// is the one list all three now read.
//
// Deliberately free of imports so Node scripts can read it. That is also why the
// Burmese below is a literal rather than a lookup into ui-strings.json — a test
// asserts the two match, so they cannot drift apart.

/**
 * `recordable: false` means the narration contains values that change at
 * runtime — a score, a count, how much of a screen has been revealed.
 *
 * Those screens are speech-only, and the audio map must NOT list them. Offering
 * a filename for one would invite somebody to record a tally that is wrong the
 * moment a learner answers a question, and the freshness hash could not catch
 * it, because the text differs per learner rather than per edit.
 */
export const STANDALONE_NARRATION = {
  welcome: {
    label: 'Welcome screen',
    recordable: true,
    segments: [
      {
        lang: 'en',
        text:
          'Welcome. This course covers all 128 questions on the U.S. citizenship ' +
          'civics test, in short lessons you can fit around your day.',
      },
    ],
  },

  language: {
    label: 'Language choice — the first screen',
    recordable: true,
    // The only narration in the app that is deliberately bilingual.
    //
    // Nobody has chosen a language yet, so there is no "current language" to
    // narrate in. A learner who cannot read either script is otherwise stuck
    // before the course starts — on the one screen where the fallback to
    // English is no help, because English may be the problem.
    segments: [
      { lang: 'en', text: 'Choose your language.' },
      { lang: 'my', text: 'သင့်ဘာသာစကားကို ရွေးချယ်ပါ။' },
      { lang: 'en', text: 'You can change this anytime in Settings.' },
      { lang: 'my', text: 'ဤအရာကို ဆက်တင်များတွင် အချိန်မရွေး ပြောင်းလဲနိုင်ပါသည်။' },
    ],
  },

  'rehearsal-intro': {
    label: 'Rehearsal — the rules',
    recordable: true,
    segments: [
      {
        lang: 'en',
        text:
          'This is practice for the real interview. At the real interview you will ' +
          'hear these questions. Here you read them — and answer out loud, the same ' +
          'way. No choices, no hints. Then check yourself. The rules are the real ' +
          'rules: up to 20 questions. 12 right passes. 9 wrong stops.',
      },
    ],
  },

  // --- Speech only: the narration carries live values -----------------------

  epitome: {
    label: 'How America works',
    // Reveals one line at a time, so what is on screen — and therefore what may
    // be spoken — depends on how far the learner has got.
    recordable: false,
  },
  'rehearsal-end': { label: 'Rehearsal result', recordable: false },
  'fullbank-entry': { label: 'Full practice set — start', recordable: false },
  'fullbank-end': { label: 'Full practice set — finished', recordable: false },
  'review-end': { label: 'Review finished', recordable: false },
  completion: { label: 'Course completion', recordable: false },
};

/** Ids a recording may legitimately be named after. */
export const RECORDABLE_STANDALONE = Object.entries(STANDALONE_NARRATION)
  .filter(([, v]) => v.recordable)
  .map(([id]) => id);

/** Every standalone id, recordable or not — what QA accepts as a screen. */
export const STANDALONE_IDS = Object.keys(STANDALONE_NARRATION);
