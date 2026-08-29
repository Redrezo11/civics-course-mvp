<script>
  import { t } from '../i18n.js';
  import { navigate } from '../router.js';
  import { progress } from '../stores/progress.js';
  import { ANSWERS_CHECKED } from '../content/questions.js';
  import { lmsSession } from '../stores/lms.js';

  $: my = ($progress.language || 'en') === 'my' ? 'my' : undefined;

  // Keys, not literals. These six pairs sat in a plain array inside this
  // script block and so never reached the translation pipeline — a learner
  // reading Burmese hit six English questions and six English answers on the
  // one screen they open when something has gone wrong.
  //
  // They also could not be FOUND: scripts/extract-ui-strings.cjs strips
  // <script> blocks before scanning, on the assumption that nothing
  // learner-visible lives there. This array is the counter-example, and the
  // extractor now scans script blocks too.
  const FAQ = ['1', '2', '3', '4', '5', '6'];

  let confirmingReset = false;
  function doReset() {
    progress.resetAll();
    confirmingReset = false;
    navigate('/');
  }
</script>

<div class="min-h-screen max-w-md mx-auto px-5 py-6">
  <button class="tap inline-flex items-center text-sm font-bold underline mb-6" on:click={() => navigate('/')}>{$t('common.back')}</button>

  <h1 class="text-heading font-bold mb-4">{$t('help.heading')}</h1>

  {#each FAQ as n}
    <div class="mb-3.5">
      <p class="text-sm font-bold mb-0.5" lang={my}>{$t(`help.q${n}`)}</p>
      <p class="text-sm text-ink-secondary dark:text-dark-ink-secondary leading-relaxed" lang={my}>
        {$t(`help.a${n}`)}
      </p>
    </div>
  {/each}

  <div class="border-t border-border dark:border-dark-border pt-3 mt-4 text-xs text-ink-muted dark:text-dark-ink-muted">
    <p class="mb-1">{$t('help.about')}</p>
    <!-- Derived, never hardcoded. This line previously read "checked Aug 2026"
         while current-answers.json carried no date at all and every dynamic
         card said "not checked yet" — the app contradicting itself about
         whether anyone had verified anything. -->
    <p>
      {$t('help.sources')} ·
      {#if ANSWERS_CHECKED}{$t('help.sourcesChecked', { date: ANSWERS_CHECKED })}{:else}{$t('help.sourcesUnchecked')}{/if}
    </p>
  </div>

  <!--
    Where the learner's progress actually goes. Two answers, because there are
    two truths: opened from the web it never leaves the phone, and launched from
    a learning management system it is reported to whoever assigned the course.
    Saying the first inside an LMS would be a lie about somebody's data.
  -->
  <div class="border border-border dark:border-dark-border rounded-card p-3 mt-3 text-center text-sm font-bold">
    {$t($lmsSession ? 'help.privacyLms' : 'help.privacy')}
  </div>

  {#if !confirmingReset}
    <button class="tap inline-flex items-center text-xs text-ink-muted dark:text-dark-ink-muted underline mt-6" on:click={() => (confirmingReset = true)}>
      {$t('help.startOverButton')}
    </button>
  {:else}
    <div class="mt-6 text-sm">
      <!--
        Under an LMS this button is weaker than it looks: it clears the phone,
        it cannot unsend what has already been reported. A learner starting over
        would otherwise believe their record was gone.
      -->
      <p class="mb-2">{$t($lmsSession ? 'help.resetLms' : 'help.reset')}</p>
      <div class="flex gap-2">
        <button class="btn-secondary" on:click={() => (confirmingReset = false)}>{$t('help.cancel')}</button>
        <button class="btn-primary" on:click={doReset}>{$t('help.clearProgress')}</button>
      </div>
    </div>
  {/if}
</div>
