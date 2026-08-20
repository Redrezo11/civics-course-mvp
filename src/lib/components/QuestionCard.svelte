<script>
  // Renders official USCIS question text. This visual register (heavy
  // border + Q tag) must be used ONLY for verbatim official wording —
  // never for practice/paraphrase text. That distinction is what teaches
  // the learner to recognise the real interview's register on sight.
  export let text;
</script>

<div class="question-card">
  <!--
    Decorative. The "Q" is a visual register marker — it is how the heavy-border
    card announces "this is verbatim official wording" at a glance. Spoken, it
    is a bare letter before every question, which tells a screen-reader user
    nothing and interrupts the question itself.
  -->
  <span class="question-tag" aria-hidden="true">Q</span>
  <p class="text-base font-bold leading-snug m-0">{text}</p>
</div>
