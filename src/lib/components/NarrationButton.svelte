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
  import {
    narration,
    voices,
    play,
    pause,
    resume,
    cancel,
    narrationAvailability,
  } from '../narration.js';
  import { flatten } from '../narration-text.js';

  /** Language-tagged segments — the normal input. A bare `text` string still
      works and becomes a one-segment narration. */
  export let segments = null;
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

  // Recomputed when the voice list arrives. `getVoices()` is empty on the first
  // call in every Chromium browser, so a one-shot check at mount would decide
  // "this device has no Burmese" before the device had answered — and the
  // control would stay wrong for the life of the page.
  $: availability = narrationAvailability({ segments, text, audioSrc, screenId, lang }, $voices);
  $: available = availability.state !== 'unavailable';
  $: waiting = availability.state === 'loading';

  // What is on screen changes as the learner works: an answer is submitted and
  // feedback appears, Rehearsal reveals its answers, a guided item advances.
  // Narration must never keep reading the previous state — same rule as a stale
  // recording. Reset to idle so the button offers to read what is there NOW.
  $: signature = flatten(segments || []) + text;
  let lastSignature = null;
  $: if (signature !== lastSignature) {
    if (lastSignature !== null && $narration.owner === me) cancel();
    lastSignature = signature;
  }

  $: label =
    state === 'playing'
      ? $t('narration.pause')
      : state === 'paused'
        ? $t('narration.resume')
        : state === 'ended'
          ? $t('narration.listenAgain')
          : $t('narration.listen');

  /**
   * A short spoken-to-assistive-technology status, empty almost always.
   *
   * Deliberately NOT the play/pause state: a focused button announces its own
   * name change, and a live region on top of that says everything twice. This
   * carries only the things a name change cannot — that the device is still
   * finding its voices, and why nothing happened when it could not.
   */
  let status = '';

  $: unavailableMessage =
    availability.state === 'unavailable'
      ? availability.missing?.includes('my')
        ? $t('narration.unavailableMy')
        : $t('narration.unavailable')
      : '';

  function activate() {
    if (waiting) {
      // Tapped before the device listed its voices. Say so rather than doing
      // nothing at all, which reads as a broken button.
      status = $t('narration.preparing');
      return;
    }
    status = '';
    if (state === 'playing') pause();
    else if (state === 'paused') resume();
    else play({ owner: me, screenId, segments, text, audioSrc, lang });
  }

  // Leaving the screen stops the narration. Lesson renders this inside its
  // {#key screen.id} block, so Next and Back destroy the button and land here;
  // Exit and every other navigation is caught by the route subscription in
  // narration.js.
  onDestroy(() => {
    if ($narration.owner === me) cancel();
  });
</script>

{#if !available}
  <!--
    The device cannot speak this language, and saying so is the point.
    `aria-disabled` rather than `disabled`: a disabled button is removed from the
    tab order, so the one person who most needs the explanation — someone
    navigating by keyboard or screen reader — would never reach it. This stays
    focusable, announces its own name, and does nothing when activated.

    Same pill, same footprint, muted. It replaces the Listen control rather than
    sitting beside it, so no screen changes shape.
  -->
  <div class={wrapperClass}>
    <span
      class="tap inline-flex items-center gap-2 rounded-full border-2 border-border dark:border-dark-border
             px-3.5 py-2 text-sm font-bold text-ink-secondary dark:text-dark-ink-secondary bg-transparent"
      role="button"
      aria-disabled="true"
      tabindex="0"
    >
      <span class="shrink-0" aria-hidden="true">
        <!-- speaker with a slash: this page cannot be read aloud here -->
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" focusable="false">
          <path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" fill="currentColor" stroke-linejoin="round" />
          <line x1="16" y1="9" x2="21" y2="15" />
          <line x1="21" y1="9" x2="16" y2="15" />
        </svg>
      </span>
      <span>{unavailableMessage}</span>
    </span>
  </div>
{:else}
  <div class={wrapperClass}>
    <button
      class="tap inline-flex items-center gap-2 rounded-full border-2 border-accent dark:border-dark-accent
             px-3.5 py-2 text-sm font-bold text-ink dark:text-dark-ink bg-transparent transition-colors
             aria-disabled:opacity-60"
      aria-disabled={waiting ? 'true' : undefined}
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
      <!--
        No aria-live. Changing a button's accessible NAME is the correct pattern
        for play/pause — aria-pressed would have a screen reader announce "play
        button, off" while showing a pause icon. But a focused button announces
        its own name change already, so a live region on top of it says
        everything twice. That is worse on assessment screens, where submitting
        an answer changes the feedback and resets this button at the same moment.
      -->
      <span>{label}</span>
    </button>

    <!--
      Empty in normal use. Carries only what a button-name change cannot say:
      that the device has not finished listing its voices. Polite, so it waits
      for a gap rather than interrupting.
    -->
    <p class="sr-only" role="status" aria-live="polite">{status}</p>
  </div>
{/if}
