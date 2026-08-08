# Civics Course — MVP Prototype

Self-paced U.S. naturalization civics test preparation. Mobile-first, static,
built for GitHub Pages. Companion to Storyboard v5.3.

## Stack
Vite + Svelte + Tailwind CSS. Content as JSON (`src/lib/content/`). Progress
saved to `localStorage` only — no server, no accounts, no third-party
requests at runtime (G-11/G-12).

## Run locally
```
npm install
npm run dev
```

## Build
```
npm run build   # outputs to dist/
```

## Deploy
Push to `main`. `.github/workflows/deploy.yml` runs the QA gate, builds, and
publishes to GitHub Pages. Pages is already configured (Source: GitHub Actions).

Live: https://redrezo11.github.io/civics-course-mvp/

## QA gate
```
npm run qa        # fails on any error — this is what CI runs, before the build
npm run qa:warn   # report only
```
Implements storyboard §9.2b and architecture-plan §9 as code — 11 checks,
numbered to match the plan:

| # | Check |
|---|---|
| 1 | Question integrity — 128, gapless, unit counts match the coverage matrix |
| 2 | Q48 freshness — no Cabinet title hardcoded outside the question data |
| 3 | Dynamic-answer isolation — ◆ items carry no fixed options |
| 4 | Readability (G-15) — words/sentence and grade level, our prose only |
| 5 | Contrast — 34 token pairs, light and dark audited independently |
| 6 | Alt-text completeness |
| 7 | Counter honesty (G-22) |
| 8 | Zero external requests (G-11/G-12) |
| 9 | Distractor safety |
| 10 | Content wiring — every question reference resolves |
| 11 | Tap targets — every control carries a 48px minimum |

Checks 4, 5 and 11 were previously described as "human work". They are not:
sentence length, WCAG contrast ratios and target sizes are all mechanical. What
genuinely still needs a person is official wording against a freshly downloaded
M-1778, a glare check on photographs in dark mode, and a real-device pass at
200% zoom with a screen reader. Those print as warnings every run so they stay
visible, and are never reported as passes.

## Architecture notes for whoever picks this up next

**`src/lib/storage.js` is the only file that touches `localStorage`.**
Every other module goes through it. This is deliberate: the project's
second build target (a cmi5/xAPI package for LMS import) needs the same
events — screen completed, question answered, unit finished — reported to
a real backend instead. Because everything funnels through this one file,
that conversion means rewriting this file's internals, not touching every
component that tracks progress.

**Content is data, not code.** `src/lib/content/*.json` defines every
screen's text, images, and interaction type. `Lesson.svelte` is a generic
renderer that interprets that JSON. Adding or editing a screen's copy is a
JSON edit; adding a new *type* of screen is a code change in `Lesson.svelte`.

**Scope: all eight units are built.** Content is authored from Storyboard v5.3
§5–6 and `Question_Bank_Companion.md` — all 128 questions, verified against the
Companion's own build-note checksums. Adding a unit would be: write
`unitN.json` and `questions-uN.json`, import both, add the id to Home's
`builtUnits` array.

Also built: G-08 full-bank practice (per unit, optional, non-blocking),
R1–R3 cumulative reviews with objective re-queueing, Rehearsal mode, the E-01
epitome, and the G-05b completion screen.

**Option order is permuted at render time, not in the data.** The Companion
lists the correct option first in every entry — an authoring convention for
human review. Transcribed literally that puts the correct answer at index 0 for
all 128 questions, so a learner who always taps the first option scores 100%.
The JSON stays faithful to the source so it can still be checked line-by-line
against M-1778; `presentOptions()` in `content/questions.js` permutes with a
per-question seed, so the order is stable across reloads but the answer moves.

**Known gaps, none blocking:**
- `current-answers.json` ships **unverified**. The eight ◆ dynamic questions
  render as "not checked yet" with the USCIS link rather than asserting an
  officeholder. Fill in the values and set `checked` before this is used by a
  real learner — §9.3 and the Companion's "what still needs a human" note both
  require it, and the QA gate warns on it every run.
- Images are striped placeholders; alt text is authored, so the swap is a file
  drop with no content edits.
- Companion character: placeholder box.
- Burmese: preference is stored and honoured in the UI chrome, but lesson
  content stays English until native-reviewed translation lands.
- G-05b method undecided — the screen is built to the storyboard's interim
  shape and does not pretend to record anything.
- `speechSynthesis` "Listen" button: cut from MVP per explicit decision.

## Tests
```
npm test          # drives the UI and walks every unit end to end
npm run test:watch
```
`tests/lesson-completable.test.js` mounts each unit and clicks through it the
way a learner would, failing if forward progress ever stops. It exists because
three separate defects shipped while the build and the QA gate were both green:
tap-to-sort never signalled completion (so **Unit 1 was uncompletable by
anyone**), answers were written onto imported JSON and came back pre-answered,
and two consecutive `practice` screens shared one `SingleSelect` instance so the
second arrived already answered with no way forward.

The test has teeth — removing the `{#key screen.id}` guard in `Lesson.svelte`
fails ten of its cases. CI runs it before the build.

## Testing note — read this before trusting the build

What is verified: the QA gate passes (8 checks), the production build compiles,
the question bank reconciles against the Companion's checksums, and the review
and rehearsal selection logic is property-tested across hundreds of seeds.

What is **not** verified: G-08 full-bank practice, R1–R3, Rehearsal, E-01 and
the completion screen are covered by the QA gate and by property tests on their
selection logic, but they are not yet walked by the completability test — that
currently drives lesson units only. Extending it to those five screens is the
obvious next piece of work.

The standing lesson: `npm run build` succeeding proves almost nothing about
whether a learner can get through a screen. Every progression defect this
project has had compiled cleanly. If you change an interaction component, run
`npm test` — and if you add a new screen type, add it to the walk.
