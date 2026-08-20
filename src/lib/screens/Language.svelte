<script>
  import { t } from '../i18n.js';
  import { progress } from '../stores/progress.js';
  import { navigate } from '../router.js';
  import NarrationButton from '../components/NarrationButton.svelte';
  import { STANDALONE_NARRATION } from '../content/standalone-narration.js';

  function choose(lang) {
    progress.setLanguage(lang);
    navigate('/welcome');
  }
</script>

<div class="min-h-screen flex flex-col justify-center px-6 max-w-md mx-auto">
  <h1 class="text-heading font-bold text-center mb-6">{$t('language.heading')}</h1>
  <!--
    The one bilingual narration in the app, and the only place it makes sense:
    nobody has chosen a language yet, so there is no current language to fall
    back to. A learner who cannot read either script is otherwise stuck before
    the course begins, on the one screen where falling back to English is no
    help — English may be the problem.
  -->
  <NarrationButton
    segments={STANDALONE_NARRATION.language.segments}
    screenId="language"
    wrapperClass="flex justify-center mb-5"
  />
  <button class="btn-primary mb-3" on:click={() => choose('en')}>{$t('language.english')}</button>
  <button class="btn-secondary font-myanmar" on:click={() => choose('my')}>
    မြန်မာဘာသာ<br /><span class="font-sans font-normal text-sm">(Burmese)</span>
  </button>
  <p class="text-xs text-ink-muted dark:text-dark-ink-muted text-center mt-4">
    {$t('language.changeLater')}
  </p>
</div>
