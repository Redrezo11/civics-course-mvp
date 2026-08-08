# Structural changes and translation surface

**For:** whoever revises the Burmese (`my`) translation.
**Against:** Civics Course Storyboard v5.3 and Question_Bank_Companion.md.
**Generated:** the string inventory in Part 2 is extracted from source, not
typed by hand, so it does not drift out of date silently. Regenerate it before
starting work.

---

## Part 0 — the rule that overrides everything else

**Official question wording and accepted answers are never translated.**

They are verbatim USCIS M-1778 text, and the real naturalization interview is
conducted in English. This is storyboard rule G-3, a hard constraint, not a
preference. It applies to:

| Never translate | Where it lives |
|---|---|
| `official` — the question as USCIS words it | `questions-u1.json` … `questions-u7.json` |
| `acceptedAnswers` | same |
| `options` — practice choices | same |
| `cardText`, `pairedOfficial` — quoted official wording | unit JSON, guided-practice items |

`options` deserve a specific warning. The Companion authored them for this
course, so they look translatable — but the **correct** option in each set
restates an accepted answer, and several distractors are near-misses of official
phrasing. Translating them would put a Burmese answer next to an English
question and teach a learner to recognise the wrong form. Leave the whole file
in English.

Everything else — teaching prose, UI chrome, feedback, instructions — is
translatable.

---

## Part 1 — what changed since Storyboard v5.3

The build and the storyboard have diverged. This section is the reconciliation.

### 1.1 Screens removed — retire their strings

| What | Count | Note |
|---|---|---|
| `officialQuestions` (beat 8) | 7 | One per unit. Removed: no instruction, no assessment, only re-listed questions already reachable in the question bank, in practice, and in the unit's full-bank set. |
| `U2-S09` confusable pair | 1 | Duplicate of U1-S07b (Supreme Court vs. supreme law) with the terms swapped. Its own heading admitted it: "One more pair, carried over from Lesson 1." |

**Screen count: 127 → 119.** Any Burmese text already drafted for these screens
can be discarded.

### 1.2 Screens converted — mechanic changed, strings replaced

**U1-S14 (Q4) and U1-S15 (Q5): read-and-answer → single-select.**

These were the last two self-graded reveal items in the course. Storyboard v5.0
already required this conversion — it converted *"all 33 self-graded
tap-to-reveal / read-and-answer practice items across Units 1–7"* to
single-select and kept the mechanic for Rehearsal only. The build never applied
it to these two, so a learner was shown accepted answers to a question they had
not been taught to answer, then asked to grade themselves.

Strings **retired from lesson content** (they now exist only in Rehearsal):

- "Do you know the answer?"
- "Say it to yourself before you look."
- "Did you get it right?"
- "✓ Got it" / "↻ Not yet"

Replaced by the standard single-select pattern, already translated once if any
other practice screen has been: "The correct answer is ⟨…⟩."

QA check 12 now blocks `readAndAnswer` from reappearing in unit content.

### 1.3 Strings relocated — same text, new home

