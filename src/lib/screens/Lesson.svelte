<script>
  import { onMount } from 'svelte';
  import { navigate } from '../router.js';
  import { progress, questionsPracticedCount } from '../stores/progress.js';
  import {
    getQuestion,
    presentOptions,
    getCurrentAnswer,
    ANSWERS_CHECKED,
    USCIS_UPDATES_URL,
  } from '../content/questions.js';
  import { localiseScreen } from '../i18n.js';
  import { narrationFor, practiceSegments, seg, optionSegments } from '../narration-text.js';
  import LessonBar from '../components/LessonBar.svelte';
  import NarrationButton from '../components/NarrationButton.svelte';
  import QuestionCard from '../components/QuestionCard.svelte';
  import AnswerLabel from '../components/AnswerLabel.svelte';
  import SingleSelect from '../components/SingleSelect.svelte';
  import MultiSelect from '../components/MultiSelect.svelte';
  import VocabDeck from '../components/VocabDeck.svelte';
  import GuidedPractice from '../components/GuidedPractice.svelte';

  import unit0 from '../content/unit0.json';
  import unit1 from '../content/unit1.json';
  import unit2 from '../content/unit2.json';
  import unit3 from '../content/unit3.json';
  import unit4 from '../content/unit4.json';
  import unit5 from '../content/unit5.json';
  import unit6 from '../content/unit6.json';
  import unit7 from '../content/unit7.json';

  export let unitId;

  const units = {
    U0: unit0,
    U1: unit1,
    U2: unit2,
    U3: unit3,
    U4: unit4,
    U5: unit5,
    U6: unit6,
    U7: unit7,
  };
  $: unit = units[unitId];

  let index = 0;
  let interactionDone = false; // set true when a self-advancing component signals completion

  // Screen types that manage their own "did the learner finish this" state
  // rather than always showing the parent's Next button immediately.
  // 'readAndAnswer' is deliberately absent. Storyboard v5.0 converted every
  // self-graded reveal item in Units 1–7 to single-select; the mechanic
  // survives only in Rehearsal, which implements it inline and is not unit
  // content. QA check 12 keeps it out.
  const selfPaced = new Set(['vocab', 'guidedPractice', 'tryOne', 'practice', 'hook']);

  onMount(() => {
    // Resume at the saved position, if any (G-5 — progress saves every screen).
    const saved = $progress.screenPosition[unitId];
    if (saved) {
      const i = unit.screens.findIndex((s) => s.id === saved);
      if (i >= 0) index = i;
    }
  });

  // The English screen is the structural source of truth; a language overlay is
  // merged over it at render. Anything the overlay does not carry stays English,
  // so a partial translation degrades to English rather than to blanks.
  //
  // `lang` is deliberately a plain string, not the $localise store. Deriving
  // `screen` from the progress store created a cycle: screen changes →
  // saveScreenPosition writes progress → the store fires → screen recomputes →
  // saves again. Svelte treats every object assignment as changed, so it never
  // settled and the whole lesson stopped rendering controls. A primitive only
  // invalidates when its value actually differs, which breaks the loop.
  $: lang = $progress.language || 'en';
  $: rawScreen = unit?.screens[index];
  $: screen = rawScreen ? localiseScreen(rawScreen, unitId, lang) : rawScreen;
  $: isDynamicPractice =
    screen?.type === 'practice' && getQuestion(screen.questionId)?.dynamic;
  $: isLast = unit && index === unit.screens.length - 1;
  $: if (screen) { interactionDone = false; }

  $: if (screen) {
    progress.saveScreenPosition(unitId, screen.id);
  }

  function next() {
    if (isLast) {
      progress.markUnitComplete(unitId);
      // E-01 sits between U0 and U1 (§2) — it is the course's first teaching
      // screen and every unit's Connect beat points back to it, so finishing
      // orientation leads there rather than back to Home.
      if (unitId === 'U0' && !$progress.epitomeSeen) navigate('/epitome');
      else if (unitId === 'U7') navigate('/completion');
      else navigate('/');
      return;
    }
    index += 1;
  }
  function back() {
    if (index === 0) navigate('/');
    else index -= 1;
  }

  // Reactive, not a function call in the template. As a function it read
  // `index` without naming it in the template expression, so Svelte never
  // re-ran it — the bar sat on "1 of 18" for an entire unit.
  $: positionLabel = unit ? `${index + 1} of ${unit.screens.length}` : '';

  // Derived from the LOCALISED screen, so the narration follows the translation
  // with no second set of strings to author and keep in step. An `orient`
  // screen shows an official question card, which is part of what the learner
  // reads, so it is part of what they hear.
  // hook and tryOne are assessment shapes that live in the unit JSON rather
  // than in PracticeItem, so they derive their own segments here.
  $: assessmentNarration =
    screen?.type === 'hook'
      ? [
          ...seg(screen.question, lang),
          ...optionSegments(screen.options, { glosses: screen.optionsGloss || [], lang }),
          ...(interactionDone ? seg(screen.feedback, lang) : []),
        ]
      : screen?.type === 'tryOne'
        ? practiceSegments({
            label: screen.body,
            official: getQuestion(screen.questionId)?.official || '',
            questionId: screen.questionId,
            presented: presentOptions(getQuestion(screen.questionId)),
            lang,
          })
        : [];

  $: narrationText = screen
    ? narrationFor(screen, {
        officialQuestion: screen.sampleQuestionId
          ? getQuestion(screen.sampleQuestionId)?.official
          : '',
        lang,
      })
    : [];

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
      position={positionLabel}
      onBack={back}
    />

    <!--
      Keyed on screen.id so every screen gets a FRESH component tree.

      Without this, two consecutive screens of the same type render the same
      template branch, so Svelte reuses the component instance and its internal
      state comes with it. Unit 1 screens 13 and 14 are both `practice`: the
      SingleSelect from Q2 arrived at Q7 still carrying answered=true, so Q7
      rendered already-revealed and its click handler early-returned on
      `if (answered) return`. It never dispatched, interactionDone never
      flipped, and the learner was stranded with no Next button.

      Keying here fixes the whole class at once — SingleSelect, MultiSelect,
      VocabDeck's flipped set, the hook buttons — rather than
      leaving each component to remember to reset itself.
    -->
    <div class="flex-1 overflow-y-auto px-5 py-6">
      {#key screen.id}
      <!--
        Inside the key block on purpose. A screen change destroys this button,
        and its onDestroy cancels the narration — so Next and Back stop the
        audio without either of them having to know narration exists.
      -->
      {#if narrationText.length || assessmentNarration.length}
        <NarrationButton
          segments={narrationText.length ? narrationText : assessmentNarration}
          screenId={narrationText.length ? screen.id : ''}
          {lang}
          wrapperClass="mb-4"
        />
      {/if}
      {#if screen.type === 'info'}
        {#if screen.image}
          <div class="w-full aspect-video mb-4 rounded-photo bg-[repeating-linear-gradient(135deg,theme(colors.border),theme(colors.border)_10px,theme(colors.surface)_10px,theme(colors.surface)_20px)] flex items-center justify-center text-xs text-ink-muted" role="img" aria-label={screen.alt || screen.image}>
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

      {:else if screen.type === 'tryOne'}
        {@const q = getQuestion(screen.questionId)}
        {@const p = presentOptions(q)}
        <p class="mb-3">{screen.body}</p>
        <QuestionCard text={q.official} />
        <SingleSelect
          options={p.options}
          correctIndex={p.correctIndex}
          correctAnswerText={q.acceptedAnswers[0]}
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
          ><AnswerLabel text={opt} gloss={screen.optionsGloss?.[i]} /></button>
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
          <div class="w-full aspect-video mb-4 rounded-photo bg-[repeating-linear-gradient(135deg,theme(colors.border),theme(colors.border)_10px,theme(colors.surface)_10px,theme(colors.surface)_20px)] flex items-center justify-center text-xs text-ink-muted" role="img" aria-label={screen.alt || screen.image}>
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
        <!-- Guided-practice answers are deliberately NOT recorded. G-22: the
             "questions practiced" counter is a count out of the official 128,
             and these are authored teaching items, not test questions. They
             were being written to progress under synthetic ids ("guided-0",
             "guided-1", …), which inflated the counter with entries that are
             not questions at all — the precise blurring of taught vs
             practiced that G-22 exists to prevent. -->
        <GuidedPractice
          items={screen.items}
          on:alldone={() => (interactionDone = true)}
        />

      {:else if screen.type === 'practice'}
        {@const q = getQuestion(screen.questionId)}
        <p class="text-xs text-ink-muted dark:text-dark-ink-muted mb-2">Practice — the official test question</p>
        <QuestionCard text={q.official} />

        {#if q.dynamic}
          <!-- ◆ Dynamic answers are never graded. A fixed distractor set would
               go stale after an election, and an old distractor could later
               become the true answer. Shown as a current-answer card instead. -->
          {@const ca = getCurrentAnswer(q.id)}
          <div class="border border-border dark:border-dark-border rounded-card p-4">
            <p class="text-xs text-ink-muted dark:text-dark-ink-muted mb-1">{ca?.label || 'Current answer'}</p>
            {#if ca && ca.verified && ca.value}
              <p class="text-lg font-bold mb-2">{ca.value}</p>
              <p class="text-xs text-ink-muted dark:text-dark-ink-muted">
                Checked: {ANSWERS_CHECKED || 'not yet recorded'}
              </p>
            {:else}
              <p class="font-bold mb-2">This answer has not been checked yet.</p>
              <p class="text-sm text-ink-secondary dark:text-dark-ink-secondary">
                This one changes with elections or appointments. Look it up before
                your interview — never rely on an old answer.
              </p>
            {/if}
            <a
              class="text-sm underline font-bold inline-block mt-2"
              href={USCIS_UPDATES_URL}
              target="_blank"
              rel="noopener noreferrer"
            >Check at uscis.gov</a>
          </div>
        {:else if q.multiSelect}
          {@const p = presentOptions(q)}
          <MultiSelect
            options={p.options}
            acceptedAnswers={q.acceptedAnswers}
            required={q.multiSelect}
            feedbackExplain={screen.feedbackExplain || ''}
            on:answer={(e) => { handleAnswer(q.id, e.detail.correct); interactionDone = true; }}
          />
        {:else}
          {@const p = presentOptions(q)}
          <SingleSelect
            options={p.options}
            correctIndex={p.correctIndex}
            correctAnswerText={q.acceptedAnswers[0]}
            feedbackExplain={screen.feedbackExplain || ''}
            on:answer={(e) => { handleAnswer(q.id, e.detail.correct); interactionDone = true; }}
          />
        {/if}

      {:else if screen.type === 'lockItIn'}
        <!-- No companion placeholder here. On a hook screen the striped circle
             marks where the character will speak; on the finishing screen it is
             a stand-in for nothing and makes a completed lesson look unbuilt. -->
        <h2 class="text-heading font-bold text-center mb-3">{screen.heading}</h2>
        <p class="text-center mb-6">{screen.learnedLine}</p>

        <!-- G-08 entry point. Optional and non-blocking: it sits above the
             Next control, never in place of it, so it can never gate
             progression to the following unit. -->
        {#if screen.fullBankOffer}
          <button
            class="btn-secondary mb-2.5"
            on:click={() => navigate(`/practice/${screen.fullBankOffer.unit}`)}
          >Practice all {screen.fullBankOffer.total} questions</button>
        {/if}

        <!-- A review unlocks after U2, U5 and U7 (§8). -->
        {#if screen.unlocksReview}
          <button
            class="btn-secondary mb-2.5"
            on:click={() => navigate(`/review/${screen.unlocksReview}`)}
          >Start {screen.unlocksReview} — {screen.unlocksReview === 'R3' ? '10' : '8'} mixed questions</button>
        {/if}
      {/if}
      {/key}
    </div>

    <!-- A ◆ dynamic practice screen has nothing to answer, so it would never
         set interactionDone and would trap the learner with no Next. -->
    {#if !selfPaced.has(screen.type) || interactionDone || isDynamicPractice}
      <div class="px-5 py-4 border-t border-border dark:border-dark-border">
        <button class="btn-primary" on:click={next}>
          {screen.primaryLabel || (isLast ? 'Finish' : 'Next')}
        </button>
      </div>
    {/if}
  </div>
{/if}
