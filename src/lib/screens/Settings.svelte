<script>
  import { progress } from '../stores/progress.js';
  import { navigate } from '../router.js';

  // MVP scope note: Burmese is stubbed, not translated. Selecting it here
  // sets the preference (so the choice is remembered and the UI is honest
  // about what's chosen) but screen content stays English until the
  // translation workstream (Phase 2, native-reviewed) is complete.
  function setLang(lang) { progress.setLanguage(lang); }
  function setTheme(theme) {
    progress.setTheme(theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }
</script>

<div class="min-h-screen max-w-md mx-auto px-5 py-6">
  <div class="flex items-center mb-6">
    <button class="tap inline-flex items-center text-sm font-bold underline" on:click={() => navigate('/')}>‹ Back</button>
  </div>

  <h1 class="text-heading font-bold mb-6">Settings</h1>

  <p class="text-sm font-bold text-ink-muted dark:text-dark-ink-muted mb-2">Language</p>
  <button
    class={$progress.language === 'en' ? 'btn-primary mb-2.5' : 'btn-secondary mb-2.5'}
    on:click={() => setLang('en')}
  >English</button>
  <button
    class={$progress.language === 'my' ? 'btn-primary mb-2.5 font-myanmar' : 'btn-secondary mb-2.5 font-myanmar'}
    on:click={() => setLang('my')}
  >မြန်မာဘာသာ Burmese</button>
  <p class="text-xs text-ink-secondary dark:text-dark-ink-secondary mb-6 leading-relaxed">
    Lessons and buttons change language. Test questions and answers stay in English —
    that is the language of the real interview.
  </p>

  <p class="text-sm font-bold text-ink-muted dark:text-dark-ink-muted mb-2">Theme</p>
  <div class="flex gap-2 mb-6">
    <button
      class={$progress.theme === 'light' ? 'btn-primary' : 'btn-secondary'}
      on:click={() => setTheme('light')}
    >Light</button>
    <button
      class={$progress.theme === 'dark' ? 'btn-primary' : 'btn-secondary'}
      on:click={() => setTheme('dark')}
    >Dark</button>
  </div>

  <button class="btn-primary" on:click={() => navigate('/')}>Done</button>
  <p class="text-[10px] text-ink-muted dark:text-dark-ink-muted text-center mt-4">
    Your choice is saved on this phone.
  </p>
</div>
