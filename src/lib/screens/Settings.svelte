<script>
  // Burmese is real but partial: the mechanism resolves a per-unit overlay and
  // falls back to English wherever no translation exists (v1.1 plan §5 — a
  // partial translation must never break the course).
  //
  // The old copy claimed "Lessons and buttons change language", which was false
  // when nothing read the language at all, and would be misleading now that
  // only part of Lesson 1 is translated. This screen states actual coverage.
  import { progress } from '../stores/progress.js';
  import { navigate } from '../router.js';
  import { t } from '../i18n.js';
  import translationStatus from '../content/translations/my/unit1.json';

  function setLang(lang) {
    progress.setLanguage(lang);
  }

  // Only stores the choice. App.svelte owns the dark class and the lang
  // attribute, and applies both reactively — two owners meant a reset could
  // clear the stored theme while the class stayed on.
  function setTheme(theme) {
    progress.setTheme(theme);
  }

  // Burmese ships from a source still marked draft-unreviewed, so it is
  // labelled rather than presented as finished.
  const burmeseIsDraft = Object.keys(translationStatus).length > 0;
</script>

<div class="min-h-screen max-w-md mx-auto px-5 py-6">
  <div class="flex items-center mb-6">
    <button class="tap inline-flex items-center text-sm font-bold underline" on:click={() => navigate('/')}>
      {$t('settings.back')}
    </button>
  </div>

  <h1 class="text-heading font-bold mb-6">{$t('settings.title')}</h1>

  <p class="text-sm font-bold text-ink-muted dark:text-dark-ink-muted mb-2">{$t('settings.language')}</p>
  <button
    class={$progress.language === 'en' ? 'btn-primary mb-2.5' : 'btn-secondary mb-2.5'}
    on:click={() => setLang('en')}
  >English</button>
  <button
    class={$progress.language === 'my' ? 'btn-primary mb-2.5 font-myanmar' : 'btn-secondary mb-2.5 font-myanmar'}
    on:click={() => setLang('my')}
  >
    မြန်မာဘာသာ Burmese{#if burmeseIsDraft}<span class="font-sans font-normal text-xs"> ({$t('settings.draftBadge')})</span>{/if}
  </button>

  <!-- Coverage, stated plainly and per language. -->
  <p class="text-xs text-ink-secondary dark:text-dark-ink-secondary mb-2 leading-relaxed">
    {$progress.language === 'my' ? $t('settings.coverage.my') : $t('settings.coverage.en')}
  </p>
  <p class="text-xs text-ink-secondary dark:text-dark-ink-secondary mb-2 leading-relaxed">
    {$t('settings.testStaysEnglish')}
  </p>
  <!--
    Only in Burmese, and only because the screen would otherwise be misleading:
    English answer options are a deliberate choice, not translation that has not
    arrived yet, and the line above tells the learner that untranslated things
    stay English. Without this they read the answers as missing work.
  -->
  {#if $progress.language === 'my'}
    <p class="text-xs text-ink-secondary dark:text-dark-ink-secondary mb-6 leading-relaxed">
      {$t('settings.answersStayEnglish')}
    </p>
  {:else}
    <div class="mb-4"></div>
  {/if}

  <p class="text-sm font-bold text-ink-muted dark:text-dark-ink-muted mb-2">{$t('settings.theme')}</p>
  <div class="flex gap-2 mb-6">
    <button
      class={$progress.theme === 'light' ? 'btn-primary' : 'btn-secondary'}
      on:click={() => setTheme('light')}
    >{$t('settings.light')}</button>
    <button
      class={$progress.theme === 'dark' ? 'btn-primary' : 'btn-secondary'}
      on:click={() => setTheme('dark')}
    >{$t('settings.dark')}</button>
  </div>

  <button class="btn-primary" on:click={() => navigate('/')}>{$t('settings.done')}</button>
  <p class="text-[10px] text-ink-muted dark:text-dark-ink-muted text-center mt-4">
    {$t('settings.saved')}
  </p>
</div>
