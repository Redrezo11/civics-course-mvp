<script>
  // The self-test fix: old copy said "read it out loud, then say the
  // answer" as if the answer were already visible — incoherent, since
  // nothing was shown. This version makes the recall-before-reveal
  // sequence explicit: attempt the answer from memory, THEN check it.
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  export let q;

  let revealed = false;
  let marked = null; // 'got' | 'notyet'

  function reveal() {
    revealed = true;
  }
  function mark(value) {
    marked = value;
    dispatch('answer', { correct: value === 'got' });
  }
</script>

{#if !revealed}
  <button class="btn-primary" on:click={reveal}>Check my answer</button>
{:else}
  <div class="border border-border dark:border-dark-border rounded-card p-3 mb-3">
    <ul class="pl-4 text-sm">
      {#each q.acceptedAnswers as a}<li>{a}</li>{/each}
    </ul>
  </div>
  <p class="text-center text-ink-secondary dark:text-dark-ink-secondary mb-3">Did you get it right?</p>
  <div class="flex gap-2.5">
    <button
      class="flex-1 py-2.5 rounded-full font-bold text-sm border-2
        {marked === 'got' ? 'bg-gotit-bg dark:bg-dark-gotit-bg border-gotit dark:border-dark-gotit' : 'border-border-interactive dark:border-dark-border-interactive'}"
      on:click={() => mark('got')}
    >✓ Got it</button>
    <button
      class="flex-1 py-2.5 rounded-full font-bold text-sm border-2 border-border-interactive dark:border-dark-border-interactive"
      on:click={() => mark('notyet')}
    >↻ Not yet</button>
  </div>
{/if}
