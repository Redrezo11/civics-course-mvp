<script>
  import { navigate } from '../router.js';
  import { t } from '../i18n.js';
  import { progress } from '../stores/progress.js';
  import NarrationButton from '../components/NarrationButton.svelte';
  import ScreenImage from '../components/ScreenImage.svelte';
  import { STANDALONE_NARRATION } from '../content/standalone-narration.js';

  // This screen used to be hardcoded English regardless of the language chosen
  // one screen earlier, on /language — the first thing a Burmese-reading
  // learner saw after picking their language was English, because nothing here
  // read $progress.language at all. Heading and body now come from
  // ui-strings.json through $t(), which falls back to English on its own if a
  // key has no Burmese yet, so a missing translation degrades rather than
  // breaks.
  $: lang = $progress.language || 'en';

  // The narration registry carries both languages; this screen speaks only the
  // one matching $lang. (`language` is the one entry meant to read every
  // segment regardless — see its `bilingual` flag.)
  $: welcomeSegments = STANDALONE_NARRATION.welcome.segments.filter((s) => s.lang === lang);
</script>

<div class="min-h-screen flex flex-col max-w-md mx-auto px-6 py-8">
  <div class="flex-1 flex flex-col justify-center">
    <!-- Companion character placeholder — asset not yet generated. Exact
         footprint reserved so dropping the real illustration in later
         causes no layout shift (Colour_Scheme_and_Asset_Direction.md §5). -->
    <div class="w-full max-w-[200px] mx-auto mb-6">
      <ScreenImage image="companion-welcome.webp" decorative wrapperClass="" />
    </div>
    <h1 class="text-heading font-bold text-center mb-3" lang={lang === 'my' ? 'my' : undefined}>
      {$t('welcome.heading')}
    </h1>
    <p class="text-base text-center mb-8" lang={lang === 'my' ? 'my' : undefined}>
      {$t('welcome.body')}
    </p>
    <NarrationButton
      segments={welcomeSegments}
      screenId="welcome"
      lang={lang === 'my' && welcomeSegments.length ? 'my' : 'en'}
      wrapperClass="flex justify-center mb-6"
    />
    <button class="btn-primary" on:click={() => navigate('/')}>{$t('common.start')}</button>
  </div>
  <p class="text-[11px] text-ink-muted dark:text-dark-ink-muted text-center mt-6">
    {$t('welcome.footnote')}
  </p>
</div>
