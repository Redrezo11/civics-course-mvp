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
{:else if parsed.unit}
  <Lesson unitId={parsed.unit} />
{:else}
  <Home />
{/if}
