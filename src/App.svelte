<script>
  import { onMount } from 'svelte';
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

  onMount(() => {
    if (!$progress.language && $route === '/') {
      navigate('/language');
    }
    if ($progress.theme === 'dark') {
      document.documentElement.classList.add('dark');
    }
  });

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
