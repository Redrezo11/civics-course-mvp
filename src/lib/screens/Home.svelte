<script>
  import { t } from '../i18n.js';
  import {
    progress,
    questionsPracticedCount,
    lessonsFinishedCount,
    courseComplete,
  } from '../stores/progress.js';
  import { navigate } from '../router.js';
  import { getUnitQuestions, TOTAL_QUESTIONS, ANSWERS_CHECKED } from '../content/questions.js';
  import { REVIEWS, unlockedReviews } from '../select-review.js';
  import { UNIT_IDS, unitTitleKey } from '../content/unit-titles.js';

  // Names come from ui-strings, not from a copy kept here. This list used to
  // hold its own — with U5/U6/U7 shortened, so the same unit read three ways
  // across three screens — and none of it was translated.
  $: units = UNIT_IDS.map((id) => ({ id, name: $t(unitTitleKey(id)) }));

  // All eight units are built: content authored from Storyboard v5.3 §5–6
  // and Question_Bank_Companion.md (all 128 questions).
  const builtUnits = ['U0', 'U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7'];

  // The primary card had a hardcoded "CONTINUE" label and picked the first unit
  // the learner had not *completed* — it never read where they actually were.
  // So on a fresh install it told a learner to continue something they had
  // never opened, and if they jumped ahead to U3 it still said Unit 0 because
  // no unit was complete yet.
  //
  // Three honest states instead.
  // `courseComplete`, not a local reactive. This screen and the LMS session
  // must agree on what finishing means, or a learner is congratulated here and
  // reported incomplete to whoever assigned them the course.
  $: allDone = $courseComplete;
  $: started = Boolean($progress.lastUnit) || $progress.unitsCompleted.length > 0;

  // Where Continue actually resumes: the unit last opened, if it is still a
  // real unit. Falls back to the first unit not yet completed.
  //
  // `lastUnit` only counts while it is UNFINISHED. It used to win outright, so
  // finishing Unit 1 left the home screen offering "CONTINUE — Unit 1" and
  // sending the learner back to its final screen. The fallback below was
  // already right and was simply never reached.
  $: resumeUnit =
    units.find(
      (u) =>
        u.id === $progress.lastUnit &&
        builtUnits.includes(u.id) &&
        !$progress.unitsCompleted.includes(u.id)
    ) ||
    units.find((u) => !$progress.unitsCompleted.includes(u.id) && builtUnits.includes(u.id)) ||
    units.find((u) => builtUnits.includes(u.id));

  // START carries no subtitle: naming the unit would only repeat the first row
  // of the list directly beneath it, and there is nowhere else to start from.
  // CONTINUE keeps its title because which unit you are returning to is the
  // one thing the learner cannot infer.
  $: primary = allDone
    ? { label: $t('home.practiceInterview'), title: $t('rehearsal.heading'), href: '/rehearsal' }
    : started
      ? { label: 'CONTINUE', title: `Unit ${resumeUnit.id.slice(1)} — ${resumeUnit.name}`, href: `/unit/${resumeUnit.id}` }
      : { label: 'START', title: '', href: `/unit/${resumeUnit.id}` };

  // Reviews unlock after U2, U5 and U7 (§8). They are shown only once earned —
  // an empty "Reviews" heading with nothing under it would be worse than
  // nothing, and a locked row here would repeat the mistake G-16 warns about.
  $: reviews = unlockedReviews($progress.unitsCompleted);

  // G-08 entry stays open from Home for any unit whose set is unfinished, so
  // full-bank practice is reachable without walking the lesson again.
  $: unfinishedBanks = units
    .filter((u) => u.id !== 'U0' && $progress.unitsCompleted.includes(u.id))
    .filter((u) => !$progress.fullBankDone.includes(u.id))
    .map((u) => ({ ...u, total: getUnitQuestions(u.id).length }));

  $: unpractised = TOTAL_QUESTIONS - $questionsPracticedCount;
</script>

