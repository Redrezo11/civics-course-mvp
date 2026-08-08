<script>
  import { t } from '../i18n.js';
  import { progress } from '../stores/progress.js';
  import { navigate } from '../router.js';

  function choose(lang) {
    progress.setLanguage(lang);
    navigate('/welcome');
  }
</script>

<div class="min-h-screen flex flex-col justify-center px-6 max-w-md mx-auto">
  <h1 class="text-heading font-bold text-center mb-6">{$t('language.heading')}</h1>
  <button class="btn-primary mb-3" on:click={() => choose('en')}>{$t('language.english')}</button>
  <button class="btn-secondary font-myanmar" on:click={() => choose('my')}>
    မြန်မာဘာသာ<br /><span class="font-sans font-normal text-sm">(Burmese)</span>
  </button>
  <p class="text-xs text-ink-muted dark:text-dark-ink-muted text-center mt-4">
    {$t('language.changeLater')}
  </p>
</div>
