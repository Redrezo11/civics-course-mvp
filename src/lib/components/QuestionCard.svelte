<script>
  // Renders official USCIS question text. This visual register (heavy
  // border + Q tag) must be used ONLY for verbatim official wording —
  // never for practice/paraphrase text. That distinction is what teaches
  // the learner to recognise the real interview's register on sight.
  //
  // In Burmese mode the Burmese sits beneath the English, smaller and grey —
  // the same shape as an answer gloss (AnswerLabel), because the English line
  // is the one the officer will say.
  import { glossOfficial } from '../i18n.js';

  export let text;

  $: gloss = $glossOfficial(text);
</script>

<div class="question-card">
  <!--
    Decorative. The "Q" is a visual register marker — it is how the heavy-border
    card announces "this is verbatim official wording" at a glance. Spoken, it
    is a bare letter before every question, which tells a screen-reader user
    nothing and interrupts the question itself.
  -->
  <span class="question-tag" aria-hidden="true">Q</span>
  <p class="text-base font-bold leading-snug m-0" lang="en">{text}</p>
  {#if gloss}
    <p
      class="m-0 mt-1 text-sm font-normal leading-relaxed text-ink-secondary dark:text-dark-ink-secondary"
      lang="my">{gloss}</p>
  {/if}
</div>
