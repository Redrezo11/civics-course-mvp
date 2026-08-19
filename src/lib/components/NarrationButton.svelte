<script>
  // "Listen" — read this page aloud.
  //
  // The course targets learners preparing for an interview conducted in
  // English, many with limited reading fluency in either language. A page they
  // can hear is a page they can use, so this is a reach feature rather than a
  // convenience one.
  //
  // The button owns no playback. narration.js owns the single active engine,
  // which is what makes "two narrations never overlap" true by construction
  // rather than by every caller remembering to stop the last one.

  import { onDestroy } from 'svelte';
  import { t } from '../i18n.js';
  import { narration, play, pause, resume, cancel, canNarrate } from '../narration.js';

  export let text = '';
  export let screenId = '';
  export let lang = 'en';
  /** Optional explicit file. Normally left unset — narration.js resolves the
      recording from the manifest by screen id, so audio is a data drop. */
  export let audioSrc = '';
  /** Extra classes on the wrapper, for callers that centre it (Welcome). */
  export let wrapperClass = '';

  // A stable identity for this instance, so the store can tell whether THIS
  // button is the one playing. Two buttons on a page must not mirror each other.
  const me = {};

  $: state = $narration.owner === me ? $narration.state : 'idle';
  $: available = canNarrate({ text, audioSrc, screenId, lang });

  $: label =
    state === 'playing'
      ? $t('narration.pause')
      : state === 'paused'
        ? $t('narration.resume')
        : state === 'ended'
          ? $t('narration.listenAgain')
          : $t('narration.listen');

  function activate() {
    if (state === 'playing') pause();
    else if (state === 'paused') resume();
    else play({ owner: me, screenId, text, audioSrc, lang });
  }

  // Leaving the screen stops the narration. Lesson renders this inside its
  // {#key screen.id} block, so Next and Back destroy the button and land here;
  // Exit and every other navigation is caught by the route subscription in
  // narration.js.
  onDestroy(() => {
    if ($narration.owner === me) cancel();
  });
</script>

{#if available}
  <div class={wrapperClass}>
    <button
      class="tap inline-flex items-center gap-2 rounded-full border-2 border-accent dark:border-dark-accent
             px-3.5 py-2 text-sm font-bold text-ink dark:text-dark-ink bg-transparent transition-colors"
      on:click={activate}
    >
      <!--
        aria-hidden + focusable="false": the icon carries no information the
        label does not, and focusable="false" is what keeps IE/Edge legacy from
        putting SVGs in the tab order. The visible text IS the accessible name,
        so it is never overridden with aria-label.
      -->
      <span class="text-accent dark:text-dark-accent shrink-0" aria-hidden="true">
        {#if state === 'playing'}
          <!-- pause -->
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" focusable="false">
            <rect x="7" y="5" width="3.5" height="14" rx="1" />
            <rect x="13.5" y="5" width="3.5" height="14" rx="1" />
          </svg>
        {:else if state === 'paused'}
          <!-- play -->
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" focusable="false">
            <path d="M8 5.5v13a1 1 0 0 0 1.54.84l10-6.5a1 1 0 0 0 0-1.68l-10-6.5A1 1 0 0 0 8 5.5Z" />
          </svg>
        {:else if state === 'ended'}
          <!-- replay -->
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" focusable="false">
            <path d="M3 11a9 9 0 1 1 2.64 6.36" />
            <polyline points="3 4 3 11 10 11" />
          </svg>
        {:else}
          <!--
            Speaker, not a play triangle. Before anything has started the
            question the icon answers is "what kind of thing is this?", and a
            speaker says "this page can be read to you"; a bare triangle only
            says "something will start".
          -->
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" focusable="false">
            <path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" fill="currentColor" stroke-linejoin="round" />
            <path d="M16 9a4 4 0 0 1 0 6" />
            <path d="M18.5 6.5a7.5 7.5 0 0 1 0 11" />
          </svg>
        {/if}
      </span>
      <span aria-live="polite">{label}</span>
    </button>
  </div>
{/if}
