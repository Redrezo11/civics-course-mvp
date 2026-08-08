<script>
  // E-01 · How America works (the whole picture). Storyboard §2.
  //
  // Elaboration Theory epitome + advance organizer: appears once after U0 and
  // before U1, and is re-shown pre-revealed at the top of U2, U4 and U6 as the
  // zoom-out. Every unit's Connect beat points back here.
  //
  // §9.3 standing rule: these four lines propagate course-wide, so any
  // inaccuracy here contradicts seven units at once. Line 1 reads "lawmakers
  // and the President" — NOT "the leaders" — because U2 teaches that judges
  // are appointed and serve for life precisely so they are not answerable to
  // anyone, and U3 teaches the Electoral College. That was error E3.

  import { progress } from '../stores/progress.js';
  import { navigate } from '../router.js';
  import LessonBar from '../components/LessonBar.svelte';

  export let rerun = false; // true when re-shown at U2/U4/U6: one tap to pass

  const lines = [
    { icon: '👥', text: 'The people choose the lawmakers and the President.' },
    {
      icon: '🏛️',
      text: 'The leaders work in three separate parts — so no one part becomes too strong.',
    },
    { icon: '📖', text: 'A written rulebook limits all of them.' },
    { icon: '📜', text: 'That rulebook is the Constitution.' },
  ];

  // Re-shows arrive already revealed, per the storyboard's "one tap to pass".
  let revealed = rerun || $progress.epitomeSeen ? lines.length : 0;

  function reveal() {
    if (revealed < lines.length) revealed += 1;
  }

  $: allRevealed = revealed === lines.length;

  function done() {
    progress.markEpitomeSeen();
    navigate('/unit/U1');
  }
</script>

<div class="min-h-screen flex flex-col max-w-md mx-auto">
  <LessonBar
    unitLabel="The whole picture"
    position="{revealed} of {lines.length}"
    onBack={() => navigate('/')}
  />

  <div class="flex-1 overflow-y-auto px-5 py-6">
    <h1 class="text-heading font-bold mb-5">How America works</h1>

    {#each lines as line, i}
      {#if i < revealed}
        <div class="flex items-start gap-3 border-b border-border dark:border-dark-border py-3">
          <span class="text-2xl leading-none shrink-0" aria-hidden="true">{line.icon}</span>
          <p class="font-bold">{line.text}</p>
        </div>
      {/if}
    {/each}

    {#if !allRevealed}
      <button class="btn-secondary mt-5" on:click={reveal}>
        Show the next line ({revealed} of {lines.length})
      </button>
    {:else}
      <p class="mt-5 leading-relaxed">
        Every lesson in this course explains one piece of this picture. By the end,
        you will see how all 128 test questions fit inside these four ideas.
      </p>
    {/if}
  </div>

  {#if allRevealed}
    <div class="px-5 py-4 border-t border-border dark:border-dark-border">
      <button class="btn-primary" on:click={done}>Start Unit 1</button>
    </div>
  {/if}
</div>
