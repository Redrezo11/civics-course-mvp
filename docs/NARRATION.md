# Narration — reading the course aloud

**See also:** `AUDIO-ASSETS.md` (generated — the file list and its status) and
`narration-script.json` (generated — the text to record).

This course is for people preparing for an interview conducted in English, many
with limited reading fluency in either language. A page that can be heard is a
page they can use, so narration is a reach feature rather than a convenience.

**Every screen that teaches or tests carries a Listen control** — teaching
screens, every assessment including its entry and result screens, the question
bank, the language chooser and the end-of-course screens.

**Narration reads every non-control text on the screen.** Not the heading and
then silence — the instruction, the running tally, the feedback after an answer,
the date a dynamic answer was checked. If a learner can read it, they can hear
it; the only exclusions are controls (buttons and links) and decorative content
(`aria-hidden`).

`tests/narration-coverage.test.js` enforces both halves: that a control is
offered, and that what it says covers what is rendered. The second half compares
**per sentence**, on letters and digits only — `<br />` runs sentences together
in `textContent`, and the screen uses symbols (`✓ 2 right · ✗ 1 wrong`) that
have no spoken form.

It states where the control belongs and fails if
it is missing. That test exists because Rehearsal's intro shipped without one
and nothing noticed: a missing control breaks nothing, so every other test still
passed.

Assessment was excluded at first, on the reasoning that reading a question and
its options aloud would answer it. That was wrong. The civics test is an *oral*
interview: the officer speaks the question. Reading the options to someone who
cannot read them is parity with a reader, not an advantage over one — and
excluding assessment locked non-readers out of every question in the course.

The one remaining gap is the **vocab flip-card decks**.

---

## 1. Two engines, one seam

`src/lib/narration.js` owns a single active playback and resolves what to play
in three steps:

A narration is a list of **segments**, and each one resolves on its own:

1. an explicit `audioSrc`, if a caller passes one;
2. **by convention** — a recording named after the screen, or after the question
   for an official one, if the manifest lists it and its text has not changed
   since (§3);
3. otherwise **speech synthesis** of that segment's text.

Segments carry their own language, because an assessment screen in Burmese is
genuinely bilingual: Burmese prose around an English official question. One
utterance carries one language — `my-MM` mangles the English, `en-US` mangles
the Burmese — so the language travels with the text.

Nothing above the seam knows which engine ran. **Adding recorded narration is a
data change, not a code change** — drop the files in, run `npm run audio`, done.

Speech synthesis is temporary. Everything in §5 is a limitation of *that*
engine, and every one of them disappears when a recording exists.

---

## 2. Naming

```
public/audio/<lang>/<screen-id>.mp3     screen prose, per language
public/audio/q/<question-id>.mp3        official question wording, English only

public/audio/en/U1-S01.mp3      public/audio/my/U1-S01.mp3
public/audio/en/U1-S06b.mp3     public/audio/my/U1-S06b.mp3
public/audio/en/welcome.mp3     public/audio/my/welcome.mp3
public/audio/q/Q1.mp3 … public/audio/q/Q128.mp3
```

**`q/` has no language folder, on purpose.** The officer asks in English
whatever the learner reads, so recording a question twice would be wrong. One
file plays wherever that question is asked — lesson practice, the full-bank
sets, R1–R3, Rehearsal, the question bank.

It also makes recording incremental and ordered by value. The 128 questions are
the single highest-value set, and each starts working everywhere the moment it
lands. Nothing else has to exist first.

Answer options are deliberately **not** recorded: they are shuffled per render,
would be roughly 500 more files, and are English, where synthesis is reliable.

`<lang>` is `en` or `my` — the same codes as `LANGUAGES` and
`content/translations/my/`. `<screen-id>` is the screen's `id` verbatim from the
unit JSON, plus `welcome` for the opening screen, which has no unit.

The screen id was chosen over a new scheme because it is already unique, already
stable, and already the key for translation overlays. A second identifier is a
second thing to keep in sync.

**Case is not optional.** GitHub Pages is case-sensitive and Windows is not, so
`u1-s01.mp3` plays perfectly on the machine that made it and 404s for every
learner. QA check 17 fails on any name that is not an exact match — that check
exists solely because this failure is invisible in development.

