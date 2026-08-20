<script>
  import { t } from '../i18n.js';
  // Rotates through exemplify / compare / infer / interpret per item — this
  // is the fix for the "everything was classifying" defect found in the
  // Instructional Strategy Foundation audit. One item advances to the next;
  // the parent Lesson screen's Next button appears once all items are done.
  //
  // All per-item state lives HERE, in component-local arrays — never written
  // back onto `items`. `items` comes straight from an imported unit JSON
  // module, which is a singleton: mutating it (the previous `_answeredIndex`
  // approach) left answers stuck on the data itself, so leaving a screen and
  // returning showed the questions already answered.
  //
  // Every completion test below reads these state variables directly inside
  // the reactive declarations. That is deliberate: Svelte only re-runs a
  // template expression or `$:` block when a variable *named in it* changes,
  // so a helper like `itemDone(i)` that reads state it does not name never
  // re-ran, and a finished sort could never advance.

  import { createEventDispatcher } from 'svelte';
  import AnswerLabel from './AnswerLabel.svelte';
  import NarrationButton from './NarrationButton.svelte';
  import { guidedItemSegments } from '../narration-text.js';
  import { progress } from '../stores/progress.js';
  const dispatch = createEventDispatcher();

  export let items = [];

  let current = 0;
  let answers = {};         // itemIndex -> chosen option index
  let sortAssignments = {}; // itemIndex -> { sortItemIndex: bucketIndex }
  let orderPicks = {};      // itemIndex -> [orderItemIndex, ...] as tapped
  let announced = false;

  // Reset when the parent swaps in a different screen's items.
  let loadedFor = null;
  $: if (items !== loadedFor) {
    loadedFor = items;
    current = 0;
    answers = {};
    sortAssignments = {};
    orderPicks = {};
    announced = false;
  }

  function selectAnswer(idx, optionIndex) {
    if (answers[idx] !== undefined) return;
    answers = { ...answers, [idx]: optionIndex };
    dispatch('answer', {
      id: items[idx].id || `guided-${idx}`,
      correct: optionIndex === items[idx].correctIndex,
      official: false,
    });
  }

  function assignBucket(itemIdx, sortItemIdx, bucket) {
    sortAssignments = {
      ...sortAssignments,
      [itemIdx]: { ...(sortAssignments[itemIdx] || {}), [sortItemIdx]: bucket },
    };
  }

  function resetSort(itemIdx) {
    sortAssignments = { ...sortAssignments, [itemIdx]: {} };
  }

  // Tap-to-order (interaction type 3): 3–4 cards tapped into sequence.
  // orderItems is authored in the CORRECT order; presentation is scrambled
  // deterministically so the answer is never simply "top to bottom".
  function scrambled(list) {
    return list
      .map((text, i) => ({ text, i }))
      .sort((a, b) => ((a.i * 7 + 3) % list.length) - ((b.i * 7 + 3) % list.length));
  }

  function pickOrder(itemIdx, orderItemIdx) {
    const picks = orderPicks[itemIdx] || [];
    if (picks.includes(orderItemIdx)) return;
    orderPicks = { ...orderPicks, [itemIdx]: [...picks, orderItemIdx] };
  }

  function resetOrder(itemIdx) {
    orderPicks = { ...orderPicks, [itemIdx]: [] };
  }

  function advance() {
    if (current < items.length - 1) current += 1;
  }

  // --- Completion, recomputed whenever any of the three state stores change.
  $: doneFlags = items.map((item, i) => {
    if (item.kind === 'compare') {
      const a = sortAssignments[i] || {};
      return Object.keys(a).length === item.sortItems.length;
    }
    if (item.kind === 'order') {
      return (orderPicks[i] || []).length === item.orderItems.length;
    }
    return answers[i] !== undefined;
  });

  $: allDone = doneFlags.length > 0 && doneFlags.every(Boolean);

  $: if (allDone && !announced) {
    announced = true;
    dispatch('alldone');
  }

  // Sort scoring — the authored `bucket` on each sortItem was previously
  // never read, so any arrangement was accepted in silence and the Compare
  // item taught nothing. G-20: lead with the correct answer, then explain.
  $: sortWrong = items.map((item, i) => {
    if (item.kind !== 'compare' || !doneFlags[i]) return [];
    const a = sortAssignments[i] || {};
    return item.sortItems
      .map((si, si_i) => ({ si, si_i }))
      .filter(({ si, si_i }) => a[si_i] !== si.bucket);
  });

  // What the feedback panels below actually say, so narration reads the same
  // words. Built per item and only consumed once the item is done — the compare
  // feedback names the correct bucket for every misplaced item, so speaking it
  // early would hand over the answers.
  $: feedbackFor = items.map((item, i) => {
    if (!doneFlags[i]) return [];
    if (item.kind === 'compare') {
      if (!sortWrong[i].length) return ['All sorted correctly.'];
      return [
        sortWrong[i].length === 1
          ? 'One belongs somewhere else:'
          : `${sortWrong[i].length} belong somewhere else:`,
        ...sortWrong[i].map((w) => `${w.si.text} goes in ${item.buckets[w.si.bucket]}.`),
      ];
    }
    if (item.kind === 'order') {
      return orderCorrect[i]
        ? ['Correct order.', item.feedbackCorrect || '']
        : ['The correct order is:', ...item.orderItems.map((t, n) => `${n + 1}. ${t}`)];
    }
    if (answers[i] !== undefined) return [`The correct answer is ${item.options[item.correctIndex]}.`];
    return [];
  });

  $: orderCorrect = items.map((item, i) =>
    item.kind === 'order' && doneFlags[i]
      ? (orderPicks[i] || []).every((v, n) => v === n)
      : false
  );
