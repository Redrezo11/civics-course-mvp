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
  // Not spoken directly — narrationFor() in Lesson-style callers filters this
  // to the segment matching the learner's language and speaks that one alone.
  // Welcome had been speaking (and showing) English regardless of the language
  // chosen on the screen immediately before it, because nothing here read
  // $progress.language at all.
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
      {
        lang: 'my',
        text:
          'ကြိုဆိုပါသည်။ ဤသင်တန်းသည် အမေရိကန် နိုင်ငံသားခံယူခြင်း civics ' +
          'စာမေးပွဲရှိ မေးခွန်း ၁၂၈ ခုလုံးကို သင့်နေ့စဉ်ဘဝနှင့် အဆင်ပြေအောင် ' +
          'ချိန်ညှိနိုင်သည့် သင်ခန်းစာတိုများဖြင့် လွှမ်းခြုံပါသည်။',
      },
    ],
  },

  language: {
    label: 'Language choice — the first screen',
    recordable: true,
    // The ONLY narration in the app meant to be read in both languages, in one
    // pass. Nobody has chosen a language yet, so there is no "current language"
    // to narrate in — a learner who cannot read either script is otherwise
    // stuck before the course starts, on the one screen where falling back to
    // English is no help, because English may be the problem.
    //
    // `bilingual: true` marks that on purpose. Every other multi-language entry
    // in this registry is one screen's text in two languages, meant to be
    // filtered down to ONE before it is spoken — this is the single exception,
    // and callers must check the flag rather than assume from the segment
    // shape.
    bilingual: true,
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
    // One screen in two languages, filtered to one before it is spoken — not
    // bilingual in the sense `language` is. The Burmese exists because this
    // screen states the pass mark, and a learner who cannot read the rules
    // cannot follow them.
    segments: [
      {
        lang: 'en',
        text:
          'This is practice for the real interview. At the real interview you will ' +
          'hear these questions. Here you read them — and answer out loud, the same ' +
          'way. No choices, no hints. Then check yourself. The rules are the real ' +
          'rules: up to 20 questions. 12 right passes. 9 wrong stops.',
      },
      {
        lang: 'my',
        text:
          'ဤသည်မှာ တကယ့်အင်တာဗျူးအတွက် လေ့ကျင့်ခန်း ဖြစ်သည်။ တကယ့်အင်တာဗျူးတွင် ' +
          'ဤမေးခွန်းများကို သင် ကြားရမည်။ ဤနေရာတွင် ဖတ်ရပြီး — အသံထွက်၍ ထိုနည်းအတိုင်း ' +
          'ဖြေပါ။ ရွေးချယ်စရာ မရှိ၊ အရိပ်အမြွက် မရှိ။ ထို့နောက် ကိုယ်တိုင် စစ်ဆေးပါ။ ' +
          'စည်းမျဉ်းများသည် တကယ့်စည်းမျဉ်းများ ဖြစ်သည် — မေးခွန်း ၂၀ ခုအထိ။ ' +
          '၁၂ ခု မှန်လျှင် အောင်မြင်သည်။ ၉ ခု မှားလျှင် ရပ်သည်။',
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