**Encoding:** mono, 48 kbps, 24 kHz MP3. The binding constraint here is prepaid
mobile data — the Myanmar font is `unicode-range`-scoped for the same reason.
Audio is fetched only when a learner taps Listen, never preloaded.

**Missing-language rule:** if `my` audio is absent but `en` audio exists, a
Burmese learner gets Burmese *speech* — never the English recording. Playing the
wrong language is worse than playing none.

---

## 3. Editing course text is safe; leaving a recording behind is not

The filename depends on the screen id alone. Rewriting paragraphs, adding or
removing them, inserting screens, reordering a unit, fixing typos — none of it
renames anything. Only renaming a screen's `id` breaks the mapping, and QA
check 17 fails loudly and names the orphan when it does.

What editing text *does* do is make a recording **stale**: the file still
resolves and still plays, but it now says what the page no longer says. Nothing
404s and nothing errors, so a learner who listens quietly receives different
content from one who reads.

So the manifest stores a hash of the narration text at the moment each recording
was accepted, and a mismatch means the recording is **set aside, not played** —
speech takes over, because speech is always current. Audio that contradicts the
screen is not a lesser form of working; it is the accessibility failure this
feature exists to prevent.

```
npm run audio                      # scan, report, regenerate the map
npm run audio -- --accept          # after re-recording: everything
npm run audio -- --accept U1-S05   # after re-recording: one screen
```

The hash is taken over normalised text — lowercased, punctuation stripped,
whitespace collapsed — so fixing a comma never costs a re-record, and changing
the words always does.

---

## 4. What gets narrated

Derived from the visible fields of the **localised** screen, in render order, by
`narrationFor()` in `src/lib/narration-text.js`. Deriving rather than authoring
means narration follows the copy and the translation for free: no second set of
strings to keep in step, and 59 fields that never entered the translation
backlog to say what the screen already says.

A screen may set `narrationText` to override this — the escape hatch for
anything that should be spoken differently from how it reads.

**Narrated:** `info`, `orient`, `connect`, `bigIdea`, `seeItNotIt`,
`confusablePair`, `lockItIn`, plus Welcome. 60 screens per language.

**Assessment screens** derive their narration from what is rendered at that
moment, so the pre-answer narration cannot give the answer away — it does not
contain it. Options are read in the order they are **displayed**, from the same
shuffled array the buttons use; reading the authored order would speak them in a
different order from the screen, which is worse than no audio for someone who
cannot see it. Options are numbered when spoken, the one place narration adds
text rather than reading it.

Rehearsal is gated on its reveal: the question before, the accepted answers
after. Narrating them early would destroy an exercise built on recall.

**Not narrated:** `vocab`, a flip-card deck whose whole interaction is
progressive reveal.

Interface controls are excluded *by construction*: `narrationFor` names the
content fields it reads, so Back, Exit, Next, `primaryLabel` and the full-bank
offer cannot be picked up by accident. A test asserts every field on a narrated
screen is either narrated or explicitly listed as not — so a new content field
fails the suite rather than being silently dropped from the audio.

### Screens that are not unit page data

Welcome, Language, Rehearsal, the full-bank sets, Review, Epitome and Completion
have their prose in the markup rather than in unit JSON, so they need a
registry: **`src/lib/content/standalone-narration.js`**, read by the components,
by `scripts/audio-assets.js` and by QA check 17.

One list, because there used to be three and they drifted immediately —
`epitome` and `completion` were added to the QA list and not to the audio
script, so a recording named `epitome.mp3` passed the gate, never reached the
manifest, and would have silently never played.

**Recordable, or speech only.** Each entry declares which:

| | Screens |
|---|---|
| recordable | `welcome`, `language`, `rehearsal-intro` |
| speech only | `epitome`, `rehearsal-end`, `fullbank-entry`, `fullbank-end`, `review-end`, `completion` |

The speech-only ones narrate **live values** — a score, a count, how far through
a reveal the learner is. A recording of those is one learner's tally read aloud
to everybody, and the freshness hash cannot catch it, because the text varies
per learner rather than per edit. QA check 17 rejects a file named for one.

