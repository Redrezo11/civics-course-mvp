<script>
  import { t } from '../i18n.js';
  import { unitTitleKey } from '../content/unit-titles.js';
  import { progress } from '../stores/progress.js';
  // G-03 · the ungated reference to every official question. G-16 lists this
  // as one of the affordances a layout change may never remove.
  //
  // It loads the WHOLE bank. It previously imported questions-u1.json alone,
  // so a screen labelled "All 128 questions" showed 14 — and its "Why is this
  // the answer?" link was hardcoded to /unit/U1, which would have sent a
  // learner asking about the Civil War into the Constitution lesson.

  import { navigate } from '../router.js';
  import NarrationButton from '../components/NarrationButton.svelte';
  import {
    getAllQuestions,
    TOTAL_QUESTIONS,
    getCurrentAnswer,
    ANSWERS_CHECKED,
    USCIS_UPDATES_URL,
  } from '../content/questions.js';

  const questions = getAllQuestions();

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

  $: my = ($progress.language || 'en') === 'my' ? 'my' : undefined;
</script>

<div class="min-h-screen max-w-md mx-auto flex flex-col">
  <div class="px-5 py-6 flex-1">
    <button class="tap inline-flex items-center text-sm font-bold underline mb-4" on:click={() => navigate('/')}>{$t('common.back')}</button>

    <input
      type="text"
      bind:value={search}
      placeholder={$t('questionBank.searchPlaceholder')}
      class="w-full border border-border dark:border-dark-border rounded-card py-2.5 px-4 mb-4 bg-raised dark:bg-dark-raised text-ink dark:text-dark-ink"
    />

    <p class="text-xs text-ink-muted dark:text-dark-ink-muted mb-3">
      {#if needle}
        {$t('questionBank.matchCount', { shown: filtered.length, total: TOTAL_QUESTIONS })}
      {:else}
        {$t('questionBank.allOfficial', { n: TOTAL_QUESTIONS })}
      {/if}
    </p>

    {#each filtered as q (q.id)}
      <div class="border border-border dark:border-dark-border rounded-card mb-2 overflow-hidden">
        <button
          class="tap w-full flex items-center justify-between py-2.5 px-4 text-left text-sm"
          on:click={() => (expanded = expanded === q.id ? null : q.id)}
        >
          <span>{q.id.slice(1)}. {q.official}{q.star ? ' ★' : ''}</span>
          <span class="text-ink-muted dark:text-dark-ink-muted ml-2">{expanded === q.id ? '︿' : '﹀'}</span>
        </button>
        {#if expanded === q.id}
          <div class="px-4 pb-4 text-sm">
            <!-- Only the expanded row has a control, so there is never more
                 than one on screen. The question is what the officer will say,
                 which makes hearing it the point of this reference. -->
            <NarrationButton
              segments={[
                { text: q.official, lang: 'en', questionId: q.id },
                ...(q.dynamic ? [] : q.acceptedAnswers.map((a) => ({ text: a, lang: 'en' }))),
              ]}
              wrapperClass="mb-3"
            />
            {#if q.dynamic}
              <!-- ◆ This answer changes with elections or appointments, so the
                   reference must not print a stale name as though it were fact. -->
              {@const ca = getCurrentAnswer(q.id)}
              {#if ca && ca.verified && ca.value}
                <p class="font-bold mb-1">{ca.value}</p>
                <p class="text-xs text-ink-muted dark:text-dark-ink-muted mb-2">
                  {$t('dynamic.checkedOn', { date: ANSWERS_CHECKED || $t('dynamic.notRecorded') })}
                </p>
              {:else}
                <p class="mb-2" lang={my}>{$t('dynamic.notCheckedLong')}</p>
              {/if}
              <a
                class="text-xs font-bold underline"
                href={USCIS_UPDATES_URL}
                target="_blank"
                rel="noopener noreferrer">{$t('dynamic.checkUscis')}</a
              >
            {:else}
              <ul class="mb-2 pl-4">
                {#each q.acceptedAnswers as a}<li>{a}</li>{/each}
              </ul>
            {/if}
            <div class="mt-2">
              <button
                class="tap inline-flex items-center text-xs font-bold underline text-ink dark:text-dark-ink"
                on:click={() => navigate(`/unit/${q.unit}`)}
              >
                {$t('questionBank.whyAnswer', { unit: $t(unitTitleKey(q.unit)) })}
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/each}

    {#if filtered.length === 0}
      <p class="text-sm text-ink-muted dark:text-dark-ink-muted text-center py-6" lang={my}>
        {$t('questionBank.noMatch', { q: search })}
      </p>
    {/if}
  </div>

  <div class="flex border-t border-border dark:border-dark-border bg-raised dark:bg-dark-raised">
    <button class="tap flex-1 text-center py-3 text-sm text-ink-muted dark:text-dark-ink-muted" on:click={() => navigate('/')}>
      {$t('nav.tabLearn')}
    </button>
    <div class="flex-1 text-center py-3 text-sm font-bold">{$t('questionBank.allQuestions', { n: TOTAL_QUESTIONS })}</div>
  </div>
</div>
