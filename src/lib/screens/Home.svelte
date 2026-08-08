<script>
  import { progress, questionsPracticedCount, lessonsFinishedCount } from '../stores/progress.js';
  import { navigate } from '../router.js';

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

  // Day-one prototype scope: only U0 and U1 have real content.
  // U2–U7 render as visible, honestly-locked stub cards — never a fake
  // "coming soon" that pretends to be tappable content.
  const builtUnits = ['U0', 'U1'];

  $: nextUnit = units.find((u) => !$progress.unitsCompleted.includes(u.id) && builtUnits.includes(u.id))
    || units.find((u) => builtUnits.includes(u.id));
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
        class="w-full text-left bg-ink dark:bg-dark-accent text-surface dark:text-dark-accent-ink rounded-card p-4 mb-5"
        on:click={() => navigate(`/unit/${nextUnit.id}`)}
      >
        <div class="text-[10px] tracking-wide opacity-70 mb-1">CONTINUE</div>
        <div class="text-base font-bold">Unit {nextUnit.id.slice(1)} — {nextUnit.name}</div>
      </button>
    {/if}

    <!-- Heading states only what is true. The earlier "Or go to any lesson:"
         claimed access to all eight while U2–U7 render disabled — the exact
         kind of overstated claim G-22 exists to prevent. -->
    <p class="text-sm font-bold mb-2">Lessons</p>
    <p class="text-xs text-ink-muted dark:text-dark-ink-muted mb-2">
      {builtUnits.length} of {units.length} are ready in this prototype. The rest are
      listed so you can see what the full course covers.
    </p>
    <div class="border-t border-border dark:border-dark-border">
      {#each units as u}
        {@const built = builtUnits.includes(u.id)}
        {@const done = $progress.unitsCompleted.includes(u.id)}
        <button
          class="w-full flex items-center justify-between py-2.5 border-b border-border dark:border-dark-border text-sm text-left disabled:opacity-45"
          disabled={!built}
          on:click={() => built && navigate(`/unit/${u.id}`)}
        >
          <span class="text-ink-muted dark:text-dark-ink-muted w-6">{u.id}</span>
          <span class="flex-1 {built ? 'text-ink dark:text-dark-ink' : 'text-ink-muted dark:text-dark-ink-muted'}">{u.name}</span>
          {#if done}<span class="text-ink-muted dark:text-dark-ink-muted mr-1.5">✓</span>{/if}
          <!-- Unavailability is stated in words, not signalled by dimming
               alone (§8: state is never conveyed by visual treatment only).
               "Not built yet" is factual — deliberately not a "coming soon"
               that implies content exists behind the row. -->
          {#if built}
            <span class="text-ink-muted dark:text-dark-ink-muted">›</span>
          {:else}
            <span class="text-[10px] text-ink-muted dark:text-dark-ink-muted">Not built yet</span>
          {/if}
        </button>
      {/each}
    </div>

    <p class="text-[10px] text-ink-muted dark:text-dark-ink-muted text-center mt-4">
      Answers checked: Aug 2026 ·
      <button class="underline font-bold text-ink dark:text-dark-ink" on:click={() => navigate('/help')}>Help</button> ·
      <button class="underline font-bold text-ink dark:text-dark-ink" on:click={() => navigate('/settings')}>Settings</button>
    </p>
  </div>

  <div class="flex border-t border-border dark:border-dark-border bg-raised dark:bg-dark-raised">
    <div class="flex-1 text-center py-3 text-sm font-bold">Learn</div>
    <button class="flex-1 text-center py-3 text-sm text-ink-muted dark:text-dark-ink-muted" on:click={() => navigate('/questions')}>
      All 128 questions
    </button>
  </div>
</div>
