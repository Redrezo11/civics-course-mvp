<script>
  import { t } from '../i18n.js';
  // T · Rehearsal mode — the mock interview. Storyboard §8, unchanged by v5.0.
  //
  // This is the ONE deliberate exception to the v5.0 conversion. Every other
  // practice screen became multiple choice; this one stays read-and-answer,
  // decided explicitly rather than defaulted into:
  //
  //   The real naturalization interview presents no options. An officer asks;
  //   the applicant answers with nothing to select from. Rehearsal exists
  //   specifically to simulate that condition. Converting it to multiple
  //   choice would make it structurally identical to every other practice
  //   screen and remove the one place a learner rehearses the actual
  //   difficulty they will face.
  //
  // Self-scored by design. No speech recognition anywhere — G-10 forbids the
  // microphone outright, and accent-fairness makes it the wrong tool besides.
  // "Answer out loud" is a printed instruction (G-14), never a capability.
  //
  // Real rules: up to 20 questions · 12 correct passes · 9 wrong ends it.

  import { progress } from '../stores/progress.js';
  import { navigate } from '../router.js';
  import { buildRehearsalSet } from '../select-review.js';
  import { getCurrentAnswer, ANSWERS_CHECKED } from '../content/questions.js';
  import LessonBar from '../components/LessonBar.svelte';
  import QuestionCard from '../components/QuestionCard.svelte';
  import NarrationButton from '../components/NarrationButton.svelte';
  import ScreenImage from '../components/ScreenImage.svelte';
  import { rehearsalSegments } from '../narration-text.js';
  import { STANDALONE_NARRATION } from '../content/standalone-narration.js';

  const PASS_AT = 12;
  const FAIL_AT = 9;
  const MAX = 20;

  let phase = 'intro'; // intro | asking | done
  let questions = [];
  let index = 0;
  let revealed = false;
  let correct = 0;
  let wrong = 0;
  let passed = false;

  function start() {
    // Attempt count seeds the draw, so each retry is a genuinely different
    // test rather than the same twenty questions every time.
    questions = buildRehearsalSet(MAX, ($progress.rehearsal.attempts + 1) * 7919 + 13);
    index = 0;
    revealed = false;
    correct = 0;
    wrong = 0;
    passed = false;
    phase = 'asking';
  }

  $: current = questions[index];

  function selfMark(gotIt) {
    if (gotIt) correct += 1;
    else {
      wrong += 1;
      // Missed items feed the review queue, exactly as the end-state copy
      // promises. This is a self-report, but only ever in the learner's own
      // favour-neutral direction: it adds practice, it never scores them.
      progress.recordAnswer(current.id, false);
    }

    if (correct >= PASS_AT) {
      passed = true;
      finish();
    } else if (wrong >= FAIL_AT || index >= questions.length - 1) {
      passed = false;
      finish();
    } else {
      index += 1;
      revealed = false;
    }
  }

  function finish() {
    progress.recordRehearsal(correct, passed);
    phase = 'done';
  }

  function acceptedFor(q) {
    if (!q) return [];
    if (q.dynamic) {
      const ca = getCurrentAnswer(q.id);
      return ca && ca.verified && ca.value
        ? [`${ca.value}  (checked ${ANSWERS_CHECKED || 'not yet'})`]
        : ['Not checked yet — look this up at uscis.gov before your interview.'];
    }
    return q.acceptedAnswers;
  }

  $: asked = index + (phase === 'done' ? 1 : 0);

  // Every string on this screen follows the learner's language. It was entirely
  // hardcoded English — including the rules, which state the pass mark, and the
  // result screens. A learner rehearsing for an English interview still needs
  // to be told the rules in a language they read.
  $: lang = $progress.language || 'en';
  $: my = lang === 'my' ? 'my' : undefined;
</script>

