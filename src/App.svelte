<script>
  import { onMount } from 'svelte';
  import { route, parseRoute, navigate } from './lib/router.js';
  import { progress } from './lib/stores/progress.js';
  import * as cmi5 from './lib/cmi5.js';
  import { lmsSession } from './lib/stores/lms.js';

  import Language from './lib/screens/Language.svelte';
  import Welcome from './lib/screens/Welcome.svelte';
  import Home from './lib/screens/Home.svelte';
  import Lesson from './lib/screens/Lesson.svelte';
  import QuestionBank from './lib/screens/QuestionBank.svelte';
  import Help from './lib/screens/Help.svelte';
  import Settings from './lib/screens/Settings.svelte';
  import Epitome from './lib/screens/Epitome.svelte';
  import FullBank from './lib/screens/FullBank.svelte';
  import Review from './lib/screens/Review.svelte';
  import Rehearsal from './lib/screens/Rehearsal.svelte';
  import Completion from './lib/screens/Completion.svelte';

  // Both of these were in onMount, which runs once at boot and never again.
  // That made "start over" a half-reset: Help cleared storage and navigated to
  // Home, but the first-run redirect could not fire, so the app sat on Home
  // with language === null — a state it is not designed to be in. Only a manual
  // page reload produced a genuine first run. Same for the theme class: reset
  // restored theme:'light' while <html> kept the dark class.
  //
  // Reactive, so they track the store rather than a snapshot of it taken once.
  $: if (!$progress.language && $route === '/') {
    navigate('/language');
  }

  // Single owner of the dark class. Settings used to toggle it itself, which
  // meant two places could disagree about the theme.
  $: if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', $progress.theme === 'dark');
  }

  // Language on <html>: assistive technology had no way to know what it was
  // reading, and the Myanmar font stack has to apply document-wide rather than
  // per-component. `lang` is also what tells a screen reader to switch voice.
  $: if (typeof document !== 'undefined') {
    const lang = $progress.language || 'en';
    document.documentElement.lang = lang;
    document.documentElement.classList.toggle('font-myanmar', lang === 'my');
  }

  $: parsed = parseRoute($route);

  // The LMS session, if there is one.
  //
  // Not awaited before the first paint. The alternative — hold the whole course
  // back until a network round-trip finishes — punishes every learner on a slow
  // connection for a handshake that changes nothing they can see, and leaves a
  // blank screen if the LRS is down. The course renders; the session attaches
  // when it attaches; `init()` is a no-op when nothing launched us.
  onMount(async () => {
    const session = await cmi5.init();
    if (!session.active) return;
    lmsSession.set(true);

    // The LMS already asked which language they read. Asking again is a screen
    // the learner has to get past to reach a course they were assigned.
    const preferred = (session.languagePreference || '')
      .split(',')
      .map((tag) => tag.trim().toLowerCase().split('-')[0])
      .find((tag) => tag === 'en' || tag === 'my');
    if (preferred && !$progress.language) {
      progress.setLanguage(preferred);
      if ($route === '/language') navigate('/welcome');
    }
  });
</script>

<!-- Route map, storyboard §6. Unknown hashes fall through to Home rather than
     rendering an error page — there is no server to serve one, and a learner
     who mistypes should land somewhere useful. -->
{#if $route === '/language'}
  <Language />
{:else if $route === '/welcome'}
  <Welcome />
{:else if $route === '/help'}
  <Help />
{:else if $route === '/settings'}
  <Settings />
{:else if $route === '/questions'}
  <QuestionBank />
{:else if $route === '/epitome'}
  <Epitome />
{:else if $route === '/rehearsal'}
  <Rehearsal />
{:else if $route === '/completion'}
  <Completion />
{:else if parsed.practice}
  <FullBank unitId={parsed.practice} />
{:else if parsed.review}
  <Review reviewId={parsed.review} />
{:else if parsed.unit}
  <Lesson unitId={parsed.unit} />
{:else}
  <Home />
{/if}
