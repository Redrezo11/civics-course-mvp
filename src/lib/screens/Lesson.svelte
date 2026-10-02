<script>
  import { t } from '../i18n.js';
  import { unitTitleKey } from '../content/unit-titles.js';
  import { onMount } from 'svelte';
  import { navigate } from '../router.js';
  import { progress, questionsPracticedCount } from '../stores/progress.js';
  import {
    getQuestion,
    presentOptions,
  } from '../content/questions.js';
  import { localiseScreen, glossOfficial } from '../i18n.js';
  import { narrationFor, practiceSegments, seg, optionSegments } from '../narration-text.js';
  import LessonBar from '../components/LessonBar.svelte';
  import NarrationButton from '../components/NarrationButton.svelte';
  import PracticeItem from '../components/PracticeItem.svelte';
  import ScreenImage from '../components/ScreenImage.svelte';
  import LevelsDiagram from '../components/LevelsDiagram.svelte';
  import QuestionCard from '../components/QuestionCard.svelte';
  import AnswerLabel from '../components/AnswerLabel.svelte';
  import Bilingual from '../components/Bilingual.svelte';
  import SingleSelect from '../components/SingleSelect.svelte';
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
  /** Which option the learner tapped on a hook screen. Local, never recorded. */
  let hookPick = null;

  // Screen types that manage their own "did the learner finish this" state
  // rather than always showing the parent's Next button immediately.
  // 'readAndAnswer' is deliberately absent. Storyboard v5.0 converted every
  // self-graded reveal item in Units 1–7 to single-select; the mechanic
  // survives only in Rehearsal, which implements it inline and is not unit
  // content. QA check 12 keeps it out.
  const selfPaced = new Set(['vocab', 'guidedPractice', 'tryOne', 'practice', 'hook']);

  // Nothing may be written back until the saved position has been read.
  //
  // The reactive save below runs during initialisation, while index is still 0,
  // so it used to overwrite the stored position with screen 1 BEFORE onMount
  // read it — and then onMount restored the value it had just clobbered. Resume
  // never worked, and U0-S07 promises "stop anytime, the course remembers your
  // place". No test caught it because every test starts at screen 1 anyway,
  // which is exactly what the bug produces.
  let restored = false;

  onMount(() => {
    // Resume at the saved position, if any (G-5 — progress saves every screen)
    // — but only while the unit is unfinished. Revisiting a completed lesson
    // starts at the beginning, because that is what "finished" means; walking
    // back through it writes a fresh position, and without this guard that
    // position would strand the next visit mid-lesson all over again.
    const saved = $progress.unitsCompleted.includes(unitId)
      ? null
      : $progress.screenPosition[unitId];
    if (saved) {
      const i = unit.screens.findIndex((s) => s.id === saved);
      if (i >= 0) index = i;
    }
    restored = true;
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
  // Prose renders as a pair: English from `en`, Burmese from `screen`. In
  // English mode the two are the same object, so every pair is one line.
  $: en = rawScreen;
  $: isDynamicPractice =
    screen?.type === 'practice' && getQuestion(screen.questionId)?.dynamic;
  $: isLast = unit && index === unit.screens.length - 1;
  $: if (screen) { interactionDone = false; hookPick = null; }

  $: if (screen && restored) {
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

  /**
   * The advance button's text, translated.
   *
   * `primaryLabel` is authored per screen in the unit JSON and is deliberately
   * SKIPped by the translation pipeline — it is not prose, and asking a
   * translator for 67 copies of the word "Next" would be absurd. But nothing
   * translated it either, so every lesson screen in the course showed an
   * English button to a Burmese learner: "Next" on 58 screens, "Begin" on 8,
   * "Start Unit 1" on 1.
   *
   * Mapped rather than translated in place, so the content keeps authoring
   * plain English labels and the three distinct values resolve to ui-strings.
   * A label with no mapping falls through to itself — the same
   * English-rather-than-blank rule the rest of i18n follows. QA check 24
   * fails if the content introduces a fourth label without a key for it.
   */
  const ADVANCE_KEYS = {
    Next: 'common.next',
    Begin: 'common.begin',
    'Start Unit 1': 'epitome.startUnit1',
    Finish: 'common.finish',
  };
  $: advanceLabel = (label, last) => {
    const text = label || (last ? 'Finish' : 'Next');
    const key = ADVANCE_KEYS[text];
    return key ? $t(key) : text;
  };

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
            gloss: $glossOfficial,
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
  <div class="p-6">{$t('lesson.notFound')}</div>
{:else}
  <div class="min-h-screen flex flex-col max-w-md mx-auto">
    <LessonBar
      unitLabel={$t(unitTitleKey(unitId))}
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
          <ScreenImage image={screen.image} alt={screen.alt} />
        {/if}
        {#if screen.heading}<Bilingual tag="h1" wrapperClass="text-thesis font-bold mb-3" en={en.heading} my={screen.heading} />{/if}
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
            {#each en.bodyList as line, i}<Bilingual tag="li" wrapperClass="font-bold" en={line} my={screen.bodyList?.[i]} />{/each}
          </ul>
        {:else if screen.body}
          <Bilingual wrapperClass="mb-4" en={en.body} my={screen.body} />
        {/if}

      {:else if screen.type === 'tryOne'}
        {@const q = getQuestion(screen.questionId)}
        {@const p = presentOptions(q)}
        <Bilingual wrapperClass="mb-3" en={en.body} my={screen.body} />
        <QuestionCard text={q.official} />
        <SingleSelect
          options={p.options}
          correctIndex={p.correctIndex}
          correctAnswerText={q.acceptedAnswers[0]}
          on:answer={(e) => { handleAnswer(q.id, e.detail.correct); interactionDone = true; }}
        />

      {:else if screen.type === 'orient'}
        <Bilingual wrapperClass="text-xs text-ink-muted dark:text-dark-ink-muted mb-1" en={en.unitLabel} my={screen.unitLabel} />
        <Bilingual tag="h1" wrapperClass="text-heading font-bold mb-4" en={en.heading} my={screen.heading} />
        <Bilingual wrapperClass="mb-3" en={en.body} my={screen.body} />
        <QuestionCard text={getQuestion(screen.sampleQuestionId).official} />
        <Bilingual wrapperClass="mb-3" en={en.afterQuote} my={screen.afterQuote} />
        <Bilingual
          tag="div"
          wrapperClass="border border-border-interactive dark:border-dark-border-interactive rounded-card py-3 px-4 text-center font-bold mb-4"
          en={en.coverageLine}
          my={screen.coverageLine}
        />
        <Bilingual wrapperClass="text-sm text-ink-secondary dark:text-dark-ink-secondary" en={en.afterTest} my={screen.afterTest} />

      {:else if screen.type === 'hook'}
        <!--
          Was a bare striped <div> with no text, alt or role — a blob to a
          sighted learner and nothing at all to a screen reader. companionPose
          was authored on this screen the whole time and read by nobody.
        -->
        <div class="w-40 mx-auto mb-4">
          <ScreenImage
            image="companion-{screen.companionPose || 'thinking'}.webp"
            decorative
            wrapperClass=""
          />
        </div>
        <Bilingual tag="h1" wrapperClass="text-thesis font-bold text-center mb-5" en={en.question} my={screen.question} />
        <!--
          The same three-state treatment every other answer surface uses:
          SingleSelect, MultiSelect and GuidedPractice all mark the correct
          option ✓ green and the learner's wrong pick ✗ red, and this screen
          alone dimmed everything identically — so the one screen that LOOKS
          most like a quiz was the one that answered you the least. The answer
          was already on the screen, in the feedback prose underneath; it just
          was not on the buttons.

          Still ungraded, deliberately. `hookPick` is local and nothing calls
          recordAnswer — a hook is asked BEFORE the lesson teaches, so counting
          it would score a learner on material they have not been given (G-1).
          Showing which answer the lesson endorses is feedback, not scoring.
        -->
        {#each screen.options as opt, i}
          {@const isCorrect = i === screen.correctIndex}
          {@const isWrongPick = interactionDone && hookPick === i && !isCorrect}
          <button
            class="tap flex items-center gap-2 w-full text-left py-2.5 px-4 mb-2.5 rounded-full font-bold text-sm border-2 transition-colors
              {interactionDone && isCorrect ? 'bg-gotit-bg dark:bg-dark-gotit-bg border-gotit dark:border-dark-gotit' : ''}
              {isWrongPick ? 'bg-notyet-bg dark:bg-dark-notyet-bg border-notyet dark:border-dark-notyet' : ''}
              {interactionDone && !isCorrect && !isWrongPick ? 'border-border-interactive dark:border-dark-border-interactive opacity-55' : ''}
              {!interactionDone ? 'border-border-interactive dark:border-dark-border-interactive' : ''}"
            disabled={interactionDone}
            on:click={() => { hookPick = i; interactionDone = true; }}
          >
            <span class="flex-1">
              <AnswerLabel text={opt} gloss={screen.optionsGloss?.[i]}
                >{#if interactionDone && isCorrect}✓ {:else if isWrongPick}✗ {/if}</AnswerLabel
              >
            </span>
          </button>
        {/each}
        {#if interactionDone}
          <Bilingual
            wrapperClass="text-sm mt-4 p-3 rounded-card border border-border dark:border-dark-border leading-relaxed"
            en={en.feedback}
            my={screen.feedback}
          />
        {/if}

      {:else if screen.type === 'connect'}
        {#each en.bodyList as line, i}
          <Bilingual wrapperClass="{i === 0 ? 'font-bold' : ''} mb-3" en={line} my={screen.bodyList?.[i]} />
        {/each}
        {#if en.bodyList2}
          <div class="h-3"></div>
          {#each en.bodyList2 as line, i}<Bilingual wrapperClass="font-bold mb-3" en={line} my={screen.bodyList2?.[i]} />{/each}
        {/if}
        {#if screen.closing}<Bilingual wrapperClass="text-lg font-bold mt-4" en={en.closing} my={screen.closing} />{/if}

      {:else if screen.type === 'vocab'}
        <VocabDeck cards={screen.cards} english={en.cards} on:done={() => (interactionDone = true)} />

      {:else if screen.type === 'bigIdea'}
        {#if screen.image}
          <ScreenImage image={screen.image} alt={screen.alt} decorative={screen.decorative} />
        {/if}
        <!-- Drawn, not photographed: the slot asked for a structure. -->
        {#if screen.diagram === 'federal-state-two-levels'}
          <LevelsDiagram />
        {/if}
        <!--
          A row of images rather than one composite. The delivered composite
          letterboxed each building with blurred fill, so most of the frame was
          blur and it got worse as the container narrowed. Three clean files in
          a flex row stay sharp and stack on a narrow phone.
        -->
        {#if screen.imageRow}
          <div class="flex flex-wrap gap-2 mb-4">
            {#each screen.imageRow as pic}
              <div class="flex-1 min-w-[8rem]">
                <ScreenImage image={pic.image} alt={pic.alt} wrapperClass="" />
              </div>
            {/each}
          </div>
        {/if}
        {#if en.paragraphs}
          {#each en.paragraphs as p, i}
            <Bilingual wrapperClass="{i === 0 ? 'text-thesis font-bold' : ''} mb-3 leading-relaxed" en={p} my={screen.paragraphs?.[i]} />
          {/each}
        {/if}
        <!--
          Iterates the ENGLISH columns. The Burmese overlay replaces twoColumn
          wholesale with { heading, body, alt } entries and no `image`, so
          iterating `screen.twoColumn` dropped every picture in Burmese mode.
        -->
        {#if en.twoColumn}
          <div class="space-y-4 mb-4">
            {#each en.twoColumn as col, i}
              {@const tr = screen.twoColumn?.[i] || {}}
              <div>
                <ScreenImage image={col.image} alt={tr.alt || col.alt} wrapperClass="mb-2" />
                <Bilingual wrapperClass="font-bold mb-1" en={col.heading} my={tr.heading} />
                <Bilingual wrapperClass="text-sm" en={col.body} my={tr.body} />
              </div>
            {/each}
          </div>
        {/if}
        {#if screen.closing}<Bilingual wrapperClass="mb-3" en={en.closing} my={screen.closing} />{/if}
        {#if screen.resolution}<Bilingual wrapperClass="text-sm text-ink-secondary dark:text-dark-ink-secondary mb-3" en={en.resolution} my={screen.resolution} />{/if}
        {#if screen.handle}
          <div class="border-t border-border dark:border-dark-border pt-4 mt-2">
            <Bilingual wrapperClass="font-bold" en={en.handle} my={screen.handle} />
            {#if screen.handleSub}<Bilingual wrapperClass="text-sm text-ink-secondary dark:text-dark-ink-secondary mt-1" en={en.handleSub} my={screen.handleSub} />{/if}
          </div>
        {/if}

      {:else if screen.type === 'seeItNotIt'}
        <Bilingual tag="h1" wrapperClass="text-thesis font-bold mb-4" en={en.heading} my={screen.heading} />
        <Bilingual wrapperClass="mb-4" en={en.example} my={screen.example} />
        <Bilingual wrapperClass="text-ink-secondary dark:text-dark-ink-secondary mb-5" en={en.nonExample} my={screen.nonExample} />
        <Bilingual wrapperClass="font-bold text-lg" en={en.takeaway} my={screen.takeaway} />

      {:else if screen.type === 'confusablePair'}
        <Bilingual tag="h1" wrapperClass="text-thesis font-bold mb-5" en={en.heading} my={screen.heading} />
        <Bilingual wrapperClass="font-bold mb-0.5" en={en.termA.name} my={screen.termA?.name} />
        <Bilingual wrapperClass="text-sm text-ink-secondary dark:text-dark-ink-secondary mb-4" en={en.termA.def} my={screen.termA?.def} />
        <Bilingual wrapperClass="font-bold mb-0.5" en={en.termB.name} my={screen.termB?.name} />
        <Bilingual wrapperClass="text-sm text-ink-secondary dark:text-dark-ink-secondary mb-5" en={en.termB.def} my={screen.termB?.def} />
        <Bilingual wrapperClass="font-bold" en={en.resolution} my={screen.resolution} />

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
          english={en.items}
          on:alldone={() => (interactionDone = true)}
        />

      {:else if screen.type === 'practice'}
        <!--
          PracticeItem, not a copy of it. This branch used to render its own
          label, question card, dynamic-answer card and SingleSelect/MultiSelect
          — the same markup as the component, duplicated. That duplication is
          why all 38 practice screens had no Listen control: narration was added
          to the component, and lessons were not using it.
        -->
        <PracticeItem
          q={getQuestion(screen.questionId)}
          explain={screen.feedbackExplain || ''}
          explainEn={en.feedbackExplain || ''}
          on:answer={(e) => {
            handleAnswer(e.detail.id, e.detail.correct);
            interactionDone = true;
          }}
        />

      {:else if screen.type === 'lockItIn'}
        <!-- These screens have specified a pose since they were written; it has
             simply never been drawn. -->
        <div class="w-40 mx-auto mb-4">
          <ScreenImage
            image="companion-{screen.companionPose || 'pleased'}.webp"
            decorative
            wrapperClass=""
          />
        </div>
        <!-- No companion placeholder here. On a hook screen the striped circle
             marks where the character will speak; on the finishing screen it is
             a stand-in for nothing and makes a completed lesson look unbuilt. -->
        <Bilingual tag="h2" wrapperClass="text-heading font-bold text-center mb-3" en={en.heading} my={screen.heading} />
        <Bilingual wrapperClass="text-center mb-6" en={en.learnedLine} my={screen.learnedLine} />

        <!-- G-08 entry point. Optional and non-blocking: it sits above the
             Next control, never in place of it, so it can never gate
             progression to the following unit. -->
        {#if screen.fullBankOffer}
          <button
            class="btn-secondary mb-2.5"
            on:click={() => navigate(`/practice/${screen.fullBankOffer.unit}`)}
          >{$t('lesson.practiceAll', { n: screen.fullBankOffer.total })}</button>
        {/if}

        <!-- A review unlocks after U2, U5 and U7 (§8). -->
        {#if screen.unlocksReview}
          <button
            class="btn-secondary mb-2.5"
            on:click={() => navigate(`/review/${screen.unlocksReview}`)}
          >{$t('lesson.startReview', {
            name: screen.unlocksReview,
            n: screen.unlocksReview === 'R3' ? 10 : 8,
          })}</button>
        {/if}
      {/if}
      {/key}
    </div>

    <!-- A ◆ dynamic practice screen has nothing to answer, so it would never
         set interactionDone and would trap the learner with no Next. -->
    {#if !selfPaced.has(screen.type) || interactionDone || isDynamicPractice}
      <div class="px-5 py-4 border-t border-border dark:border-dark-border">
        <button class="btn-primary" on:click={next}>
          {advanceLabel(screen.primaryLabel, isLast)}
        </button>
      </div>
    {/if}
  </div>
{/if}
