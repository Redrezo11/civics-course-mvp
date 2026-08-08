<script>
  import { onMount } from 'svelte';
  import { navigate } from '../router.js';
  import { progress, questionsPracticedCount } from '../stores/progress.js';
  import { getQuestion } from '../content/questions.js';
  import LessonBar from '../components/LessonBar.svelte';
  import QuestionCard from '../components/QuestionCard.svelte';
  import SingleSelect from '../components/SingleSelect.svelte';
  import VocabDeck from '../components/VocabDeck.svelte';
  import GuidedPractice from '../components/GuidedPractice.svelte';
  import ReadAndAnswer from '../components/ReadAndAnswer.svelte';

  import unit0 from '../content/unit0.json';
  import unit1 from '../content/unit1.json';

  export let unitId;

  const units = { U0: unit0, U1: unit1 };
  $: unit = units[unitId];

  let index = 0;
  let interactionDone = false; // set true when a self-advancing component signals completion

  // Screen types that manage their own "did the learner finish this" state
  // rather than always showing the parent's Next button immediately.
  const selfPaced = new Set(['vocab', 'guidedPractice', 'tryOne', 'practice', 'readAndAnswer', 'hook']);

  onMount(() => {
    // Resume at the saved position, if any (G-5 — progress saves every screen).
    const saved = $progress.screenPosition[unitId];
    if (saved) {
      const i = unit.screens.findIndex((s) => s.id === saved);
      if (i >= 0) index = i;
    }
  });

  $: screen = unit?.screens[index];
  $: isLast = unit && index === unit.screens.length - 1;
  $: if (screen) { interactionDone = false; }

  $: if (screen) {
    progress.saveScreenPosition(unitId, screen.id);
  }

  function next() {
    if (isLast) {
      progress.markUnitComplete(unitId);
      navigate('/');
      return;
    }
    index += 1;
  }
  function back() {
    if (index === 0) navigate('/');
    else index -= 1;
  }

  function positionLabel() {
    return unitId === 'U0' ? `${index + 1} of ${unit.screens.length}` : `${index + 1} of ${unit.screens.length}`;
  }

  // Guided-practice and single-item practice screens all funnel answers
  // through here, into the one storage chokepoint (storage.js note).
  function handleAnswer(questionId, correct) {
    progress.recordAnswer(questionId, correct);
  }
</script>

