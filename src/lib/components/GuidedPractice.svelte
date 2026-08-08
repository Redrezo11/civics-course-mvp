<script>
  // Rotates through exemplify / compare / infer / interpret per item — this
  // is the fix for the "everything was classifying" defect found in the
  // Instructional Strategy Foundation audit. One item advances to the next;
  // the parent Lesson screen's Next button appears once all items are done.
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  export let items = [];
  let current = 0;
  let sortAssignments = {}; // itemIndex -> { sortItemIndex: bucketIndex }
  let orderPicks = {}; // itemIndex -> [orderItemIndex, ...] in the order tapped

  // Tap-to-order (storyboard interaction type 3): 3–4 cards tapped into
  // sequence. orderItems is authored in the CORRECT sequence; this scrambles
  // the presentation deterministically so the answer is never just "top to
  // bottom", without needing a second authored field.
  function scrambled(list) {
    return list
      .map((text, i) => ({ text, i }))
      .sort((a, b) => ((a.i * 7 + 3) % list.length) - ((b.i * 7 + 3) % list.length));
  }

  function pickOrder(itemIdx, orderItemIdx) {
    const picks = orderPicks[itemIdx] || [];
    if (picks.includes(orderItemIdx)) return;
    orderPicks[itemIdx] = [...picks, orderItemIdx];
    orderPicks = orderPicks;
  }

  function resetOrder(itemIdx) {
    orderPicks[itemIdx] = [];
    orderPicks = orderPicks;
  }

  function orderComplete(idx) {
    const item = items[idx];
    return (orderPicks[idx] || []).length === item.orderItems.length;
  }

  function orderCorrect(idx) {
    const picks = orderPicks[idx] || [];
    return picks.every((v, i) => v === i);
  }

  function selectAnswer(item, optionIndex) {
    const correct = optionIndex === item.correctIndex;
    item._answeredIndex = optionIndex;
    dispatch('answer', { id: `guided-${current}`, correct });
    items = items;
  }

  function assignBucket(itemIdx, sortItemIdx, bucket) {
    sortAssignments[itemIdx] = sortAssignments[itemIdx] || {};
    sortAssignments[itemIdx][sortItemIdx] = bucket;
    sortAssignments = sortAssignments;
  }

  function itemDone(idx) {
    const item = items[idx];
    if (item.kind === 'compare') {
      return sortAssignments[idx] && Object.keys(sortAssignments[idx]).length === item.sortItems.length;
    }
    if (item.kind === 'order') {
      return orderComplete(idx);
    }
    return item._answeredIndex !== undefined;
  }

  function advance() {
    if (current < items.length - 1) current += 1;
  }

  $: allDone = items.every((_, i) => itemDone(i));
  $: if (allDone) dispatch('alldone');
</script>

