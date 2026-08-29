<script>
  import { t } from '../i18n.js';
  import { unitTitleKey } from '../content/unit-titles.js';
  // G-08 · Full-bank practice, per unit. Storyboard §6 (v5.3) and G-22.
  //
  // Why this screen exists: the core path practices 39 of 128 questions — 30%.
  // The other 89 are shown once with their accepted answer and never practiced.
  // A course cannot claim to prepare a learner for 128 questions while quizzing
  // them on a third of the bank. This layer closes that gap for learners who
  // want it, WITHOUT forcing it on the one-hour core path.
  //
  // Rules it must obey:
  //   · optional and non-blocking — never gates Lock it in, the next unit,
  //     reviews, or Rehearsal
  //   · covers every question assigned to the unit, not a sample; questions
  //     already met on the core path are included, so the set is genuinely
  //     complete rather than a remainder
  //   · exit at any point, position saved, resumes where the learner stopped
  //   · ◆ dynamic questions appear as current-answer cards, not scored items

  import { progress, questionsPracticedCount } from '../stores/progress.js';
  import { navigate } from '../router.js';
  import { getUnitQuestions, TOTAL_QUESTIONS } from '../content/questions.js';
  import LessonBar from '../components/LessonBar.svelte';
  import PracticeItem from '../components/PracticeItem.svelte';
  import NarrationButton from '../components/NarrationButton.svelte';

  export let unitId;

  $: questions = getUnitQuestions(unitId);
  $: title = $t(unitTitleKey(unitId));

  // 'entry' → 'running' → 'exit'
  let phase = 'entry';
  let index = 0;
  let itemDone = false;

  // How many of THIS unit's questions the learner has genuinely answered
  // anywhere — core path included. This is what makes the entry line honest.
  $: practisedHere = questions.filter(
    (q) => $progress.questionsAnswered[q.id] !== undefined
  ).length;

  $: resumeAt = $progress.fullBankProgress[unitId] || 0;
  $: current = questions[index];

  function start() {
    index = resumeAt < questions.length ? resumeAt : 0;
    itemDone = false;
    phase = 'running';
  }

  function onAnswer(e) {
    progress.recordAnswer(e.detail.id, e.detail.correct);
    itemDone = true;
  }

  function next() {
    progress.recordFullBankProgress(unitId, index + 1);
    if (index >= questions.length - 1) {
      progress.markFullBankDone(unitId);
      phase = 'exit';
      return;
    }
    index += 1;
    itemDone = false;
  }

  function leave() {
    navigate('/');
  }

  // ◆ items cannot be answered, so they must not gate the Next control.
  $: canAdvance = itemDone || (current && current.dynamic);

  // Every string here follows the learner's language, narration included.
  $: lang = $progress.language || 'en';
  $: my = lang === 'my' ? 'my' : undefined;
</script>

<div class="min-h-screen flex flex-col max-w-md mx-auto">
  <LessonBar
    unitLabel="Practice · {title}"
    position={phase === 'running' ? `Question ${index + 1} of ${questions.length}` : ''}
    onBack={() => (phase === 'running' ? (phase = 'entry') : navigate('/'))}
  />

  <div class="flex-1 overflow-y-auto px-5 py-6">
    {#if phase === 'entry'}
      <NarrationButton
        segments={[
          { lang, text: $t('fullBank.heading', { n: questions.length }) },
          ...(resumeAt > 0 && resumeAt < questions.length
            ? [{ lang, text: $t('fullBank.resumingAt', { n: resumeAt + 1 }) }]
            : []),
        ]}
        {lang}
        wrapperClass="mb-4"
      />
      <h1 class="text-heading font-bold mb-3" lang={my}>
        {$t('fullBank.heading', { n: questions.length })}
      </h1>
      <!-- The heading names the set and the buttons say what to do with it, so
           nothing else belongs here. The resume line stays: it is the one thing
           on this screen the learner cannot work out for themselves. -->
      {#if resumeAt > 0 && resumeAt < questions.length}
        <p class="text-sm font-bold mb-4" lang={my}>
          {$t('fullBank.resumingAt', { n: resumeAt + 1 })}
        </p>
      {/if}

    {:else if phase === 'running'}
      <PracticeItem
        q={current}
        label="Question {index + 1} of {questions.length}"
        on:answer={onAnswer}
      />

    {:else}
      <NarrationButton
        segments={[
          {
            lang,
            text: `${$t('fullBank.practicedCount', { done: questions.length, total: questions.length })} ${$t('fullBank.practicedAltogether', { done: $questionsPracticedCount, total: TOTAL_QUESTIONS })}`,
          },
        ]}
        {lang}
        wrapperClass="mb-4"
      />
      <h1 class="text-heading font-bold mb-3" lang={my}>
        {$t('fullBank.practicedCount', { done: questions.length, total: questions.length })}
      </h1>
      <div class="border border-border dark:border-dark-border rounded-card p-4 mb-4 text-center">
        <div class="text-xl font-bold">
          {$questionsPracticedCount}<span class="text-xs font-normal text-ink-muted dark:text-dark-ink-muted">
            of {TOTAL_QUESTIONS}</span
          >
        </div>
        <div class="text-[10px] text-ink-muted dark:text-dark-ink-muted">
          {$t('fullBank.questionsPracticed')}
        </div>
      </div>
    {/if}
  </div>

  <div class="px-5 py-4 border-t border-border dark:border-dark-border">
    {#if phase === 'entry'}
      <button class="btn-primary mb-2.5" on:click={start}>
        {resumeAt > 0 && resumeAt < questions.length
          ? $t('fullBank.continuePractice')
          : $t('fullBank.startPractice')}
      </button>
      <button class="btn-secondary" on:click={leave}>{$t('common.skip')}</button>
    {:else if phase === 'running'}
      {#if canAdvance}
        <button class="btn-primary" on:click={next}>
          {index >= questions.length - 1 ? $t('common.finish') : $t('common.next')}
        </button>
      {:else}
        <p class="text-xs text-ink-muted dark:text-dark-ink-muted text-center" lang={my}>
          {$t('common.chooseToContinue')}
        </p>
      {/if}
    {:else}
      <button class="btn-primary" on:click={leave}>{$t('common.backToLessons')}</button>
    {/if}
  </div>
</div>
