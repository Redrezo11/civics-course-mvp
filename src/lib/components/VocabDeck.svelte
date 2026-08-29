<script>
  // Vocabulary flip cards — reference/lookup use of tap-to-reveal (the ONLY
  // surviving use per v5.0; graded practice never uses bare reveal).
  import { t } from '../i18n.js';
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
  {$t('vocab.tapEachWord', { shown: flipped.size, total: cards.length })}
</p>

{#each cards as card, i}
  {#if flipped.has(i)}
    <div class="border-2 border-ink dark:border-dark-ink rounded-card p-4 mb-2.5">
      <!--
        English word, Burmese beneath — the same shape AnswerLabel gives an
        answer option, and for the same reason: this is the term the officer
        says out loud, so the learner has to meet it in English. lang="my"
        scopes the Myanmar font and switches a screen reader's voice.
      -->
      <p class="text-lg font-bold">{card.word}</p>
      {#if card.wordGloss}
        <p
          class="text-sm font-normal leading-relaxed text-ink-secondary dark:text-dark-ink-secondary mb-1"
          lang="my"
        >{card.wordGloss}</p>
      {/if}
      <p class="text-sm text-ink-secondary dark:text-dark-ink-secondary mb-2 mt-1">{card.def}</p>
      <p class="text-xs italic text-ink-muted dark:text-dark-ink-muted">"{card.example}"</p>
    </div>
  {:else}
    <button
      class="tap flex flex-col items-start w-full text-left border border-border dark:border-dark-border rounded-card py-3 px-4 mb-2.5 font-bold text-sm"
      on:click={() => flip(i)}
    >
      <span>{card.word}</span>
      {#if card.wordGloss}
        <span
          class="font-normal text-ink-secondary dark:text-dark-ink-secondary mt-0.5"
          lang="my"
        >{card.wordGloss}</span>
      {/if}
    </button>
  {/if}
{/each}

{#if !allFlipped}
  <p class="text-xs text-ink-muted dark:text-dark-ink-muted text-center mt-3">{$t('vocab.flipAll', { n: cards.length })}</p>
{/if}