{#each items as item, i}
  {#if i === current}
    <div>
      {#if item.kind === 'compare'}
        <p class="text-sm mb-3">{item.instructions}</p>
        <div class="flex gap-2 mb-3">
          {#each item.buckets as b, bi}
            <div class="flex-1 border border-border dark:border-dark-border rounded-card p-2 min-h-[80px]">
              <p class="text-xs font-bold text-center mb-1">{b}</p>
              {#each item.sortItems as si, si_i}
                {#if sortAssignments[i]?.[si_i] === bi}
                  <p class="text-xs bg-gotit-bg dark:bg-dark-gotit-bg rounded px-1.5 py-1 mb-1">{si.text}</p>
                {/if}
              {/each}
            </div>
          {/each}
        </div>
        {#each item.sortItems as si, si_i}
          {#if sortAssignments[i]?.[si_i] === undefined}
            <div class="border border-border-interactive dark:border-dark-border-interactive rounded-card p-3 mb-2">
              <p class="text-sm mb-2">{si.text}</p>
              <div class="flex gap-2">
                {#each item.buckets as b, bi}
                  <button class="btn-secondary !py-1.5 !text-xs" on:click={() => assignBucket(i, si_i, bi)}>{b}</button>
                {/each}
              </div>
            </div>
          {/if}
        {/each}
        {#if itemDone(i) && i < items.length - 1}
          <button class="btn-primary mt-2" on:click={advance}>Next</button>
        {/if}

      {:else if item.kind === 'order'}
        <p class="text-sm mb-3">{item.instructions}</p>

        <!-- Chosen sequence, numbered. Position is stated as a number, not
             implied by placement alone. -->
        <div class="mb-3">
          {#each orderPicks[i] || [] as pickIdx, slot}
            {@const right = pickIdx === slot}
            <div
              class="flex items-start gap-2 border-2 rounded-card p-2.5 mb-2 text-sm
                {orderComplete(i) && right ? 'bg-gotit-bg dark:bg-dark-gotit-bg border-gotit dark:border-dark-gotit' : ''}
                {orderComplete(i) && !right ? 'border-border-interactive dark:border-dark-border-interactive text-ink-muted dark:text-dark-ink-muted' : ''}
                {!orderComplete(i) ? 'border-border-interactive dark:border-dark-border-interactive' : ''}"
            >
              <span class="font-bold shrink-0">{slot + 1}.</span>
              <span>{item.orderItems[pickIdx]}</span>
              {#if orderComplete(i)}
                <span class="ml-auto shrink-0 font-bold">{right ? '✓' : '✗'}</span>
              {/if}
            </div>
          {/each}
        </div>

        {#if !orderComplete(i)}
          {#each scrambled(item.orderItems) as entry}
            {#if !(orderPicks[i] || []).includes(entry.i)}
              <button
                class="block w-full text-left py-2.5 px-4 mb-2 rounded-card font-bold text-sm border-2 border-border-interactive dark:border-dark-border-interactive"
                on:click={() => pickOrder(i, entry.i)}
              >{entry.text}</button>
            {/if}
          {/each}
          {#if (orderPicks[i] || []).length > 0}
            <button class="text-xs underline text-ink-muted dark:text-dark-ink-muted mt-1" on:click={() => resetOrder(i)}>
              Start over
            </button>
          {/if}
        {:else}
          <div class="mt-1 p-3 rounded-card border border-border dark:border-dark-border text-sm leading-relaxed">
            {#if orderCorrect(i)}
              <span class="font-bold">Correct order.</span> {item.feedbackCorrect || ''}
            {:else}
              <!-- G-20: lead with the answer, then explain. -->
              <span class="font-bold">The correct order is:</span>
              {#each item.orderItems as t, n}<br />{n + 1}. {t}{/each}
              {#if item.feedbackCorrect}<br /><br />{item.feedbackCorrect}{/if}
            {/if}
          </div>
          <button class="text-xs underline text-ink-muted dark:text-dark-ink-muted mt-2" on:click={() => resetOrder(i)}>
            Try again
          </button>
          {#if i < items.length - 1}
            <button class="btn-primary mt-3" on:click={advance}>Next</button>
          {/if}
        {/if}

      {:else}
        {#if item.questionCard}
          <p class="text-xs text-ink-muted dark:text-dark-ink-muted mb-2">Practice — not an official test question</p>
          <p class="mb-2">{item.question}</p>
          <div class="question-card">
            <span class="question-tag">Q</span>
            <p class="font-bold m-0">{item.cardText}</p>
          </div>
        {:else}
          <p class="mb-3">{item.question}</p>
        {/if}

        {#each item.options as opt, oi}
          <button
            class="block w-full text-left py-2.5 px-4 mb-2 rounded-full font-bold text-sm border-2 transition-colors
              {item._answeredIndex !== undefined && oi === item.correctIndex ? 'bg-gotit-bg dark:bg-dark-gotit-bg border-gotit dark:border-dark-gotit' : ''}
              {item._answeredIndex !== undefined && oi !== item.correctIndex ? 'border-border-interactive dark:border-dark-border-interactive opacity-55' : ''}
              {item._answeredIndex === undefined ? 'border-border-interactive dark:border-dark-border-interactive' : ''}"
            disabled={item._answeredIndex !== undefined}
            on:click={() => selectAnswer(item, oi)}
          >
            {item._answeredIndex !== undefined && oi === item.correctIndex ? '✓ ' : ''}{opt}
          </button>
        {/each}

        {#if item._answeredIndex !== undefined}
          {#if item.pairedOfficial}
            <div class="mt-2 p-3 rounded-card border border-border dark:border-dark-border text-sm">
              <span class="font-bold">Yes.</span> This asks the same thing as:
              <em>"{item.pairedOfficial}"</em>
            </div>
          {/if}
          {#if i < items.length - 1}
            <button class="btn-primary mt-3" on:click={advance}>Next</button>
          {/if}
        {/if}
      {/if}
    </div>
  {/if}
{/each}

{#if allDone}
  <div class="h-2"></div>
{/if}
