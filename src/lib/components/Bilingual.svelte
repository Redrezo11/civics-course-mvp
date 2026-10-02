<script>
  // A passage of lesson prose: English, with the Burmese directly beneath it.
  //
  // In Burmese mode the caller passes both; in English mode, or where a field
  // has no translation (or a stale one, which localiseWith already turned back
  // into English), `my` equals `en` and only one line renders — never the same
  // English twice.
  //
  // Unlike AnswerLabel, the Burmese is NOT smaller or grey. An answer gloss is
  // a secondary aid under an English answer; here the Burmese is the text a
  // Burmese reader actually reads, so it keeps the passage's size and weight.
  // The one exception is the floor below.

  export let en = '';
  export let my = '';
  /** p | h1 | h2 | li | div | span */
  export let tag = 'p';
  export let wrapperClass = '';

  // A translation sometimes carries its English inside it — "Constitution —
  // 1787 (ဖွဲ့စည်းပုံအခြေခံဥပဒေ)", or an official question kept verbatim (G-3)
  // ahead of a Burmese instruction. The English is already the line above, so
  // the Burmese line keeps only what is left, minus the joining dash or brackets.
  $: rest =
    my && en && my !== en && my.includes(en)
      ? my.replace(en, '').replace(/^[\s—–:()-]+|[\s—–:()-]+$/g, '')
      : my;
  $: second = rest && rest !== en ? rest : '';
</script>

<svelte:element this={tag} class={wrapperClass}>
  <!-- lang="en" because <html> is lang="my" in Burmese mode; without it a
       screen reader voices this line as Burmese. -->
  <span class="block" lang="en"><slot />{en}</span>
  {#if second}
    <span class="block mt-1 burmese-line" lang="my">{second}</span>
  {/if}
</svelte:element>

<style>
  /* Burmese stacks vowel marks above and below the consonant and they collapse
     below ~14px (see AnswerLabel). Same size as the English everywhere, except
     inside text-xs passages, which are lifted to 14px. */
  .burmese-line {
    font-size: max(0.875rem, 1em);
  }
</style>