<div class="min-h-screen flex flex-col max-w-md mx-auto">
  <LessonBar
    unitLabel={$t('rehearsal.heading')}
    position={phase === 'asking' ? $t('rehearsal.positionOf', { n: index + 1, max: MAX }) : ''}
    onBack={() => navigate('/')}
  />

  <div class="flex-1 overflow-y-auto px-5 py-6">
    {#if phase === 'intro'}
      <!--
        From the registry, filtered to the learner's language — the registry is
        what the audio script and QA check 17 read, so a recording can only stay
        in step if the screen plays what the registry holds. A test asserts the
        registry text and the rendered text still say the same thing.
      -->
      <NarrationButton
        segments={STANDALONE_NARRATION['rehearsal-intro'].segments.filter((s) => s.lang === lang)}
        {lang}
        screenId="rehearsal-intro"
        wrapperClass="mb-4"
      />
      <div class="w-40 mx-auto mb-4">
        <ScreenImage image="companion-speaking.webp" decorative wrapperClass="" />
      </div>
      <h1 class="text-heading font-bold mb-4" lang={my}>{$t('rehearsal.introHeading')}</h1>
      <p class="mb-3 leading-relaxed" lang={my}>{$t('rehearsal.introBody')}</p>
      <p class="mb-3 leading-relaxed font-bold" lang={my}>
        {$t('rehearsal.rules', { max: MAX, pass: PASS_AT, fail: FAIL_AT })}
      </p>
      {#if $progress.rehearsal.attempts > 0}
        <p class="text-sm text-ink-secondary dark:text-dark-ink-secondary" lang={my}>
          {$t('rehearsal.attemptsSoFar', {
            n: $progress.rehearsal.attempts,
            times: $t($progress.rehearsal.attempts === 1 ? 'rehearsal.timeOne' : 'rehearsal.timeMany'),
            best: $progress.rehearsal.bestCorrect,
          })}
        </p>
      {/if}

    {:else if phase === 'asking'}
      <!-- Running tally: icon + word + colour together, never colour alone (G-5c). -->
      <p class="text-xs text-ink-muted dark:text-dark-ink-muted mb-3" lang={my}>
        {$t('rehearsal.tally', { correct, wrong })}
      </p>

      <!--
        Gated on `revealed`. Before the reveal this narrates the question and
        nothing else: the learner is answering from memory, and reading the
        accepted answers to them would destroy the exercise.

        This is also the screen narration helps most. Its own intro says "at the
        real interview you will hear these questions" — now they can.
      -->
      <NarrationButton
        segments={rehearsalSegments({
          official: current.official,
          questionId: current.id,
          revealed,
          accepted: acceptedFor(current),
          correct,
          wrong,
          lang: $progress.language || 'en',
        })}
        lang={$progress.language || 'en'}
        wrapperClass="mb-3"
      />
      <QuestionCard text={current.official} />

      {#if !revealed}
        <p class="font-bold text-center my-5 leading-relaxed" lang={my}>
          {$t('rehearsal.doYouKnow')}<br />{$t('rehearsal.sayOutLoud')}
        </p>
        <button class="btn-primary" on:click={() => (revealed = true)}>{$t('rehearsal.checkMyAnswer')}</button>
      {:else}
        <div class="border border-border dark:border-dark-border rounded-card p-4 my-4">
          <p class="text-xs text-ink-muted dark:text-dark-ink-muted mb-2" lang={my}>{$t('rehearsal.acceptedAnswers')}</p>
          {#each acceptedFor(current) as a}
            <p class="font-bold mb-1">{a}</p>
          {/each}
        </div>
        <p class="font-bold text-center mb-3">{$t('rehearsal.didYouGetItRight')}</p>
        <button class="btn-secondary mb-2.5" on:click={() => selfMark(true)}>{$t('rehearsal.gotIt')}</button>
        <button class="btn-secondary" on:click={() => selfMark(false)}>{$t('rehearsal.notYet')}</button>
      {/if}

    {:else}
      <!--
        Speech only, never a recording: the tally below is this learner's, so a
        recorded file would read somebody else's score.
      -->
      <NarrationButton
        segments={[
          {
            lang,
            text: passed
              ? `${$t('rehearsal.passedHeading')} ${$t('rehearsal.passedBody', { asked, pass: PASS_AT })}`
              : `${$t('rehearsal.endedHeading')} ${$t('rehearsal.endedBody')}`,
          },
          {
            lang,
            text: `${$t('rehearsal.tally', { correct, wrong })}. ${$t('rehearsal.askedOf128', { asked })}`,
          },
        ]}
        {lang}
        wrapperClass="mb-4"
      />
      {#if passed}
        <h1 class="text-heading font-bold mb-3" lang={my}>{$t('rehearsal.passedHeading')}</h1>
        <p class="mb-3 leading-relaxed" lang={my}>
          {$t('rehearsal.passedBody', { asked, pass: PASS_AT })}
        </p>
      {:else}
        <h1 class="text-heading font-bold mb-3" lang={my}>{$t('rehearsal.endedHeading')}</h1>
        <p class="mb-3 leading-relaxed" lang={my}>{$t('rehearsal.endedBody')}</p>
      {/if}
      <!-- No "unlimited retries" line: the Try again button below says it. -->
      <p class="mb-3" lang={my}>{$t('rehearsal.tally', { correct, wrong })}</p>
      <p class="text-sm text-ink-secondary dark:text-dark-ink-secondary" lang={my}>
        {$t('rehearsal.askedOf128', { asked })}
      </p>
    {/if}
  </div>

  <div class="px-5 py-4 border-t border-border dark:border-dark-border">
    {#if phase === 'intro'}
      <button class="btn-primary" on:click={start}>{$t('common.start')}</button>
    {:else if phase === 'done'}
      <button class="btn-primary mb-2.5" on:click={start}>{$t('common.tryAgain')}</button>
      <button class="btn-secondary" on:click={() => navigate('/')}>{$t('common.backToLessons')}</button>
    {/if}
  </div>
</div>
