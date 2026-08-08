<script>
  // G-03 · the ungated reference to every official question. G-16 lists this
  // as one of the affordances a layout change may never remove.
  //
  // It loads the WHOLE bank. It previously imported questions-u1.json alone,
  // so a screen labelled "All 128 questions" showed 14 — and its "Why is this
  // the answer?" link was hardcoded to /unit/U1, which would have sent a
  // learner asking about the Civil War into the Constitution lesson.

  import { navigate } from '../router.js';
  import {
    getAllQuestions,
    TOTAL_QUESTIONS,
    getCurrentAnswer,
    ANSWERS_CHECKED,
    USCIS_UPDATES_URL,
  } from '../content/questions.js';

  const questions = getAllQuestions();

  const UNIT_NAMES = {
    U1: 'We the People',
    U2: 'Three branches',
    U3: 'Who represents you',
    U4: 'Federal and state',
    U5: 'Rights and responsibilities',
    U6: 'How America began',
    U7: 'How America changed',
  };

  let search = '';
  let expanded = null;

  $: needle = search.trim().toLowerCase();
  $: filtered = needle
    ? questions.filter(
        (q) =>
          q.official.toLowerCase().includes(needle) ||
          q.acceptedAnswers.some((a) => a.toLowerCase().includes(needle))
      )
    : questions;
</script>

<div class="min-h-screen max-w-md mx-auto flex flex-col">
  <div class="px-5 py-6 flex-1">
    <button class="text-sm font-bold underline mb-4" on:click={() => navigate('/')}>‹ Back</button>

    <input
      type="text"
      bind:value={search}
      placeholder="Search questions..."
      class="w-full border border-border dark:border-dark-border rounded-card py-2.5 px-4 mb-4 bg-raised dark:bg-dark-raised text-ink dark:text-dark-ink"
    />

    <p class="text-xs text-ink-muted dark:text-dark-ink-muted mb-3">
      {#if needle}
        {filtered.length} of {TOTAL_QUESTIONS} questions match
      {:else}
        All {TOTAL_QUESTIONS} official questions · ★ marks the 65/20 questions
      {/if}
    </p>

    {#each filtered as q (q.id)}
      <div class="border border-border dark:border-dark-border rounded-card mb-2 overflow-hidden">
        <button
          class="w-full flex items-center justify-between py-2.5 px-4 text-left text-sm"
          on:click={() => (expanded = expanded === q.id ? null : q.id)}
        >
          <span>{q.id.slice(1)}. {q.official}{q.star ? ' ★' : ''}</span>
          <span class="text-ink-muted dark:text-dark-ink-muted ml-2">{expanded === q.id ? '︿' : '﹀'}</span>
        </button>
        {#if expanded === q.id}
          <div class="px-4 pb-4 text-sm">
            {#if q.dynamic}
              <!-- ◆ This answer changes with elections or appointments, so the
                   reference must not print a stale name as though it were fact. -->
              {@const ca = getCurrentAnswer(q.id)}
              {#if ca && ca.verified && ca.value}
                <p class="font-bold mb-1">{ca.value}</p>
                <p class="text-xs text-ink-muted dark:text-dark-ink-muted mb-2">
                  Checked: {ANSWERS_CHECKED || 'not yet recorded'}
                </p>
              {:else}
                <p class="mb-2">
                  This answer changes. It has not been checked yet — look it up before
                  your interview.
                </p>
              {/if}
              <a
                class="text-xs font-bold underline"
                href={USCIS_UPDATES_URL}
                target="_blank"
                rel="noopener noreferrer">Check at uscis.gov</a
              >
            {:else}
              <ul class="mb-2 pl-4">
                {#each q.acceptedAnswers as a}<li>{a}</li>{/each}
              </ul>
            {/if}
            <div class="mt-2">
              <button
                class="text-xs font-bold underline text-ink dark:text-dark-ink"
                on:click={() => navigate(`/unit/${q.unit}`)}
              >
                Why is this the answer? → {UNIT_NAMES[q.unit] || q.unit}
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/each}

    {#if filtered.length === 0}
      <p class="text-sm text-ink-muted dark:text-dark-ink-muted text-center py-6">
        No question matches “{search}”.
      </p>
    {/if}
  </div>

  <div class="flex border-t border-border dark:border-dark-border bg-raised dark:bg-dark-raised">
    <button class="flex-1 text-center py-3 text-sm text-ink-muted dark:text-dark-ink-muted" on:click={() => navigate('/')}>
      Learn
    </button>
    <div class="flex-1 text-center py-3 text-sm font-bold">All {TOTAL_QUESTIONS} questions</div>
  </div>
</div>
