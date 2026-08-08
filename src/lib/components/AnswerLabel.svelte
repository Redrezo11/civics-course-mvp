<script>
  // An answer, with its translation underneath.
  //
  // Everything the learner taps as an ANSWER shows English first. The officer
  // conducts the interview in English, so an answer met only in Burmese is an
  // answer the learner cannot give — and the practice that was supposed to
  // prepare them for the question instead prepares them for a phrasing no one
  // will use. The Burmese carries the meaning; the English carries the skill.
  //
  // Used by every answer surface: multiple-choice options, sort bucket labels,
  // sort chips and ordering cards. Teaching prose, questions and instructions
  // are NOT answers and stay fully translated — they do not come through here.

  export let text = '';
  export let gloss = '';
  /** Extra classes for the English line, so callers keep their own sizing. */
  export let textClass = '';
</script>

<span class="block">
  <span class="block {textClass}"><slot />{text}</span>
  {#if gloss}
    <!--
      Deliberately NOT set smaller. Burmese stacks its vowel marks above and
      below the consonant, and under about 14px those marks collapse into each
      other — it stops being readable rather than merely small. The hierarchy is
      carried by weight and colour instead.

      text-sm is stated rather than inherited on purpose: several callers sit
      inside text-xs containers (the sort buckets and chips), and inheriting
      12px there is exactly the size where the marks stop resolving.

      ink-secondary, not ink-muted: the lighter grey measures 4.38:1 against the
      answered-correct green in dark mode, under the 4.5 floor. This token holds
      6.21:1 at its worst and still reads as a clearly different colour from the
      English beside it.

      lang="my" is what switches a screen reader's voice and scopes the bundled
      Myanmar font to the characters that need it.
    -->
    <span
      class="block mt-0.5 text-sm font-normal leading-relaxed text-ink-secondary dark:text-dark-ink-secondary"
      lang="my">{gloss}</span>
  {/if}
</span>
