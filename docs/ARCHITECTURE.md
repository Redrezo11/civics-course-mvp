# Architecture — where bilingual content slots in

Companion to `STRUCTURAL_CHANGES.md` (what changed) and the Civics Course
Storyboard v5.3 (what the course says). This file covers **how a second language
attaches to the build**: the source formats, how they become overlays, and the
rules that decide what may and may not be translated.

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

There are two, and they serve different purposes.

### 2a. Flat — what translators deliver

`docs/translations/unitN.json`, keyed screen id then field name:

```json
{
  "U2-S01": { "heading": "…", "body": "…" },
  "U2-S05": { "paragraphs": ["…", "…", "…"] }
}
```

This is already overlay-shaped, so `build-translations.js` validates rather than
maps. Present for **all eight units**.

**Two shape rules the format does not express**, both enforced by the build:

- `sortItems` is delivered as plain strings, but the build stores
  `{ text, bucket }` where `bucket` is the index the sort scores against.
  The generator folds each string back into its English object **by position**.
  It has to: merging strings over those objects deletes every bucket, and a
  sort item with no bucket cannot be scored. That shipped in five units before
  a test caught it.
- `twoColumn` and `cards` must be delivered as **objects**. A flattened
  `"heading: body"` string cannot be split back apart, and the build drops the
  field rather than guess where the boundary was.

### 2b. Bilingual — the older paired file

`docs/translations/unitN.bilingual-source.json`. Only Unit 1 has one. Every
teaching string paired:

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
importable from `src/`. QA check 13 enforces that, and warns on every run while
the status is anything other than `reviewed`.

Both source formats live in `docs/` and are read only by the build script. QA
check 13 asserts nothing under `src/` imports from `docs/translations/`.

### 2c. What goes out — `docs/translation-source.json`

`TRANSLATION-REQUEST.md` clips long values to fit a markdown table. That is
display-only, and treating it as the source cost the first delivery 23 fields —
every `cards` set and every multi-paragraph `paragraphs`, because the clipped
text was the only English on offer.

So the request now emits a companion JSON carrying the **untruncated** English
for every outstanding field, keyed `screenId.field`, in the shape the value must
return in. The markdown is for reading; the JSON is what you translate.

---

## 3. Source → build field mapping

The unit-1 source predates several changes but maps almost completely. Verified
against the real file, not against a description of it: 21 source screens, 16 of
which exist in the build under the same id.

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

## 4. Status — the layer is built

All four original blockers are cleared:

1. **The i18n layer exists.** `src/lib/i18n.js` provides `t()` for UI chrome and
   `localiseScreen()` for course content. Both fall back to English.
2. **Settings does what it says.** Selecting Burmese changes the interface and
   the teaching text in every unit, and the screen states its real coverage.
3. **Noto Sans Myanmar is bundled**, self-hosted, and `<html lang>` is set.
4. `current-answers.json` is still unverified — unrelated to language.

### Coverage today

| Layer | State |
|---|---|
| UI chrome | 31 keys wired, **all 38 carry Burmese** |
| Course content | **210 fields across all 8 units**, 83 screens |
| Outstanding | 27 fields — see `TRANSLATION-REQUEST.md` |
| Review status | `draft-unreviewed` throughout — machine-drafted, no native pass yet |

Coverage is partial *within* each unit, not per unit: every unit shows Burmese
teaching text, and individual fields still fall back to English where no
translation exists. That is the fallback rule working, not a gap in wiring.

### Adding more Burmese is a data drop

1. Author `docs/translations/unitN.json` against `translation-source.json`,
   which carries the current schema and the required shapes.
2. `node scripts/build-translations.js` — validates all eight units, folds
   `sortItems` back onto their buckets, drops anything that would break G-3,
   and reports what it could not use rather than guessing.
3. Register the overlay in the `OVERLAYS` map in `src/lib/i18n.js`.
4. `npm run qa` — checks 15 and 16 re-verify the result independently of the
   generator that produced it.

### G-3 is enforced at two layers, not trusted

A translated overlay is the one place official wording can be replaced silently,
because the renderer merges the overlay without knowing what the words are.

- **The generator drops** any field whose English carries an official question
  sentence or an accepted answer that the translation replaced, so the screen
  falls back to English and the drop is reported.
- **QA check 16 re-derives the same rule** from `questions-uN.json` and fails
  the build if anything slipped through.

Neither uses an allowlist of protected strings. The rule is derived from the
question data, so an item that starts quoting an official question is protected
the moment it does. The one exception it cannot see is the interpret gloss
(§1a), which is named explicitly and asserted positively — if a delivery ever
translates those options away, the check fails rather than going quiet.

This is not hypothetical: the Unit 1 exemplify item shipped with its official
question and its correct answer both fully in Burmese, which is exactly the
training-on-wrong-wording failure G-3 exists to prevent. The guards were
written after finding it.

For chrome, fill the `my` values in `src/lib/content/ui-strings.json`. QA check
14 reports how many are still untranslated on every run.

### The font, and why `unicode-range` matters

The Myanmar subset is **154 KB** — heavy against the prepaid-data constraint the
project calls its binding limit. The `@font-face` in `app.css` declares
`unicode-range: U+1000-109F, …`, and a browser only fetches a font once it has
to render a character in that range. **An English learner downloads none of it.**
Self-hosted, never a CDN (G-11). SIL OFL 1.1, licence at
`src/assets/fonts/OFL.txt` as redistribution requires.

---

## 5. Encoding — transfer translation files as files, never paste

**Present:** eight flat unit files plus the older bilingual Unit 1 source. Every
arrival is verified by codepoint before it is built, and every one so far has
matched the sender's stated sha256 and Myanmar character count exactly.

The bilingual file was verified this way first — 85 `my` strings, 8,603
characters in the Myanmar block including 3,655 consonants, zero U+FFFD, zero
Latin-1 residue, all 67 `en`/`my` pairs complete.

It took two failed attempts to get it here, and the reason will recur for units
2–7, so it is written down:

Burmese is three UTF-8 bytes per character — `E1 8x YY`. The middle byte is
always `0x80`–`0x82`, and for every base consonant (U+1000–U+101F) the third
byte is `0x80`–`0x9F`. **Both fall in the C1 control range.** A channel that
strips control characters therefore deletes the middle byte of every character
and the final byte of every consonant: `ကျွန်ုပ်တို့` arrives as
`á á» á½ á áº á¯ …` — the vowel marks survive, every consonant is gone.

That is unrecoverable, not garbled. A consonant cannot be inferred from the
diacritics around it, and guessing would put invented Burmese in front of a
learner as fact.

**Verifying on arrival** — by codepoint, never by looking at terminal output.
A Windows console under cp1252 cannot render Burmese and will throw or show
blanks for a perfectly good file; that says nothing about the data. Assert
instead that `my` strings sit in U+1000–U+109F, that U+1000–U+101F is non-empty
(consonants present), and that there is no U+FFFD and no U+00C0–U+00FF residue.
