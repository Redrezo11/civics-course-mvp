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
    <!--
      Three states after answering, not two. `selected` was tracked but never
      read here, so a learner who chose wrongly saw their own answer dimmed
      exactly like the options they did NOT choose — the app showed the right
      answer but never showed them what they had done. Knowing which one you
      picked is the most useful part of feedback.

      State is carried by icon AND word AND colour, never colour alone (§8):
      the ✓ side takes its word from the feedback box below, so the ✗ side
      carries "your answer" on the option itself.
    -->
    {@const isCorrect = i === correctIndex}
    {@const isWrongPick = answered && i === selected && !isCorrect}
    <button
      class="tap flex items-center gap-2 w-full text-left py-2.5 px-4 mb-2.5 rounded-full font-bold text-sm border-2 transition-colors
        {answered && isCorrect ? 'bg-gotit-bg dark:bg-dark-gotit-bg border-gotit dark:border-dark-gotit text-ink dark:text-dark-ink' : ''}
        {isWrongPick ? 'bg-notyet-bg dark:bg-dark-notyet-bg border-notyet dark:border-dark-notyet text-ink dark:text-dark-ink' : ''}
        {answered && !isCorrect && !isWrongPick ? 'border-border-interactive dark:border-dark-border-interactive text-ink-muted dark:text-dark-ink-muted opacity-60' : ''}
        {!answered ? 'border-border-interactive dark:border-dark-border-interactive text-ink dark:text-dark-ink' : ''}"
      on:click={() => select(i)}
      disabled={answered}
    >
      <span class="flex-1">
        {#if answered && isCorrect}✓ {:else if isWrongPick}✗ {/if}{opt}
      </span>
      {#if isWrongPick}
        <span class="shrink-0 text-xs font-normal">your answer</span>
      {/if}
    </button>
  {/each}

  {#if answered}
    <div class="mt-3 p-3 rounded-card border border-border dark:border-dark-border text-sm leading-relaxed">
      <span class="font-bold">The correct answer is {correctAnswerText || options[correctIndex]}.</span>
      {#if feedbackExplain} {feedbackExplain}{/if}
    </div>
  {/if}
</div>
