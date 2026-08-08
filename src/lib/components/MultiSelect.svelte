<script>
  // Multi-select — used by the six "any N of these" questions (Q10, Q48,
  // Q65, Q67, Q81, Q126). Storyboard: 5–6 options with the required count
  // stated on screen, per G-19 (never encourage more answers than asked).
  //
  // Correctness is membership in acceptedAnswers, not a fixed index list —
  // that is what lets the option order be permuted without touching data.

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  export let options = [];
  export let acceptedAnswers = [];
  export let required = 2;

  let chosen = [];
  let answered = false;

  $: isCorrectOption = (opt) => acceptedAnswers.includes(opt);

  function toggle(opt) {
    if (answered) return;
    if (chosen.includes(opt)) {
      chosen = chosen.filter((o) => o !== opt);
    } else if (chosen.length < required) {
      chosen = [...chosen, opt];
    }
  }

  function submit() {
    if (answered || chosen.length !== required) return;
    answered = true;
    // Correct only if every one of the learner's picks is an accepted answer.
    const correct = chosen.every(isCorrectOption);
    dispatch('answer', { correct, chosen });
  }
</script>

<p class="text-sm font-bold mb-3">Choose {required}.</p>

<div>
  {#each options as opt}
    {@const picked = chosen.includes(opt)}
    {@const reveal = answered && isCorrectOption(opt)}
    {@const wrongPick = answered && picked && !isCorrectOption(opt)}
    <button
      class="block w-full text-left py-2.5 px-4 mb-2.5 rounded-card font-bold text-sm border-2 transition-colors
        {reveal ? 'bg-gotit-bg dark:bg-dark-gotit-bg border-gotit dark:border-dark-gotit text-ink dark:text-dark-ink' : ''}
        {wrongPick ? 'border-border-interactive dark:border-dark-border-interactive text-ink-muted dark:text-dark-ink-muted' : ''}
        {!answered && picked ? 'border-ink dark:border-dark-ink text-ink dark:text-dark-ink' : ''}
        {!answered && !picked ? 'border-border-interactive dark:border-dark-border-interactive text-ink dark:text-dark-ink' : ''}
        {answered && !picked && !reveal ? 'border-border dark:border-dark-border text-ink-muted dark:text-dark-ink-muted opacity-60' : ''}"
      disabled={answered}
      on:click={() => toggle(opt)}
    >
      <!-- Selection and correctness are carried by a word and a mark, never
           by colour alone (G-5c / §8). -->
      {#if reveal}✓ {:else if wrongPick}✗ {:else if picked}● {:else}○ {/if}{opt}
    </button>
  {/each}

  {#if !answered}
    <button
      class="btn-primary mt-1 disabled:opacity-45"
      disabled={chosen.length !== required}
      on:click={submit}
    >
      {chosen.length < required
        ? `Choose ${required - chosen.length} more`
        : 'Check my answer'}
    </button>
  {:else}
    <div class="mt-3 p-3 rounded-card border border-border dark:border-dark-border text-sm leading-relaxed">
      <span class="font-bold">Accepted answers are marked ✓.</span>
      Any {required} of them is enough — the officer asks for {required}, so give
      {required} and stop.
    </div>
  {/if}
</div>
