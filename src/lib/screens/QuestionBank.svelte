<script>
  import { navigate } from '../router.js';
  import allQuestionsU1 from '../content/questions-u1.json';

  // Day-one scope: only U1's 14 questions are loaded. Extensible — adding
  // a unit's questions is a data addition (new questions-uN.json + import
  // here), never a code change. This is the point of content-as-data.
  const questions = allQuestionsU1;

  let search = '';
  let expanded = null;

  $: filtered = questions.filter(
    (q) => q.official.toLowerCase().includes(search.toLowerCase())
  );
</script>

<div class="min-h-screen max-w-md mx-auto flex flex-col">
  <div class="px-5 py-6 flex-1">
    <button class="text-sm font-bold underline mb-4" on:click={() => navigate('/')}>‹ Back</button>

    <input
      type="text"
      bind:value={search}
      placeholder="Search questions..."
      class="w-full border border-border dark:border-dark-border rounded-card py-2.5 px-4 mb-4 bg-raised dark:bg-dark-raised text-ink dark:text-dark-ink"
    />

    <p class="text-xs text-ink-muted dark:text-dark-ink-muted mb-3">
      {filtered.length} of 128 questions loaded (Unit 1 · more unlock as units are authored)
    </p>

    {#each filtered as q}
      <div class="border border-border dark:border-dark-border rounded-card mb-2 overflow-hidden">
        <button
          class="w-full flex items-center justify-between py-2.5 px-4 text-left text-sm"
          on:click={() => (expanded = expanded === q.id ? null : q.id)}
        >
          <span>{q.id.slice(1)}. {q.official}{q.star ? ' ★' : ''}</span>
          <span class="text-ink-muted dark:text-dark-ink-muted ml-2">{expanded === q.id ? '︿' : '﹀'}</span>
        </button>
        {#if expanded === q.id}
          <div class="px-4 pb-4 text-sm">
            <ul class="mb-2 pl-4">
              {#each q.acceptedAnswers as a}<li>{a}</li>{/each}
            </ul>
            <button
              class="text-xs font-bold underline text-ink dark:text-dark-ink"
              on:click={() => navigate(`/unit/U1`)}
            >
              Why is this the answer? → 2 min
            </button>
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <div class="flex border-t border-border dark:border-dark-border bg-raised dark:bg-dark-raised">
    <button class="flex-1 text-center py-3 text-sm text-ink-muted dark:text-dark-ink-muted" on:click={() => navigate('/')}>
      Learn
    </button>
    <div class="flex-1 text-center py-3 text-sm font-bold">All 128 questions</div>
  </div>
</div>
