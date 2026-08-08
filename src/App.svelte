<script>
  import { route, parseRoute, navigate } from './lib/router.js';
  import { progress } from './lib/stores/progress.js';

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

  $: parsed = parseRoute($route);
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
