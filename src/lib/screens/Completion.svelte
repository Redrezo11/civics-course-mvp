<script>
  import { t } from '../i18n.js';
  import NarrationButton from '../components/NarrationButton.svelte';
  import ScreenImage from '../components/ScreenImage.svelte';
  // G-05 closing screen + G-05b completion evidence. Storyboard §6.
  //
  // G-05b is required by the STUDY design, not by the instruction: completion
  // is the primary measure and a static site cannot report anything back on
  // its own (G-12). The method is not yet chosen — completion code, exit form,
  // progress screenshot, or LMS hosting — and the storyboard's interim spec is
  // "one screen, one instruction line, one primary button", so that whichever
  // method is picked drops into this shape without a redesign.
  //
  // Built to that spec deliberately. It does not invent a method, and it does
  // not pretend to record anything: claiming to have logged a completion that
  // nothing received would be worse than saying plainly that the step is
  // manual.

  import { progress, questionsPracticedCount, lessonsFinishedCount } from '../stores/progress.js';
  import { navigate } from '../router.js';
  import { TOTAL_QUESTIONS } from '../content/questions.js';
  import LessonBar from '../components/LessonBar.svelte';
  import { lmsSession } from '../stores/lms.js';

  const TOTAL_UNITS = 8;

  // Every string here follows the learner's language. This is the last screen
  // of the course; finishing in a language you cannot read is a poor way to be
  // congratulated.
  $: lang = $progress.language || 'en';
  $: my = lang === 'my' ? 'my' : undefined;
  $: counterSentence = $t('completion.counterSentence', {
    lessons: $lessonsFinishedCount,
    totalLessons: TOTAL_UNITS,
    questions: $questionsPracticedCount,
    totalQuestions: TOTAL_QUESTIONS,
  });
</script>

<div class="min-h-screen flex flex-col max-w-md mx-auto">
  <LessonBar unitLabel={$t('completion.unitLabel')} onBack={() => navigate('/')} />

  <div class="flex-1 overflow-y-auto px-5 py-6">
    <ScreenImage
      image="naturalization-ceremony-close.webp"
      alt="New citizens at a naturalization ceremony, smiling and waving small United States flags."
      wrapperClass="mb-5"
    />
    <NarrationButton
      segments={[
        { text: $t('completion.almostThere'), lang },
        { text: counterSentence, lang },
      ]}
      screenId="completion"
      {lang}
      wrapperClass="mb-4"
    />
    <h1 class="text-heading font-bold mb-3" lang={my}>
      {$t('completion.almostThere')}
    </h1>

    <!-- The two honest counters again, unmerged (G-22). This screen is the
         last place a course would be tempted to round up. -->
    <div class="flex gap-2.5 my-5">
      <div class="flex-1 text-center py-2.5 px-1.5 border border-border dark:border-dark-border rounded-card">
        <div class="text-xl font-bold">
          {$lessonsFinishedCount}<span class="text-xs font-normal text-ink-muted dark:text-dark-ink-muted"> of {TOTAL_UNITS}</span>
        </div>
        <div class="text-[10px] text-ink-muted dark:text-dark-ink-muted">{$t('home.counterLessons')}</div>
      </div>
      <div class="flex-1 text-center py-2.5 px-1.5 border border-border dark:border-dark-border rounded-card">
        <div class="text-xl font-bold">
          {$questionsPracticedCount}<span class="text-xs font-normal text-ink-muted dark:text-dark-ink-muted"> of {TOTAL_QUESTIONS}</span>
        </div>
        <div class="text-[10px] text-ink-muted dark:text-dark-ink-muted">{$t('home.counterQuestions')}</div>
      </div>
    </div>

    {#if $questionsPracticedCount < TOTAL_QUESTIONS}
      <p class="text-sm leading-relaxed mb-4" lang={my}>
        {$t('completion.wantPracticeAll', { n: TOTAL_QUESTIONS - $questionsPracticedCount })}
      </p>
    {:else}
      <p class="text-sm font-bold mb-4" lang={my}>
        {$t('completion.practicedAll', { n: TOTAL_QUESTIONS })}
      </p>
    {/if}

    <div class="border-t border-border dark:border-dark-border pt-4">
      <!-- G-05b interim shape: one instruction line, one primary button.
           The method is undecided; this states what is true today rather than
           implying the course has sent anything anywhere. -->
      <p class="font-bold mb-2" lang={my}>{$t('completion.showingFinished')}</p>
      <!--
        The photograph instruction only ever existed because the course had no
        way to report anything — the storyboard called it an interim shape and
        it was. Launched from a learning management system there IS a record,
        and telling someone to photograph their screen when their completion has
        already been filed would be both wrong and faintly insulting.
      -->
      {#if $lmsSession}
        <p class="text-sm text-ink-secondary dark:text-dark-ink-secondary leading-relaxed" lang={my}>
          {$t('completion.proveLms')}
        </p>
      {:else}
        <p class="text-sm text-ink-secondary dark:text-dark-ink-secondary leading-relaxed" lang={my}>
          {$t('completion.provePhone')}
        </p>
      {/if}
    </div>
  </div>

  <div class="px-5 py-4 border-t border-border dark:border-dark-border">
    <button class="btn-primary mb-2.5" on:click={() => navigate('/rehearsal')}>
      {$t('completion.practiceInterview')}
    </button>
    <button class="btn-secondary" on:click={() => navigate('/')}>{$t('common.backToLessons')}</button>
  </div>
</div>
