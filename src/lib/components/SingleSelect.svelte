<script>
  // Primary assessment mechanism as of storyboard v5.0. Distractors are
  // always wrong-category, never plausible false facts — repeated exposure
  // to a wrong option must never teach an error (see coverage matrix rules).
  //
  // Feedback leads with the correct answer first, per G-20 — a wrong
  // selection should never make the learner hunt through an explanation
  // to find out what the right answer actually was.

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  export let options = [];
  export let correctIndex = 0;
  export let correctAnswerText = ''; // used in feedback when option wording differs from acceptedAnswers[0]
  export let feedbackExplain = '';   // optional explanation appended after "The correct answer is X."

  let selected = null;
  let answered = false;

  function select(i) {
    if (answered) return;
    selected = i;
    answered = true;
    dispatch('answer', { correct: i === correctIndex, index: i });
  }
</script>

<div>
  {#each options as opt, i}
    <button
      class="block w-full text-left py-2.5 px-4 mb-2.5 rounded-full font-bold text-sm border-2 transition-colors
        {answered && i === correctIndex ? 'bg-gotit-bg dark:bg-dark-gotit-bg border-gotit dark:border-dark-gotit text-ink dark:text-dark-ink' : ''}
        {answered && i !== correctIndex ? 'border-border-interactive dark:border-dark-border-interactive text-ink-muted dark:text-dark-ink-muted opacity-60' : ''}
        {!answered ? 'border-border-interactive dark:border-dark-border-interactive text-ink dark:text-dark-ink' : ''}"
      on:click={() => select(i)}
      disabled={answered}
    >
      {#if answered && i === correctIndex}✓ {/if}{opt}
    </button>
  {/each}

  {#if answered}
    <div class="mt-3 p-3 rounded-card border border-border dark:border-dark-border text-sm leading-relaxed">
      <span class="font-bold">The correct answer is {correctAnswerText || options[correctIndex]}.</span>
      {#if feedbackExplain} {feedbackExplain}{/if}
    </div>
  {/if}
</div>