The seven per-unit strategy tips moved from the removed beat-8 screens onto each
unit's `lockItIn` screen. The JSON key changed from `q14Note` to `strategyNote`
(the old name was a misnomer — only U1's tip concerns Q14). **Text unchanged**,
so an existing translation can be moved rather than redone.

### 1.4 Screens added — entirely new strings

None of these exist in any earlier translation draft:

| Screen | File |
|---|---|
| E-01 epitome | `src/lib/screens/Epitome.svelte` |
| G-08 full-bank practice (entry / running / exit) | `src/lib/screens/FullBank.svelte` |
| R1–R3 cumulative reviews | `src/lib/screens/Review.svelte` |
| Rehearsal (mock interview) | `src/lib/screens/Rehearsal.svelte` |
| G-05b completion evidence | `src/lib/screens/Completion.svelte` |
| Multi-select ("Choose N") | `src/lib/components/MultiSelect.svelte` |
| Question bank, rewritten to cover all 128 | `src/lib/screens/QuestionBank.svelte` |

### 1.5 Chrome text changed

- **Home** — "Or go to any lesson:" restored; Reviews and "Practice every
  question" sections added; the footer date line is now conditional (see 1.6).
- **Help** — the Sources line no longer hardcodes a date.
- **Lesson** — practice screens carry "Practice — the official test question".
- **Guided practice** — now labelled "Practice ⟨n⟩ of ⟨n⟩ — not an official test
  question", and sort/order items give real feedback where before they gave
  none.

### 1.6 Conditional text — needs two translations, not one

`ANSWERS_CHECKED` is `null` until someone verifies the dynamic answers, so these
strings each have **two** states and both need translating:

| Location | If verified | If not |
|---|---|---|
| Home footer | "Answers checked: ⟨date⟩" | "Some answers change — check uscis.gov" |
| Help sources | "answers checked ⟨date⟩" | "answers that change with elections have not been checked yet" |
| Dynamic cards | the officeholder + "Checked: ⟨date⟩" | "This answer has not been checked yet." |

### 1.7 Changes with no text impact

Listed so they are not re-investigated: option order is now permuted at render
time; screens remount via `{#key screen.id}`; all controls carry a 48px tap
target; `dark-border-interactive` was lightened for contrast.

### 1.8 Screen ids were deliberately not renumbered

Ids are the keys stored in `screenPosition`, so renumbering would strand every
learner mid-unit on resume. **Gaps are expected** — U1 runs S01…S09, S11…S16
with no S10, and U2 has no S09. These are not errors and must not be "tidied".

---

## Part 2 — the translation surface

### 2.1 Content JSON — which keys are prose

These keys hold course-authored prose and are translatable. The list is kept in
step with `PROSE_KEYS` in `scripts/qa-check.js` (check 4), which is what the
readability check measures:

`body` · `bodyList[]` · `bodyList2[]` · `paragraphs[]` · `closing` ·
`resolution` · `handle` · `handleSub` · `example` · `nonExample` · `takeaway` ·
`heading` · `afterQuote` · `afterTest` · `coverageLine` · `learnedLine` ·
`askSomeone` · `feedback` · `question` · `instructions` · `smallPrint` ·
`privacyLine` · `strategyNote` · `unitLabel`

Also translatable, nested: `cards[].word` / `.def` / `.example` (vocabulary),
`termA`/`termB` `.name` and `.def` (confusable pairs), `sortItems[].text`,
`orderItems[]`, `buckets[]`, and `alt` (alt text — translate it; a screen reader
in Burmese mode should not read English).

**Not translatable** — see Part 0: `official`, `acceptedAnswers`, `options`,
`cardText`, `pairedOfficial`, and every `id` / `type` / `questionId`.

### 2.2 Hardcoded UI strings

Every string below is written directly into a component. There is no
`ui-strings.json`, so **none of it can currently be translated without a code
change** — see Part 3.

Regenerate this list with the extractor described in Part 4. `⟨…⟩` marks a value
the app substitutes at runtime; keep the placeholder in any translation.


#### `src/lib/components/GuidedPractice.svelte` — 11

- All sorted correctly.
- Correct order.
- It asks the same thing as the official question:
- Next
- One belongs
- Practice ⟨…⟩ of ⟨…⟩ — not an official test question
- Start over
- The correct answer is ⟨…⟩.
- The correct order is:
- Try again
- {sortWrong[i].length === 1 ? 'One belongs' : `$⟨…⟩ belong`} somewhere else:

#### `src/lib/components/LessonBar.svelte` — 2

- Exit ✕
- ‹ Back

#### `src/lib/components/MultiSelect.svelte` — 5

- Accepted answers are marked ✓.
- Any ⟨…⟩ of them is enough — the officer asks for ⟨…⟩, so give ⟨…⟩ and stop.
- Check my answer
- Choose ⟨…⟩.
- {chosen.length

#### `src/lib/components/PracticeItem.svelte` — 6

- Check at uscis.gov
- Checked: ⟨…⟩
- Current answer
- This answer has not been checked yet.
- This one changes with elections or appointments. Look it up before your interview — never rely on an old answer.
- not yet recorded

#### `src/lib/components/SingleSelect.svelte` — 1

- The correct answer is ⟨…⟩.

#### `src/lib/components/VocabDeck.svelte` — 2

- Tap each word (⟨…⟩ of ⟨…⟩)
- flip all ⟨…⟩ to continue

#### `src/lib/screens/Completion.svelte` — 10

- Back to lessons
- Practice the interview
- Showing that you finished
- This course runs entirely on your own phone and does not send your progress anywhere. If someone asked you to show that you completed it, take a picture of the two counters above.
- Want to practice every question? ⟨…⟩ are still unpracticed. Each lesson's full set stays open from the lesson list.
- You have practiced all ⟨…⟩.
- Your ceremony. Your oath. You are almost there.
- ceremony.jpg
- lessons finished
- questions practiced

#### `src/lib/screens/Epitome.svelte` — 4

- Every lesson in this course explains one piece of this picture. By the end, you will see how all 128 test questions fit inside these four ideas.
- How America works
- Show the next line (⟨…⟩ of ⟨…⟩)
- Start Unit 1

#### `src/lib/screens/FullBank.svelte` — 13

- ) : navigate(
- Back to lessons
- Choose an answer to continue
- Continue practice
- Every question in this lesson has now been in front of you as a question, not just as an answer.
- Nothing is scored and nothing is counted against you. You can stop at any time; this remembers your place.
- Practice all ⟨…⟩ questions from this lesson
- Skip for now
- Start practice
- You have now practiced ⟨…⟩ of ⟨…⟩ questions from this lesson.
- You have practiced ⟨…⟩ so far. This covers every question in this lesson — take it now, or come back later.
- You stopped at question ⟨…⟩. Starting there.
- questions practiced

#### `src/lib/screens/Help.svelte` — 9

- About: a self-paced civics course to help you prepare for the U.S. naturalization test.
- Cancel
- Clear progress
- Help
- Sources: USCIS M-1778 · National Archives / Library of Congress photos · ⟨…⟩answers checked ⟨…⟩⟨…⟩answers that change with elections have not been checked yet⟨…⟩
- Start over (clears your progress)
- This clears all your progress on this phone. This cannot be undone.
- Your privacy: this course saves your progress only on your own phone.
- ‹ Back

#### `src/lib/screens/Home.svelte` — 16

- All ⟨…⟩ from ⟨…⟩
- All ⟨…⟩ questions
- CONTINUE
- Help
- Learn
- Optional. ⟨…⟩ of ⟨…⟩ are still unpracticed.
- Or go to any lesson:
- Practice every question
- Rehearsal
- Reviews
- Settings
- Unit ⟨…⟩ — ⟨…⟩
- lessons finished
- questions practiced
- ⟨…⟩ — questions from every lesson so far
- ⟨…⟩Answers checked: ⟨…⟩⟨…⟩Some answers change — check uscis.gov⟨…⟩ ·

#### `src/lib/screens/Language.svelte` — 4

- (Burmese)
- Choose your language.
- English
- You can change this anytime in Settings.

#### `src/lib/screens/Lesson.svelte` — 10

- Check at uscis.gov
- Checked: ⟨…⟩
- Current answer
- Practice all ⟨…⟩ questions
- Practice — the official test question
- Start ⟨…⟩ — ⟨…⟩ mixed questions
- This answer has not been checked yet.
- This one changes with elections or appointments. Look it up before your interview — never rely on an old answer.
- Unit not found.
- not yet recorded

#### `src/lib/screens/QuestionBank.svelte` — 11

- All ⟨…⟩ questions
- Check at uscis.gov
- Checked: ⟨…⟩
- Learn
- No question matches “⟨…⟩”.
- This answer changes. It has not been checked yet — look it up before your interview.
- Why is this the answer? → ⟨…⟩
- [attr] Search questions...
- not yet recorded
- ‹ Back
- ⟨…⟩ ⟨…⟩ of ⟨…⟩ questions match ⟨…⟩ All ⟨…⟩ official questions · ★ marks the 65/20 questions ⟨…⟩

#### `src/lib/screens/Rehearsal.svelte` — 23

- Accepted answers
- At the real interview you will
- Back to lessons
- Check my answer
- Did you get it right?
- Do you know the answer?
- Say it out loud to yourself before you look.
- Start
- The real one would too. Every question you missed is now in your review list. Try again anytime.
- The rules are the real rules: up to ⟨…⟩ questions. ⟨…⟩ right = pass. ⟨…⟩ wrong = stop.
- This is practice for the real interview.
- This practice asked ⟨…⟩ of the 128.
- This practice test ended.
- Try again
- Unlimited retries. The real interview allows two attempts; practice here costs nothing.
- You have practiced this ⟨…⟩ ⟨…⟩. Your best so far: ⟨…⟩ correct.
- You passed this practice.
- hear
- these questions. Here you read them — and answer out loud, the same way. No choices, no hints. Then check yourself.
- ✓ Yes, I got it
- ✓ ⟨…⟩ right · ✗ ⟨…⟩ wrong
- ✗ Not yet
- ⟨…⟩ questions asked — just like the real test, which can end early once you have ⟨…⟩ right.

#### `src/lib/screens/Review.svelte` — 13

- Back to lessons
- Choose an answer to continue
- Continue
- Finish review
- Nothing to bring back next time.
- One question
- Preparing your review…
- Questions from different lessons, mixed together on purpose.
- Review finished.
- Review not found.
- Reviewed: ⟨…⟩ questions.
- You have reviewed all seven lessons.
- {missed.length === 1 ? 'One question' : `$⟨…⟩ questions`} will come back to you in your next review. That is how this is meant to work — nothing is scored, and nothing is counted against you.

#### `src/lib/screens/Settings.svelte` — 11

- Dark
- Done
- English
- Language
- Lessons and buttons change language. Test questions and answers stay in English — that is the language of the real interview.
- Light
- Settings
- Theme
- Your choice is saved on this phone.
- မြန်မာဘာသာ Burmese
- ‹ Back

#### `src/lib/screens/Welcome.svelte` — 6

- (placeholder)
- Start
- This course covers all 128 questions on the U.S. citizenship civics test, in short lessons you can fit around your day.
- This course teaches civics and test preparation. For questions about your own immigration case, see uscis.gov or a qualified legal-service provider.
- Welcome.
- companion character

**Total: 157 strings across 18 files.**

---

## Part 3 — blockers: translation cannot start until these are resolved

These are stated plainly because none of them is visible from the storyboard,
and each one will stop the work dead.

### 3.1 There is no i18n architecture at all

Architecture plan §4/§5 specifies `content/ui-strings.json` with `en` and `my`
keys, and `content/units/en/` + `content/units/my/`. **Neither was ever built.**

- Every UI string is hardcoded in a component (Part 2.2 — 157 of them).
- Unit JSON has no language dimension: `unit1.json` is one file, not
  `en/unit1.json` and `my/unit1.json`.
- There is no string-lookup function anywhere in the codebase.

So Burmese cannot be added as a data drop. The externalisation has to be built
first. That is a code change, not a translation task, and it is the single
largest item standing between here and a bilingual course.

### 3.2 The Settings screen promises something the app does not do

Settings tells the learner:

> "Lessons and buttons change language. Test questions and answers stay in
> English — that is the language of the real interview."

The second sentence is true. **The first is not.** `$progress.language` is read
in exactly three places: the first-run redirect in `App.svelte`, and two button
highlights in `Settings.svelte`. It changes no text anywhere. Choosing Burmese
today stores a preference and does nothing else.

Left in place deliberately, recorded here so the translation workstream owns the
fix rather than discovering it. Once 3.1 exists, the sentence becomes true and
needs no edit.

### 3.3 Noto Sans Myanmar is not bundled

`src/app.css` still carries the note that font files were never added, so the
`font-myanmar` class falls back to system fonts. Burmese may render incorrectly
or not at all on devices without a Myanmar Unicode font — which on a cheap
Android handset is a real possibility. `lang="my"` is currently applied nowhere,
so assistive technology is not told the language either.

### 3.4 Dynamic answers are unverified

`current-answers.json` ships with `checked: null` and seven of eight entries
`verified: false`. Anything in 1.6 that depends on a verified date will render
in its "not checked yet" form until that is resolved.

---

## Part 4 — regenerating this document

Part 1 is written by hand. **Part 2.2 is generated** — regenerate it rather than
editing it, or it will drift:

```
node scripts/extract-ui-strings.cjs src            # counts per file
node scripts/extract-ui-strings.cjs src --markdown # the inventory section
```

The extractor strips `<script>` blocks and HTML comments, collapses `{...}`
interpolations to `⟨…⟩`, and filters out Tailwind class lists that appear inside
ternaries. It is a heuristic, not a parser: skim its output before trusting it,
and widen it if a string is missing rather than adding one by hand.

Verify the rest against the build with:

```
npm run qa    # 12 checks, incl. 4 readability and 12 no-self-graded-reveal
npm test      # walks every unit and screen
```
