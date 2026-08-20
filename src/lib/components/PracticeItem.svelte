<script>
  // One official test question, rendered the one sanctioned way.
  //
  // Used by lesson Independent practice, G-08 full-bank sets, and R1–R3, so
  // that all three are structurally identical — the storyboard requires the
  // full-bank set to use "the same single-select format as core practice",
  // and reviews to draw on "the same option sets already written".
  //
  // Three shapes, decided by the data, never by the caller:
  //   ◆ dynamic  → current-answer card, never graded
  //   multiSelect → "any N of these", count stated (G-19)
  //   otherwise   → single-select (the primary assessment mechanism, v5.0)

  import { createEventDispatcher } from 'svelte';
  import QuestionCard from './QuestionCard.svelte';
  import NarrationButton from './NarrationButton.svelte';
  import { practiceSegments } from '../narration-text.js';
  import { progress } from '../stores/progress.js';
  import SingleSelect from './SingleSelect.svelte';
  import MultiSelect from './MultiSelect.svelte';
  import {
    presentOptions,
    getCurrentAnswer,
    ANSWERS_CHECKED,
    USCIS_UPDATES_URL,
  } from '../content/questions.js';

  const dispatch = createEventDispatcher();

  export let q;
  export let label = 'Practice — the official test question';
  /** Text the PARENT renders directly above this component. Narrated here so it
      is spoken in the order it is read; this component does not render it. */
  export let lead = '';
  // Course-authored explanation for this item. Comes from the SCREEN in unit
  // JSON, never from the question file: question files hold verbatim USCIS
  // wording and are the never-translate boundary, whereas this is our prose
  // and has to be translatable. Deliberately a single string, not a bilingual
  // pair — feedback is shown in the learner's chosen language only.
  export let explain = '';

  $: presented = q && !q.dynamic ? presentOptions(q) : null;
  $: currentAnswer = q && q.dynamic ? getCurrentAnswer(q.id) : null;

  // Reset when the question changes, so a submitted answer on one item does not
  // make the next item narrate its feedback before it has been answered.
  // Compared against the question itself, not written on every reactive pass —
  // `submitted = false` in a block that also depends on `submitted` would undo
  // the answer the instant it was recorded.
  let loadedFor = null;
  let submitted = false;
  $: if (q !== loadedFor) {
    loadedFor = q;
    submitted = false;
  }

  function answered(correct) {
    submitted = true;
    dispatch('answer', { id: q.id, correct });
  }

  // The narration reads what is rendered, in the order it is rendered. The
  // options come from `presented` — the same shuffled array the buttons use —
  // never from q.options, or the spoken order would differ from the visible one
  // and mislead exactly the learner this is for.
  $: lang = $progress.language || 'en';
  $: narration = q
    ? [
        ...(lead ? [{ lang, text: lead }] : []),
        ...practiceSegments({
        label,
        official: q.official,
        questionId: q.id,
        presented,
        multiSelectCount: q.multiSelect || 0,
        answered: submitted,
        correctAnswerText: q.acceptedAnswers?.[0] || '',
        explain,
          currentAnswer: q.dynamic ? currentAnswer : null,
          lang,
        }),
      ]
    : [];
</script>

{#if q}
  {#key q.id}
    <NarrationButton segments={narration} {lang} wrapperClass="mb-3" />
    <p class="text-xs text-ink-muted dark:text-dark-ink-muted mb-2">{label}</p>
    <QuestionCard text={q.official} />

    {#if q.dynamic}
      <div class="border border-border dark:border-dark-border rounded-card p-4">
        <p class="text-xs text-ink-muted dark:text-dark-ink-muted mb-1">
          {currentAnswer?.label || 'Current answer'}
        </p>
        {#if currentAnswer && currentAnswer.verified && currentAnswer.value}
          <p class="text-lg font-bold mb-2">{currentAnswer.value}</p>
          <p class="text-xs text-ink-muted dark:text-dark-ink-muted">
            Checked: {ANSWERS_CHECKED || 'not yet recorded'}
          </p>
        {:else}
          <p class="font-bold mb-2">This answer has not been checked yet.</p>
          <p class="text-sm text-ink-secondary dark:text-dark-ink-secondary">
            This one changes with elections or appointments. Look it up before your
            interview — never rely on an old answer.
          </p>
        {/if}
        <a
          class="text-sm underline font-bold inline-block mt-2"
          href={USCIS_UPDATES_URL}
          target="_blank"
          rel="noopener noreferrer">Check at uscis.gov</a
        >
      </div>
    {:else if q.multiSelect}
      <MultiSelect
        options={presented.options}
        acceptedAnswers={q.acceptedAnswers}
        required={q.multiSelect}
        feedbackExplain={explain}
        on:answer={(e) => answered(e.detail.correct)}
      />
    {:else}
      <SingleSelect
        options={presented.options}
        correctIndex={presented.correctIndex}
        correctAnswerText={q.acceptedAnswers[0]}
        feedbackExplain={explain}
        on:answer={(e) => answered(e.detail.correct)}
      />
    {/if}
  {/key}
{/if}
