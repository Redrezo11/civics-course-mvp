<script>
  import { t } from '../i18n.js';
  import { navigate } from '../router.js';
  import { progress } from '../stores/progress.js';
  import { ANSWERS_CHECKED } from '../content/questions.js';
  import { lmsSession } from '../stores/lms.js';

  const entries = [
    { q: 'My lessons disappeared', a: 'Private window or cleared data. Use a normal window — your lessons are all still here.' },
    { q: 'It opened but nothing appeared', a: 'Close and reopen. If still blank, connect once — it works offline after that.' },
    { q: "I don't understand a question", a: 'Every question has a link: Why is this the answer? It goes to the lesson.' },
    { q: 'I keep getting one wrong', a: 'Normal. Nothing is scored against you.' },
    { q: 'Is the answer still correct?', a: 'Some answers change. Check uscis.gov/citizenship/testupdates before your interview.' },
    { q: 'Questions about my own case', a: 'This course teaches civics only. For your case, use uscis.gov or a qualified legal-service provider.' },
  ];

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

  {#each entries as e}
    <div class="mb-3.5">
      <p class="text-sm font-bold mb-0.5">{e.q}</p>
      <p class="text-sm text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">{e.a}</p>
    </div>
  {/each}

  <div class="border-t border-border dark:border-dark-border pt-3 mt-4 text-xs text-ink-muted dark:text-dark-ink-muted">
    <p class="mb-1">About: a self-paced civics course to help you prepare for the U.S. naturalization test.</p>
    <!-- Derived, never hardcoded. This line previously read "checked Aug 2026"
         while current-answers.json carried no date at all and every dynamic
         card said "not checked yet" — the app contradicting itself about
         whether anyone had verified anything. -->
    <p>
      Sources: USCIS M-1778 · National Archives / Library of Congress photos ·
      {#if ANSWERS_CHECKED}answers checked {ANSWERS_CHECKED}{:else}answers that change with elections have not been checked yet{/if}
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
      Start over (clears your progress)
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
        <button class="btn-secondary" on:click={() => (confirmingReset = false)}>Cancel</button>
        <button class="btn-primary" on:click={doReset}>Clear progress</button>
      </div>
    </div>
  {/if}
</div>
