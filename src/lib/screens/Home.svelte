<script>
  import { progress, questionsPracticedCount, lessonsFinishedCount } from '../stores/progress.js';
  import { navigate } from '../router.js';
  import { getUnitQuestions, TOTAL_QUESTIONS, ANSWERS_CHECKED } from '../content/questions.js';
  import { REVIEWS, unlockedReviews } from '../select-review.js';

  const units = [
    { id: 'U0', name: 'Test day' },
    { id: 'U1', name: 'We the People' },
    { id: 'U2', name: 'Three branches' },
    { id: 'U3', name: 'Who represents you' },
    { id: 'U4', name: 'Federal and state' },
    { id: 'U5', name: 'Rights' },
    { id: 'U6', name: 'America began' },
    { id: 'U7', name: 'America changed' },
  ];

  // All eight units are built: content authored from Storyboard v5.3 §5–6
  // and Question_Bank_Companion.md (all 128 questions).
  const builtUnits = ['U0', 'U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7'];

  $: nextUnit = units.find((u) => !$progress.unitsCompleted.includes(u.id) && builtUnits.includes(u.id))
    || units.find((u) => builtUnits.includes(u.id));

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
        <div class="text-[10px] text-ink-muted dark:text-dark-ink-muted">lessons finished</div>
      </div>
      <div class="flex-1 text-center py-2.5 px-1.5 border border-border dark:border-dark-border rounded-card">
        <div class="text-xl font-bold">{$questionsPracticedCount}<span class="text-xs font-normal text-ink-muted dark:text-dark-ink-muted"> of 128</span></div>
        <div class="text-[10px] text-ink-muted dark:text-dark-ink-muted">questions practiced</div>
      </div>
    </div>

    {#if nextUnit}
      <button
        class="tap w-full text-left bg-ink dark:bg-dark-accent text-surface dark:text-dark-accent-ink rounded-card p-4 mb-5"
        on:click={() => navigate(`/unit/${nextUnit.id}`)}
      >
        <div class="text-[10px] tracking-wide opacity-70 mb-1">CONTINUE</div>
        <div class="text-base font-bold">Unit {nextUnit.id.slice(1)} — {nextUnit.name}</div>
      </button>
    {/if}

    <!-- G-16: this line states the free-navigation affordance in words, not
         only visually. Every unit is reachable, so the claim is now true. -->
    <p class="text-sm font-bold mb-2">Or go to any lesson:</p>
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
      <p class="text-sm font-bold mt-6 mb-2">Reviews</p>
      <div class="border-t border-border dark:border-dark-border">
        {#each reviews as r}
          {@const done = $progress.reviewsDone.includes(r)}
          <button
            class="tap w-full flex items-center justify-between py-2.5 border-b border-border dark:border-dark-border text-sm text-left"
            on:click={() => navigate(`/review/${r}`)}
          >
            <span class="flex-1">{REVIEWS[r].label} — questions from every lesson so far</span>
            {#if done}<span class="text-ink-muted dark:text-dark-ink-muted mr-1.5">✓</span>{/if}
            <span class="text-ink-muted dark:text-dark-ink-muted">›</span>
          </button>
        {/each}
      </div>
    {/if}

    {#if unfinishedBanks.length}
      <p class="text-sm font-bold mt-6 mb-1">Practice every question</p>
      <p class="text-xs text-ink-muted dark:text-dark-ink-muted mb-2">
        Optional. {unpractised} of {TOTAL_QUESTIONS} are still unpracticed.
      </p>
      <div class="border-t border-border dark:border-dark-border">
        {#each unfinishedBanks as u}
          <button
            class="tap w-full flex items-center justify-between py-2.5 border-b border-border dark:border-dark-border text-sm text-left"
            on:click={() => navigate(`/practice/${u.id}`)}
          >
            <span class="flex-1">All {u.total} from {u.name}</span>
            <span class="text-ink-muted dark:text-dark-ink-muted">›</span>
          </button>
        {/each}
      </div>
    {/if}

    <p class="text-[10px] text-ink-muted dark:text-dark-ink-muted text-center mt-4">
      {#if ANSWERS_CHECKED}Answers checked: {ANSWERS_CHECKED}{:else}Some answers change — check uscis.gov{/if} ·
      <button class="underline font-bold text-ink dark:text-dark-ink" on:click={() => navigate('/help')}>Help</button> ·
      <button class="underline font-bold text-ink dark:text-dark-ink" on:click={() => navigate('/settings')}>Settings</button>
    </p>
  </div>

  <div class="flex border-t border-border dark:border-dark-border bg-raised dark:bg-dark-raised">
    <div class="flex-1 text-center py-3 text-sm font-bold">Learn</div>
    <button class="tap flex-1 text-center py-3 text-sm text-ink-muted dark:text-dark-ink-muted" on:click={() => navigate('/rehearsal')}>
      Rehearsal
    </button>
    <button class="tap flex-1 text-center py-3 text-sm text-ink-muted dark:text-dark-ink-muted" on:click={() => navigate('/questions')}>
      All {TOTAL_QUESTIONS} questions
    </button>
  </div>
</div>
