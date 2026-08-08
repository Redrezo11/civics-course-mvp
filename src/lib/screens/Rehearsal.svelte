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
</script>

<div class="min-h-screen flex flex-col max-w-md mx-auto">
  <LessonBar
    unitLabel="Rehearsal"
    position={phase === 'asking' ? `${index + 1} of up to ${MAX}` : ''}
    onBack={() => navigate('/')}
  />

  <div class="flex-1 overflow-y-auto px-5 py-6">
    {#if phase === 'intro'}
      <div class="w-16 h-16 rounded-full mx-auto mb-4 bg-[repeating-linear-gradient(135deg,theme(colors.border),theme(colors.border)_6px,theme(colors.surface)_6px,theme(colors.surface)_12px)]"></div>
      <h1 class="text-heading font-bold mb-4">This is practice for the real interview.</h1>
      <p class="mb-3 leading-relaxed">
        At the real interview you will <em>hear</em> these questions. Here you read them
        — and answer out loud, the same way. No choices, no hints. Then check yourself.
      </p>
      <p class="mb-3 leading-relaxed font-bold">
        The rules are the real rules: up to {MAX} questions. {PASS_AT} right = pass.
        {FAIL_AT} wrong = stop.
      </p>
      {#if $progress.rehearsal.attempts > 0}
        <p class="text-sm text-ink-secondary dark:text-dark-ink-secondary">
          You have practiced this {$progress.rehearsal.attempts}
          {$progress.rehearsal.attempts === 1 ? 'time' : 'times'}. Your best so far:
          {$progress.rehearsal.bestCorrect} correct.
        </p>
      {/if}

    {:else if phase === 'asking'}
      <!-- Running tally: icon + word + colour together, never colour alone (G-5c). -->
      <p class="text-xs text-ink-muted dark:text-dark-ink-muted mb-3">
        ✓ {correct} right · ✗ {wrong} wrong
      </p>

      <QuestionCard text={current.official} />

      {#if !revealed}
        <p class="font-bold text-center my-5 leading-relaxed">
          Do you know the answer?<br />Say it out loud to yourself before you look.
        </p>
        <button class="btn-primary" on:click={() => (revealed = true)}>{$t('rehearsal.checkMyAnswer')}</button>
      {:else}
        <div class="border border-border dark:border-dark-border rounded-card p-4 my-4">
          <p class="text-xs text-ink-muted dark:text-dark-ink-muted mb-2">Accepted answers</p>
          {#each acceptedFor(current) as a}
            <p class="font-bold mb-1">{a}</p>
          {/each}
        </div>
        <p class="font-bold text-center mb-3">{$t('rehearsal.didYouGetItRight')}</p>
        <button class="btn-secondary mb-2.5" on:click={() => selfMark(true)}>✓ Yes, I got it</button>
        <button class="btn-secondary" on:click={() => selfMark(false)}>✗ Not yet</button>
      {/if}

    {:else}
      {#if passed}
        <h1 class="text-heading font-bold mb-3">You passed this practice.</h1>
        <p class="mb-3 leading-relaxed">
          {asked} questions asked — just like the real test, which can end early once
          you have {PASS_AT} right.
        </p>
      {:else}
        <h1 class="text-heading font-bold mb-3">This practice test ended.</h1>
        <p class="mb-3 leading-relaxed">
          The real one would too. Every question you missed is now in your review list.
          Try again anytime.
        </p>
      {/if}
      <!-- No "unlimited retries" line: the Try again button below says it. -->
      <p class="mb-3">✓ {correct} right · ✗ {wrong} wrong</p>
      <p class="text-sm text-ink-secondary dark:text-dark-ink-secondary">
        This practice asked {asked} of the 128.
      </p>
    {/if}
  </div>

  <div class="px-5 py-4 border-t border-border dark:border-dark-border">
    {#if phase === 'intro'}
      <button class="btn-primary" on:click={start}>Start</button>
    {:else if phase === 'done'}
      <button class="btn-primary mb-2.5" on:click={start}>Try again</button>
      <button class="btn-secondary" on:click={() => navigate('/')}>Back to lessons</button>
    {/if}
  </div>
</div>