{#if !unit}
  <div class="p-6">Unit not found.</div>
{:else}
  <div class="min-h-screen flex flex-col max-w-md mx-auto">
    <LessonBar
      unitLabel={unit.title}
      position={positionLabel()}
      onBack={back}
    />

    <div class="flex-1 overflow-y-auto px-5 py-6">
      {#if screen.type === 'info'}
        {#if screen.image}
          <div class="w-full aspect-video mb-4 rounded-photo bg-[repeating-linear-gradient(135deg,theme(colors.border),theme(colors.border)_10px,theme(colors.surface)_10px,theme(colors.surface)_20px)] flex items-center justify-center text-xs text-ink-muted">
            {screen.image}
          </div>
        {/if}
        {#if screen.heading}<h1 class="text-thesis font-bold mb-3">{screen.heading}</h1>{/if}
        {#if screen.clueList}
          <div class="border-t border-border dark:border-dark-border mb-3">
            {#each screen.clueList as [word, meaning]}
              <div class="flex justify-between py-2 border-b border-border dark:border-dark-border text-sm">
                <span class="font-bold">{word}</span>
                <span class="text-ink-secondary dark:text-dark-ink-secondary">→ {meaning}</span>
              </div>
            {/each}
          </div>
        {/if}
        {#if screen.bodyList}
          <ul class="space-y-2 mb-4">
            {#each screen.bodyList as line}<li class="font-bold">{line}</li>{/each}
          </ul>
        {:else if screen.body}
          <p class="mb-4">{screen.body}</p>
        {/if}
        {#if screen.smallPrint}<p class="text-sm text-ink-secondary dark:text-dark-ink-secondary mb-3">{screen.smallPrint}</p>{/if}
        {#if screen.privacyLine}
          <p class="text-sm font-bold mb-4">{screen.privacyLine}</p>
        {/if}

      {:else if screen.type === 'tryOne'}
        {@const q = getQuestion(screen.questionId)}
        <p class="mb-3">{screen.body}</p>
        <QuestionCard text={q.official} />
        <SingleSelect
          options={q.options}
          correctIndex={q.correctIndex}
          on:answer={(e) => { handleAnswer(q.id, e.detail.correct); interactionDone = true; }}
        />

      {:else if screen.type === 'orient'}
        <p class="text-xs text-ink-muted dark:text-dark-ink-muted mb-1">{screen.unitLabel}</p>
        <h1 class="text-heading font-bold mb-4">{screen.heading}</h1>
        <p class="mb-3">{screen.body}</p>
        <QuestionCard text={getQuestion(screen.sampleQuestionId).official} />
        <p class="mb-3">{screen.afterQuote}</p>
        <div class="border border-border-interactive dark:border-dark-border-interactive rounded-card py-3 px-4 text-center font-bold mb-4">
          {screen.coverageLine}
        </div>
        <p class="text-sm text-ink-secondary dark:text-dark-ink-secondary">{screen.afterTest}</p>

      {:else if screen.type === 'hook'}
        <div class="w-16 h-16 rounded-full mx-auto mb-4 bg-[repeating-linear-gradient(135deg,theme(colors.border),theme(colors.border)_6px,theme(colors.surface)_6px,theme(colors.surface)_12px)]"></div>
        <h1 class="text-thesis font-bold text-center mb-5">{screen.question}</h1>
        {#each screen.options as opt, i}
          <button
            class="btn-secondary mb-2.5 disabled:opacity-70"
            disabled={interactionDone}
            on:click={() => { interactionDone = true; }}
          >{opt}</button>
        {/each}
        {#if interactionDone}
          <p class="text-sm mt-4 p-3 rounded-card border border-border dark:border-dark-border leading-relaxed">
            {screen.feedback}
          </p>
        {/if}

      {:else if screen.type === 'connect'}
        {#each screen.bodyList as line, i}
          <p class="{i === 0 ? 'font-bold' : ''} mb-3">{line}</p>
        {/each}
        {#if screen.bodyList2}
          <div class="h-3"></div>
          {#each screen.bodyList2 as line}<p class="font-bold mb-3">{line}</p>{/each}
        {/if}
        {#if screen.closing}<p class="text-lg font-bold mt-4">{screen.closing}</p>{/if}

      {:else if screen.type === 'vocab'}
        <VocabDeck cards={screen.cards} on:done={() => (interactionDone = true)} />

      {:else if screen.type === 'bigIdea'}
        {#if screen.image}
          <div class="w-full aspect-video mb-4 rounded-photo bg-[repeating-linear-gradient(135deg,theme(colors.border),theme(colors.border)_10px,theme(colors.surface)_10px,theme(colors.surface)_20px)] flex items-center justify-center text-xs text-ink-muted">
            {screen.image}
          </div>
        {/if}
        {#if screen.paragraphs}
          {#each screen.paragraphs as p, i}
            <p class="{i === 0 ? 'text-thesis font-bold' : ''} mb-3 leading-relaxed">{p}</p>
          {/each}
        {/if}
        {#if screen.twoColumn}
          <div class="space-y-4 mb-4">
            {#each screen.twoColumn as col}
              <div>
                <div class="w-full aspect-video mb-2 rounded-photo bg-[repeating-linear-gradient(135deg,theme(colors.border),theme(colors.border)_10px,theme(colors.surface)_10px,theme(colors.surface)_20px)] flex items-center justify-center text-xs text-ink-muted">{col.image}</div>
                <p class="font-bold mb-1">{col.heading}</p>
                <p class="text-sm">{col.body}</p>
              </div>
            {/each}
          </div>
        {/if}
        {#if screen.closing}<p class="mb-3">{screen.closing}</p>{/if}
        {#if screen.resolution}<p class="text-sm text-ink-secondary dark:text-dark-ink-secondary mb-3">{screen.resolution}</p>{/if}
        {#if screen.handle}
          <div class="border-t border-border dark:border-dark-border pt-4 mt-2">
            <p class="font-bold">{screen.handle}</p>
            {#if screen.handleSub}<p class="text-sm text-ink-secondary dark:text-dark-ink-secondary mt-1">{screen.handleSub}</p>{/if}
          </div>
        {/if}

      {:else if screen.type === 'seeItNotIt'}
        <h1 class="text-thesis font-bold mb-4">{screen.heading}</h1>
        <p class="mb-4">{screen.example}</p>
        <p class="text-ink-secondary dark:text-dark-ink-secondary mb-5">{screen.nonExample}</p>
        <p class="font-bold text-lg">{screen.takeaway}</p>

      {:else if screen.type === 'confusablePair'}
        <h1 class="text-thesis font-bold mb-5">{screen.heading}</h1>
        <p class="font-bold mb-0.5">{screen.termA.name}</p>
        <p class="text-sm text-ink-secondary dark:text-dark-ink-secondary mb-4">{screen.termA.def}</p>
        <p class="font-bold mb-0.5">{screen.termB.name}</p>
        <p class="text-sm text-ink-secondary dark:text-dark-ink-secondary mb-5">{screen.termB.def}</p>
        <p class="font-bold">{screen.resolution}</p>

      {:else if screen.type === 'guidedPractice'}
        <GuidedPractice
          items={screen.items}
          on:answer={(e) => handleAnswer(e.detail.id, e.detail.correct)}
          on:alldone={() => (interactionDone = true)}
        />

      {:else if screen.type === 'officialQuestions'}
        <p class="mb-1">One idea.</p>
        <h1 class="text-heading font-bold mb-4">{screen.questionIds.length} real questions.</h1>
        {#each screen.questionIds.slice(0, 6) as qid}
          {@const q = getQuestion(qid)}
          <div class="question-card !py-3">
            <span class="question-tag">Q</span>
            <p class="text-sm font-bold m-0">{q.official}{q.star ? ' ★' : ''}</p>
          </div>
        {/each}
        {#if screen.questionIds.length > 6}
          <p class="text-xs text-ink-muted dark:text-dark-ink-muted">+ {screen.questionIds.length - 6} more</p>
        {/if}
        {#if screen.q14Note}
          <div class="border border-border dark:border-dark-border rounded-card p-3 mt-3 text-sm">
            {screen.q14Note}
          </div>
        {/if}

      {:else if screen.type === 'practice'}
        {@const q = getQuestion(screen.questionId)}
        <QuestionCard text={q.official} />
        <SingleSelect
          options={q.options}
          correctIndex={q.correctIndex}
          on:answer={(e) => { handleAnswer(q.id, e.detail.correct); interactionDone = true; }}
        />

      {:else if screen.type === 'readAndAnswer'}
        {@const q = getQuestion(screen.questionId)}
        <QuestionCard text={q.official} />
        <p class="font-bold text-center my-4">Do you know the answer?<br />Say it to yourself before you look.</p>
        <ReadAndAnswer {q} on:answer={(e) => { handleAnswer(q.id, e.detail.correct); interactionDone = true; }} />

      {:else if screen.type === 'lockItIn'}
        <h2 class="text-heading font-bold text-center mb-3">{screen.heading}</h2>
        <div class="w-16 h-16 rounded-full mx-auto mb-4 bg-[repeating-linear-gradient(135deg,theme(colors.border),theme(colors.border)_6px,theme(colors.surface)_6px,theme(colors.surface)_12px)]"></div>
        <p class="text-sm text-center mb-5">{screen.learnedLine}</p>
        {#if screen.fullBankOffer}
          <button class="btn-primary mb-2.5">Practice all {screen.fullBankOffer.total} questions</button>
        {/if}
        <p class="text-xs text-ink-muted dark:text-dark-ink-muted text-center mt-4">{screen.askSomeone}</p>
      {/if}
    </div>

    {#if !selfPaced.has(screen.type) || interactionDone}
      <div class="px-5 py-4 border-t border-border dark:border-dark-border">
        <button class="btn-primary" on:click={next}>
          {screen.primaryLabel || (isLast ? 'Finish' : 'Next')}
        </button>
      </div>
    {/if}
  </div>
{/if}
