<script>
  // R1 / R2 / R3 · Cumulative reviews. Storyboard §8 (v5.0, restated).
  //
  // 8–10 items, all single-select, deliberately interleaved across every
  // completed unit, order randomised. Items reuse the option sets already
  // written for each unit's practice — no new distractors.
  //
  // Re-queue is objective, not self-reported: an item enters the next review
  // because the learner answered it WRONG, not because they tapped "Not yet".
  // That is the v5.0 change — the app knows the true answer state, so spaced
  // repetition targets on fact rather than on a self-report it cannot verify.
  //
  // The end screen shows no score. The review stays low-pressure even though
  // the scoring underneath it is now objective.

  import { onMount } from 'svelte';
  import { progress } from '../stores/progress.js';
  import { navigate } from '../router.js';
  import { REVIEWS, buildReviewPool } from '../select-review.js';
  import LessonBar from '../components/LessonBar.svelte';
  import PracticeItem from '../components/PracticeItem.svelte';
  import NarrationButton from '../components/NarrationButton.svelte';

  export let reviewId;

  $: review = REVIEWS[reviewId];

  let questions = [];
  let index = 0;
  let itemDone = false;
  let finished = false;
  let missed = [];

  onMount(() => {
    // Seeded by review id + attempt count so a mid-review reload returns the
    // same items rather than silently reshuffling under the learner.
    const seed =
      reviewId.charCodeAt(1) * 7919 + ($progress.reviewsDone.length + 1) * 104729;
    questions = buildReviewPool(reviewId, $progress.reviewQueue, seed);
  });

  $: current = questions[index];

  function onAnswer(e) {
    progress.recordAnswer(e.detail.id, e.detail.correct);
    if (!e.detail.correct) missed = [...missed, e.detail.id];
    itemDone = true;
  }

  function next() {
    if (index >= questions.length - 1) {
      // Anything answered correctly here leaves the queue; recordAnswer has
      // already done that. Anything missed was pushed in by the same call.
      progress.markReviewDone(reviewId);
      finished = true;
      return;
    }
    index += 1;
    itemDone = false;
  }

  $: canAdvance = itemDone || (current && current.dynamic);
</script>

<div class="min-h-screen flex flex-col max-w-md mx-auto">
  <LessonBar
    unitLabel={review ? review.label : 'Review'}
    position={finished || !questions.length ? '' : `${index + 1} of ${questions.length}`}
    onBack={() => navigate('/')}
  />

  <div class="flex-1 overflow-y-auto px-5 py-6">
    {#if !review}
      <p>Review not found.</p>

    {:else if !questions.length}
      <p>Preparing your review…</p>

    {:else if finished}
      <NarrationButton
        segments={[
          { lang: 'en', text: `Review finished. Reviewed: ${questions.length} questions.` },
          ...(reviewId === 'R3' ? [{ lang: 'en', text: 'You have reviewed all seven lessons.' }] : []),
        ]}
        wrapperClass="mb-4"
      />
      <h1 class="text-heading font-bold mb-3">Review finished.</h1>
      <p class="mb-4">Reviewed: {questions.length} questions.</p>
      <!-- Missed questions are re-queued silently. The learner does not need to
           be told the mechanic, and telling them was an excuse to add a line
           reassuring them that nothing is scored. -->
      {#if reviewId === 'R3'}
        <p class="font-bold">You have reviewed all seven lessons.</p>
      {/if}

    {:else}
      <p class="text-xs text-ink-muted dark:text-dark-ink-muted mb-3">
        Questions from different lessons, mixed together on purpose.
      </p>
      <PracticeItem
        q={current}
        lead="Questions from different lessons, mixed together on purpose."
        label="Question {index + 1} of {questions.length}"
        on:answer={onAnswer}
      />
    {/if}
  </div>

  <div class="px-5 py-4 border-t border-border dark:border-dark-border">
    {#if finished}
      {#if reviewId === 'R3'}
        <button class="btn-primary" on:click={() => navigate('/completion')}>Continue</button>
      {:else}
        <button class="btn-primary" on:click={() => navigate('/')}>Back to lessons</button>
      {/if}
    {:else if questions.length && canAdvance}
      <button class="btn-primary" on:click={next}>
        {index >= questions.length - 1 ? 'Finish review' : 'Next'}
      </button>
    {:else if questions.length}
      <p class="text-xs text-ink-muted dark:text-dark-ink-muted text-center">
        Choose an answer to continue
      </p>
    {/if}
  </div>
</div>
