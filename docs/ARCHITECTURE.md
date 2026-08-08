# Architecture — where bilingual content slots in

Companion to `STRUCTURAL_CHANGES.md` (what changed) and the Civics Course
Storyboard v5.3 (what the course says). This file covers **how a second language
attaches to the build**, because a bilingual source format exists and the
codebase has nowhere to put it yet.

---

## 1. The runtime rule

**Burmese is exclusively for the Burmese version. The two languages never appear
on screen together.**

A learner whose language is `my` sees Burmese. A learner set to `en` sees
English. There is no side-by-side layout, no stacked pair, no "English with a
translation underneath".

This is why every translatable field in the build is a **single string**, not a
`{ en, my }` pair. `feedbackExplain`, `learnedLine`, `paragraphs` — one language,
resolved before render. The pairing lives in the *source* files, not in the
shipped content.

The pattern this was explicitly modelled against — `vocalize-mvp`, which stacks
`explanation` and `explanationArabic` on the same screen — is the thing this
course does **not** do.

### 1a. The one exception

On the **interpret** item (module-level Objective 3), option text stays
**English even in Burmese mode**, with a Burmese gloss in parentheses.

The skill being taught is recognising a familiar test question under unfamiliar
wording. The officer will ask in English. Translating the options would delete
the thing being practised. The bilingual source encodes this decision itself:

> `"Option text stays English (test-language exposure) with Burmese gloss in
> parentheses."`

### 1b. Never translated at all

Official question wording, accepted answers, and practice options — see
`STRUCTURAL_CHANGES.md` Part 0 for the full rule and the reasoning. In short:
the correct option restates an accepted answer, so translating it would put a
Burmese answer beside an English question.

---

## 2. The source format

One file per unit, every teaching string paired:

```json
{
  "unit": "u1",
  "translationStatus": "draft-unreviewed",
  "title":  { "en": "We the People", "my": "…" },
  "screens": [
    { "id": "U1-S01", "text": { "en": [ "…" ], "my": [ "…" ] } }
  ]
}
```

This is the `content/units/{en,my}/` shape that architecture plan v1.1 §4/§5
specified and that was never built. The source carries both languages; the build
would consume one.

`translationStatus` matters: the storyboard requires **native review** before
Burmese reaches a learner. A file marked `draft-unreviewed` must not be
importable from `src/`. QA check 13 enforces that.

---

## 3. Source → build field mapping

The unit-1 source predates several changes but maps almost completely. Recorded
so the eventual import is mechanical rather than interpretive.

### Screens

| Source | Build | Note |
|---|---|---|
| S01–S08, S11–S16 | same ids | 16 screens, 1:1 |
| S09a / S09b / S09c / S09d | `U1-S09` items 1–4 | four source screens → the four items of one `guidedPractice` screen, in order: exemplify, compare, infer, interpret |
| S10 `official-questions` | — | **dead.** Beat 8 was removed; see `STRUCTURAL_CHANGES.md` §1.1 |
| S16 `askSomeone`, `spacedButton` | — | **dead.** Removed / never built |

### Fields

| Source | Build |
|---|---|
| `text.en[]` / `text.my[]` | `paragraphs[]` (bigIdea) or `bodyList[]` (connect) |
| `levels[1..4]` on S07 | `heading`, `example`, `nonExample`, `takeaway` |
| `levels[1..4]` on S07b | `heading`, `termA`, `termB`, `resolution` |
| `cards[].term` / `.meaning` | `cards[].word` / `.def` |
| `prompt`, `options`, `correct` | guided item `question`, `options`, `correctIndex` |
| `buckets[{id,label}]` + `items[{text,bucket}]` | `buckets[]` (strings) + `sortItems[{text, bucket: index}]` |
| `question: 2` | `questionId: "Q2"` |
| `asset: 2` | `image` filename + `alt` |
| `feedback.wrong` | `feedbackExplain` |

**One shape trap in `feedback.wrong`.** The source reads *"The correct answer is
**X**. \<explanation\>"*. `SingleSelect` already emits the "The correct answer is
X" sentence from `acceptedAnswers[0]`. Import **only the trailing explanation**,
or the learner reads the answer twice.

Four English explanations have already been taken this way — U1-S11, S13, S14,
S15 — and are live.

---

## 4. Before any of this can be wired

Four blockers, detailed in `STRUCTURAL_CHANGES.md` Part 3. Summarised here only
so this document is not misread as a green light:

1. **No i18n layer exists.** `ui-strings.json` and `content/units/{en,my}/` were
   never built; ~146 UI strings are hardcoded in components; there is no
   string-lookup function anywhere.
2. **Settings promises a switch that does nothing.** `$progress.language` is read
   in three places and changes no text.
3. **Noto Sans Myanmar is not bundled**, and `lang="my"` is applied nowhere.
4. **`current-answers.json` is unverified.**

(1) is the real work: adding Burmese is a code change before it is a content
drop.

---

## 5. Encoding

Burmese is three UTF-8 bytes per character, two of which fall in `0x80–0x9F` —
the C1 control range. **Text pasted through a channel that strips control
characters is unrecoverable**, not merely garbled: `မ` (E1 80 99) arrives as a
bare `á` with both continuation bytes gone, and no round-trip can restore them.

A first attempt at landing the bilingual source failed exactly this way — zero
C1 bytes survived anywhere in the file. Reconstruction would have meant guessing
letters in a script that cannot be proof-read here, in text a learner would take
as fact.

**Transfer translation files as files** — attach or commit them, never paste.
Verify on arrival that `my` strings sit in the Myanmar block (U+1000–U+109F)
with no `Ã`/`Â`/`â` sequences and no U+FFFD.
