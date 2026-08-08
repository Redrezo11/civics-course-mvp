<script>
  // Renders official USCIS question text. This visual register (heavy
  // border + Q tag) must be used ONLY for verbatim official wording —
  // never for practice/paraphrase text. That distinction is what teaches
  // the learner to recognise the real interview's register on sight.
  export let text;
</script>

<div class="question-card">
  <span class="question-tag">Q</span>
  <p class="text-base font-bold leading-snug m-0">{text}</p>
</div>
