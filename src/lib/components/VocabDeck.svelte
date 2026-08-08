<script>
  // Vocabulary flip cards — reference/lookup use of tap-to-reveal (the ONLY
  // surviving use per v5.0; graded practice never uses bare reveal).
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  export let cards = [];
  let flipped = new Set();

  function flip(i) {
    flipped.add(i);
    flipped = flipped; // trigger reactivity
  }

  // Signal completion as soon as every card is flipped, and render no button
  // of our own. The parent Lesson screen owns the single advance control on
  // every screen type; rendering one here too put two "Next" buttons on the
  // screen, which is both confusing and a G-1 violation (one action per
  // screen — the escape bar is the only sanctioned exception).
  $: allFlipped = flipped.size === cards.length;
  $: if (allFlipped) dispatch('done');
</script>

<p class="text-xs text-ink-muted dark:text-dark-ink-muted mb-3">
  Tap each word ({flipped.size} of {cards.length})
</p>

{#each cards as card, i}
  {#if flipped.has(i)}
    <div class="border-2 border-ink dark:border-dark-ink rounded-card p-4 mb-2.5">
      <p class="text-lg font-bold mb-1">{card.word}</p>
      <p class="text-sm text-ink-secondary dark:text-dark-ink-secondary mb-2">{card.def}</p>
      <p class="text-xs italic text-ink-muted dark:text-dark-ink-muted">"{card.example}"</p>
    </div>
  {:else}
    <button
      class="tap flex items-center w-full text-left border border-border dark:border-dark-border rounded-card py-3 px-4 mb-2.5 font-bold text-sm"
      on:click={() => flip(i)}
    >
      {card.word}
    </button>
  {/if}
{/each}

{#if !allFlipped}
  <p class="text-xs text-ink-muted dark:text-dark-ink-muted text-center mt-3">flip all {cards.length} to continue</p>
{/if}
