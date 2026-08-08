<script>
  import { t } from '../i18n.js';
  // G-18: every in-lesson screen must carry this. Added after a real design
  // failure — lesson screens originally had "Next" only, with no way back,
  // no way to Home, and therefore no way to Settings or Help mid-lesson.
  // A learner who chose the wrong language at first run was permanently
  // stuck with it. See storyboard v4.6 changelog for the full account.
  //
  // Both controls are text-labelled, not bare icons — consistent with the
  // research behind the Settings-placement decision (icon interpretation
  // is measurably harder for older adults).

  import { navigate } from '../router.js';

  export let unitLabel = '';
  export let position = '';   // e.g. "5 of 16"
  export let onBack = null;   // optional override; default goes to Home
  export let onExit = null;

  function handleBack() {
    if (onBack) onBack();
    else history.back();
  }
  function handleExit() {
    if (onExit) onExit();
    else navigate('/');
  }
</script>

<div class="flex items-center justify-between px-4 py-2.5 border-b border-border dark:border-dark-border min-h-11">
  <button
    class="tap inline-flex items-center text-sm font-bold underline underline-offset-2 text-ink dark:text-dark-ink px-1"
    on:click={handleBack}
  >
    {$t('common.back')}
  </button>
  <span class="text-xs text-ink-muted dark:text-dark-ink-muted text-center flex-1 px-2">
    {unitLabel}{unitLabel && position ? ' · ' : ''}{position}
  </span>
  <button
    class="tap inline-flex items-center text-sm font-bold underline underline-offset-2 text-ink dark:text-dark-ink px-1"
    on:click={handleExit}
  >
    {$t('common.exit')}
  </button>
</div>