</script>

{#each items as item, i}
  {#if i === current}
    <!-- Re-derived per item, so advancing to the next one narrates the next
         one rather than continuing to read the last. -->
    <NarrationButton
      segments={guidedItemSegments(item, {
        answered: doneFlags[i],
        position: `Practice ${i + 1} of ${items.length} — not an official test question.`,
        feedback: feedbackFor[i],
        lang: $progress.language || 'en',
      })}
      lang={$progress.language || 'en'}
      wrapperClass="mb-3"
    />
    <p class="text-xs text-ink-muted dark:text-dark-ink-muted mb-2">
      Practice {i + 1} of {items.length} — not an official test question
    </p>

    <div>
      {#if item.kind === 'compare'}
        <p class="text-sm mb-3">{item.instructions}</p>
        <div class="flex gap-2 mb-3">
          {#each item.buckets as b, bi}
            <div class="flex-1 border border-border dark:border-dark-border rounded-card p-2 min-h-[80px]">
              <div class="text-center mb-1">
                <AnswerLabel text={b} gloss={item.bucketsGloss?.[bi]} textClass="text-sm font-bold" />
              </div>
              {#each item.sortItems as si, si_i}
                {#if sortAssignments[i]?.[si_i] === bi}
                  {@const right = si.bucket === bi}
                  <div
                    class="text-xs rounded px-1.5 py-1 mb-1
                      {doneFlags[i] && right ? 'bg-gotit-bg dark:bg-dark-gotit-bg' : ''}
                      {doneFlags[i] && !right ? 'border border-border-interactive dark:border-dark-border-interactive' : ''}
                      {!doneFlags[i] ? 'bg-gotit-bg dark:bg-dark-gotit-bg' : ''}"
                  >
                    <AnswerLabel text={si.text} gloss={item.sortItemsGloss?.[si_i]}
                      >{#if doneFlags[i]}{right ? '✓ ' : '✗ '}{/if}</AnswerLabel
                    >
                  </div>
                {/if}
              {/each}
            </div>
          {/each}
        </div>

        {#each item.sortItems as si, si_i}
          {#if sortAssignments[i]?.[si_i] === undefined}
            <div class="border border-border-interactive dark:border-dark-border-interactive rounded-card p-3 mb-2">
              <div class="mb-2">
                <AnswerLabel text={si.text} gloss={item.sortItemsGloss?.[si_i]} textClass="text-sm" />
              </div>
              <div class="flex gap-2">
                {#each item.buckets as b, bi}
                  <button class="btn-secondary tap !py-1.5 !text-xs" on:click={() => assignBucket(i, si_i, bi)}>
                    <AnswerLabel text={b} gloss={item.bucketsGloss?.[bi]} />
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        {/each}

        {#if doneFlags[i]}
          <div class="mt-1 p-3 rounded-card border border-border dark:border-dark-border text-sm leading-relaxed">
            {#if sortWrong[i].length === 0}
              <span class="font-bold">All sorted correctly.</span>
            {:else}
              <span class="font-bold">
                {sortWrong[i].length === 1 ? 'One belongs' : `${sortWrong[i].length} belong`} somewhere else:
              </span>
              {#each sortWrong[i] as w}
                {@const siIdx = item.sortItems.indexOf(w.si)}
                <div class="mt-1">
                  <AnswerLabel text="“{w.si.text}” → {item.buckets[w.si.bucket]}"
                    gloss={item.sortItemsGloss
                      ? `“${item.sortItemsGloss[siIdx]}” → ${item.bucketsGloss?.[w.si.bucket] ?? item.buckets[w.si.bucket]}`
                      : ''} />
                </div>
              {/each}
            {/if}
          </div>
          <button class="tap inline-flex items-center text-xs underline text-ink-muted dark:text-dark-ink-muted mt-2" on:click={() => resetSort(i)}>
            {$t('common.tryAgain')}
          </button>
          {#if i < items.length - 1}
            <button class="btn-primary mt-3" on:click={advance}>Next</button>
          {/if}
        {/if}

      {:else if item.kind === 'order'}
        <p class="text-sm mb-3">{item.instructions}</p>

        <div class="mb-3">
          {#each orderPicks[i] || [] as pickIdx, slot}
            {@const right = pickIdx === slot}
            <div
              class="flex items-start gap-2 border-2 rounded-card p-2.5 mb-2 text-sm
                {doneFlags[i] && right ? 'bg-gotit-bg dark:bg-dark-gotit-bg border-gotit dark:border-dark-gotit' : ''}
                {doneFlags[i] && !right ? 'border-border-interactive dark:border-dark-border-interactive text-ink-muted dark:text-dark-ink-muted' : ''}
                {!doneFlags[i] ? 'border-border-interactive dark:border-dark-border-interactive' : ''}"
            >
              <span class="font-bold shrink-0">{slot + 1}.</span>
              <AnswerLabel text={item.orderItems[pickIdx]} gloss={item.orderItemsGloss?.[pickIdx]} />
              {#if doneFlags[i]}<span class="ml-auto shrink-0 font-bold">{right ? '✓' : '✗'}</span>{/if}
            </div>
          {/each}
        </div>

        {#if !doneFlags[i]}
          {#each scrambled(item.orderItems) as entry}
            {#if !(orderPicks[i] || []).includes(entry.i)}
              <button
                class="tap flex items-center w-full text-left py-2.5 px-4 mb-2 rounded-card font-bold text-sm border-2 border-border-interactive dark:border-dark-border-interactive"
                on:click={() => pickOrder(i, entry.i)}
              ><AnswerLabel text={entry.text} gloss={item.orderItemsGloss?.[entry.i]} /></button>
            {/if}
          {/each}
          {#if (orderPicks[i] || []).length > 0}
            <button class="tap inline-flex items-center text-xs underline text-ink-muted dark:text-dark-ink-muted mt-1" on:click={() => resetOrder(i)}>
              Start over
            </button>
          {/if}
        {:else}
          <div class="mt-1 p-3 rounded-card border border-border dark:border-dark-border text-sm leading-relaxed">
            {#if orderCorrect[i]}
              <span class="font-bold">Correct order.</span> {item.feedbackCorrect || ''}
            {:else}
              <span class="font-bold">The correct order is:</span>
              {#each item.orderItems as t, n}
                <div class="mt-1 flex gap-2">
                  <span class="shrink-0">{n + 1}.</span>
                  <AnswerLabel text={t} gloss={item.orderItemsGloss?.[n]} />
                </div>
              {/each}
            {/if}
          </div>
          <button class="tap inline-flex items-center text-xs underline text-ink-muted dark:text-dark-ink-muted mt-2" on:click={() => resetOrder(i)}>
            Try again
          </button>
          {#if i < items.length - 1}
            <button class="btn-primary mt-3" on:click={advance}>Next</button>
          {/if}
        {/if}

      {:else}
        {#if item.questionCard}
          <p class="mb-2">{item.question}</p>
          <div class="question-card">
            <span class="question-tag">Q</span>
            <p class="font-bold m-0">{item.cardText}</p>
          </div>
        {:else}
          <p class="mb-3">{item.question}</p>
        {/if}

        {#each item.options as opt, oi}
          {@const answered = answers[i] !== undefined}
          {@const isCorrect = oi === item.correctIndex}
          {@const isWrongPick = answered && answers[i] === oi && !isCorrect}
          <!-- Same three-state treatment as SingleSelect: `answers[i]` held the
               learner's pick but the template only ever checked correctIndex,
               so a wrong choice looked identical to the options not chosen. -->
          <button
            class="tap flex items-center gap-2 w-full text-left py-2.5 px-4 mb-2 rounded-full font-bold text-sm border-2 transition-colors
              {answered && isCorrect ? 'bg-gotit-bg dark:bg-dark-gotit-bg border-gotit dark:border-dark-gotit' : ''}
              {isWrongPick ? 'bg-notyet-bg dark:bg-dark-notyet-bg border-notyet dark:border-dark-notyet' : ''}
              {answered && !isCorrect && !isWrongPick ? 'border-border-interactive dark:border-dark-border-interactive opacity-55' : ''}
              {!answered ? 'border-border-interactive dark:border-dark-border-interactive' : ''}"
            disabled={answered}
            on:click={() => selectAnswer(i, oi)}
          >
            <span class="flex-1">
              <AnswerLabel text={opt} gloss={item.optionsGloss?.[oi]}
                >{#if answered && isCorrect}✓ {:else if isWrongPick}✗ {/if}</AnswerLabel
              >
            </span>
          </button>
        {/each}

        {#if answers[i] !== undefined}
          <div class="mt-2 p-3 rounded-card border border-border dark:border-dark-border text-sm leading-relaxed">
            <span class="font-bold">The correct answer is {item.options[item.correctIndex]}.</span>
            {#if item.pairedOfficial}
              <br />It asks the same thing as the official question:
              <em>“{item.pairedOfficial}”</em>
            {/if}
          </div>
          {#if i < items.length - 1}
            <button class="btn-primary mt-3" on:click={advance}>Next</button>
          {/if}
        {/if}
      {/if}
    </div>
  {/if}
{/each}