**The Language screen is narrated in both languages at once**, the only place in
the app that happens. Nobody has chosen a language yet, so there is no current
language to fall back to — and on that screen, English may be exactly the
problem. Segments made it a four-line entry rather than a feature.

A test asserts the registry's Welcome text still matches what the screen
renders, and that the Language entry matches the UI strings — the registry holds
literals so Node scripts can read it without JSON import attributes, and those
literals must not drift.

---

## 5. Why the speech engine is shaped the way it is

Every decision below is a defect worked around, not a preference.

**Text is chunked by sentence.** Desktop Chrome silently truncates any single
utterance at about fifteen seconds — roughly 200–250 characters — mid-sentence
and with no error. Every `bigIdea` and `orient` screen is longer than that.

The widely-copied workaround is a timer calling `resume()` every fourteen
seconds. It is wrong here: it would fight the Pause button, restarting narration
the learner had just stopped.

**Pause is `cancel()` plus a remembered position, never `pause()`.** On Chrome
for Android — the platform this course is mostly read on — `pause()` ends the
utterance and `resume()` does nothing. Owning the chunk index gives a Pause that
works everywhere. The cost is that **Resume restarts the current sentence**
rather than the current word, which for a comprehension-focused learner is
arguably the better behaviour anyway.

**The splitter knows `၊` and `။`.** Burmese does not end sentences with a full
stop, and does not put spaces between words. A splitter that knew only `.?!`
would return one enormous chunk for every Burmese screen — straight back into
the truncation bug, in the language whose support is already worst.

**A reference to the live utterance is held.** Chrome can garbage-collect an
utterance mid-speech, after which `end` never fires and the button stays on
"Pause" for good.

**One `<audio>` element for the whole app, with its `src` swapped.** iOS grants
autoplay permission per element, unlocked by a user gesture. A playlist that
built a new element per segment would create one that never received a gesture,
so segment two onward would silently fail — on iPhone only, after segment one
had played perfectly.

**Finishing a segment is idempotent, and the element is claimed.** The next
segment's `start()` calls `cancel()`, which re-fires the previous utterance's
`end` on some browsers — without a guard the playlist skips to the finish. And
because the element is shared, a segment's async `stop()` can land after the
next narration has started; without an ownership check it would pause the
playback that replaced it. Both cost a test to find.

**A generation counter guards chunk advance.** `cancel()` fires `end` on some
browsers and not others; without the guard, pausing would immediately start the
next sentence, so Pause would read as Skip.

**Source resolution is synchronous.** `play()` runs inside a click handler, and
awaiting anything before `speak()` loses the user activation that iOS and Chrome
both require.

### When a learner says "the Listen button does nothing"

0. **A screen reader is already running.** Narration is only ever
   user-initiated — nothing speaks unless tapped — so it never fights VoiceOver
   or TalkBack unasked. But a learner running both will hear both. There is no
   reliable way to detect a screen reader from a browser, and guessing would be
   worse than the honest design.
1. **iPhone with the ring/silent switch on.** Safari silences speech synthesis
   entirely; Chrome on iOS ignores the switch. This is the most common cause and
   cannot be detected in code.
2. **Burmese with no Burmese voice installed.** Most devices have none, so the
   text is either skipped or read by a fallback voice that produces nonsense.
   This is the single strongest argument for recorded audio, and the reason the
   pipeline exists before the assets do.
3. **A stale recording.** Not silence, but the wrong words — run `npm run audio`
   and look for `▲`.

---

## 6. Stopping

One narration plays at a time, enforced structurally: `play()` cancels the
current engine before starting another, so callers cannot cause an overlap by
forgetting to.

| Path | Mechanism |
|---|---|
| Next / Back in a lesson | the button renders inside `Lesson.svelte`'s `{#key screen.id}` block, so a screen change destroys it and `onDestroy` cancels |
| Exit, or any navigation | `narration.js` subscribes to the `route` store |
| Component unmount | `onDestroy` |
| Leaving the app entirely | `pagehide` — Chrome keeps talking across a real document change |

Nothing ever autoplays.
