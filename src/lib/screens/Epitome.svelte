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
  import { t } from '../i18n.js';
  import LessonBar from '../components/LessonBar.svelte';
  import NarrationButton from '../components/NarrationButton.svelte';
  import { seg } from '../narration-text.js';

  export let rerun = false; // true when re-shown at U2/U4/U6: one tap to pass

  // The four lines are keyed rather than literal, so this screen — which the
  // storyboard calls the epitome the whole course points back to — is not the
  // one place a Burmese learner drops into English. `$t` falls back to English
  // per key, so a half-translated set degrades line by line rather than
  // blanking.
  $: lang = $progress.language || 'en';

  // Keys, not text: the count has to be known before the first reactive pass,
  // because `revealed` is initialised from it below and a `$:` block has not
  // run yet at that point.
  const LINE_KEYS = [
    { icon: '👥', key: 'epitome.line1' },
    { icon: '🏛️', key: 'epitome.line2' },
    { icon: '📖', key: 'epitome.line3' },
    { icon: '📜', key: 'epitome.line4' },
  ];
  $: lines = LINE_KEYS.map((l) => ({ icon: l.icon, text: $t(l.key) }));

  // Re-shows arrive already revealed, per the storyboard's "one tap to pass".
  let revealed = rerun || $progress.epitomeSeen ? LINE_KEYS.length : 0;

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
    unitLabel={$t('epitome.unitLabel')}
    position="{revealed} of {lines.length}"
    onBack={() => navigate('/')}
  />

  <div class="flex-1 overflow-y-auto px-5 py-6">
    <!-- Reads only the lines revealed so far — the screen builds up one at a
         time, and narrating the unrevealed ones would give away the reveal.
         `lang` follows the learner, so the narration speaks the same language
         the lines are rendered in rather than reading Burmese with an English
         voice. -->
    <NarrationButton
      segments={[
        ...seg($t('epitome.heading'), lang),
        ...lines.slice(0, revealed).map((l) => ({ text: l.text, lang })),
        ...(allRevealed ? seg($t('epitome.closing'), lang) : []),
      ]}
      screenId="epitome"
      {lang}
      wrapperClass="mb-4"
    />
    <h1 class="text-heading font-bold mb-5" lang={lang === 'my' ? 'my' : undefined}>
      {$t('epitome.heading')}
    </h1>

    {#each lines as line, i}
      {#if i < revealed}
        <div class="flex items-start gap-3 border-b border-border dark:border-dark-border py-3">
          <span class="text-2xl leading-none shrink-0" aria-hidden="true">{line.icon}</span>
          <p class="font-bold" lang={lang === 'my' ? 'my' : undefined}>{line.text}</p>
        </div>
      {/if}
    {/each}

    {#if !allRevealed}
      <button class="btn-secondary mt-5" on:click={reveal}>
        {$t('epitome.showNext', { shown: revealed, total: lines.length })}
      </button>
    {:else}
      <p class="mt-5 leading-relaxed" lang={lang === 'my' ? 'my' : undefined}>
        {$t('epitome.closing')}
      </p>
    {/if}
  </div>

  {#if allRevealed}
    <div class="px-5 py-4 border-t border-border dark:border-dark-border">
      <button class="btn-primary" on:click={done}>{$t('epitome.startUnit1')}</button>
    </div>
  {/if}
</div>