<div class="min-h-screen flex flex-col">
  <div class="flex-1 px-5 py-6 max-w-md mx-auto w-full">
    <!-- Two honest counters — G-22. Never merged into one overstated claim. -->
    <div class="flex gap-2.5 mb-5">
      <div class="flex-1 text-center py-2.5 px-1.5 border border-border dark:border-dark-border rounded-card">
        <div class="text-xl font-bold">{$lessonsFinishedCount}<span class="text-xs font-normal text-ink-muted dark:text-dark-ink-muted"> of 8</span></div>
        <div class="text-[10px] text-ink-muted dark:text-dark-ink-muted">{$t('home.counterLessons')}</div>
      </div>
      <div class="flex-1 text-center py-2.5 px-1.5 border border-border dark:border-dark-border rounded-card">
        <div class="text-xl font-bold">{$questionsPracticedCount}<span class="text-xs font-normal text-ink-muted dark:text-dark-ink-muted"> of 128</span></div>
        <div class="text-[10px] text-ink-muted dark:text-dark-ink-muted">{$t('home.counterQuestions')}</div>
      </div>
    </div>

    {#if primary}
      <button
        class="tap w-full text-left bg-ink dark:bg-dark-accent text-surface dark:text-dark-accent-ink rounded-card p-4 mb-5"
        on:click={() => navigate(primary.href)}
      >
        {#if primary.title}
          <div class="text-[10px] tracking-wide opacity-70 mb-1">{primary.label}</div>
          <div class="text-base font-bold">{primary.title}</div>
        {:else}
          <div class="text-base font-bold tracking-wide">{primary.label}</div>
        {/if}
      </button>
    {/if}

    <!-- G-16: this line states the free-navigation affordance in words, not
         only visually. Every unit is reachable, so the claim is now true. -->
    <p class="text-sm font-bold mb-2">{$t('home.goToAnyLesson')}</p>
    <div class="border-t border-border dark:border-dark-border">
      {#each units as u}
        {@const built = builtUnits.includes(u.id)}
        {@const done = $progress.unitsCompleted.includes(u.id)}
        <button
          class="tap w-full flex items-center justify-between py-2.5 border-b border-border dark:border-dark-border text-sm text-left disabled:opacity-45"
          disabled={!built}
          on:click={() => built && navigate(`/unit/${u.id}`)}
        >
          <span class="text-ink-muted dark:text-dark-ink-muted w-6">{u.id}</span>
          <span class="flex-1 {built ? 'text-ink dark:text-dark-ink' : 'text-ink-muted dark:text-dark-ink-muted'}">{u.name}</span>
          {#if done}<span class="text-ink-muted dark:text-dark-ink-muted mr-1.5">✓</span>{/if}
          {#if built}<span class="text-ink-muted dark:text-dark-ink-muted">›</span>{/if}
        </button>
      {/each}
    </div>

    {#if reviews.length}
      <p class="text-sm font-bold mt-6 mb-2">{$t('home.reviews')}</p>
      <div class="border-t border-border dark:border-dark-border">
        {#each reviews as r}
          {@const done = $progress.reviewsDone.includes(r)}
          <button
            class="tap w-full flex items-center justify-between py-2.5 border-b border-border dark:border-dark-border text-sm text-left"
            on:click={() => navigate(`/review/${r}`)}
          >
            <span class="flex-1">{$t('home.reviewSubtitle', { name: REVIEWS[r].label })}</span>
            {#if done}<span class="text-ink-muted dark:text-dark-ink-muted mr-1.5">✓</span>{/if}
            <span class="text-ink-muted dark:text-dark-ink-muted">›</span>
          </button>
        {/each}
      </div>
    {/if}

    {#if unfinishedBanks.length}
      <p class="text-sm font-bold mt-6 mb-1">{$t('home.practiceEvery')}</p>
      <p class="text-xs text-ink-muted dark:text-dark-ink-muted mb-2">
        {$t('home.stillUnpracticed', { n: unpractised, total: TOTAL_QUESTIONS })}
      </p>
      <div class="border-t border-border dark:border-dark-border">
        {#each unfinishedBanks as u}
          <button
            class="tap w-full flex items-center justify-between py-2.5 border-b border-border dark:border-dark-border text-sm text-left"
            on:click={() => navigate(`/practice/${u.id}`)}
          >
            <span class="flex-1">{$t('home.allFromUnit', { n: u.total, name: u.name })}</span>
            <span class="text-ink-muted dark:text-dark-ink-muted">›</span>
          </button>
        {/each}
      </div>
    {/if}

    <p class="text-[10px] text-ink-muted dark:text-dark-ink-muted text-center mt-4">
      {#if ANSWERS_CHECKED}{$t('home.answersChecked', { date: ANSWERS_CHECKED })}{:else}{$t('home.someAnswersChange')}{/if} ·
      <button class="underline font-bold text-ink dark:text-dark-ink" on:click={() => navigate('/help')}>{$t('footer.help')}</button> ·
      <button class="underline font-bold text-ink dark:text-dark-ink" on:click={() => navigate('/settings')}>{$t('footer.settings')}</button>
    </p>
  </div>

  <div class="flex border-t border-border dark:border-dark-border bg-raised dark:bg-dark-raised">
    <div class="flex-1 text-center py-3 text-sm font-bold">{$t('nav.tabLearn')}</div>
    <button class="tap flex-1 text-center py-3 text-sm text-ink-muted dark:text-dark-ink-muted" on:click={() => navigate('/rehearsal')}>
      {$t('nav.tabRehearsal')}
    </button>
    <button class="tap flex-1 text-center py-3 text-sm text-ink-muted dark:text-dark-ink-muted" on:click={() => navigate('/questions')}>
      {$t('questionBank.allQuestions', { n: TOTAL_QUESTIONS })}
    </button>
  </div>
</div>
