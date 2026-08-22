# Building a cmi5 package from this repository

**This project does not ship as cmi5.** It ships as a static site on GitHub
Pages. This document exists so that someone — quite possibly an LLM reading the
repository — can build a cmi5 package from it without having to reverse-engineer
the rules the code obeys.

It assumes you will look up the [cmi5 specification](https://aicc.github.io/CMI-5_Spec_Current/)
yourself. It spends its length on what the spec cannot tell you: **what this
particular course will let you claim, and what it must never say.**

Read §6 before you write any statement code. It is the part that will otherwise
be got wrong, and it is a claim about a person's readiness for a citizenship
interview.

---

## 1. What this course is

Eight units, 119 screens, all 128 official USCIS civics questions, two languages
(English and Burmese), no backend of any kind. Svelte 5, Vite, ~330 KB of
JavaScript plus a `unicode-range`-scoped Myanmar font.

Its binding constraint is **prepaid mobile data on a cheap Android phone**. Most
odd-looking decisions in here descend from that.

| You will want | It is here |
|---|---|
| Course content | `src/lib/content/unit0.json` … `unit7.json` |
| The 128 questions | `src/lib/content/questions-u1.json` … `-u7.json` |
| Persistence, the whole of it | `src/lib/storage.js` |
| Routing | `src/lib/router.js`, `src/App.svelte` |
| The pictures | `public/images/`, mapped in `docs/IMAGE-ASSETS.md` |
| The rules the build enforces | `scripts/qa-check.js` — 20 checks |
| Why the second language works the way it does | `docs/ARCHITECTURE.md` |

---

## 2. Three things are already done for you

This codebase was written with a cmi5 target in mind and says so in comments.

**Hash routing.** `src/lib/router.js` uses `location.hash`, deliberately:

> *"hash routing needs no server-side rewrite rules, which matters on GitHub
> Pages (no server) and inside a future cmi5 package (served from an
> unpredictable path inside an LMS iframe)"*

cmi5 appends its launch parameters as a query string. The hash survives that —
`index.html?endpoint=…&actor=…#/unit/U1` parses correctly, query first, fragment
second. You do not need a router change.

**Relative asset paths.** `vite.config.js` sets `base: './'`. An AU is served
from a path nobody can predict; absolute paths would break.

**One persistence seam.** `src/lib/storage.js` is the only module that touches
`localStorage`, and — verify this before relying on it — it has **exactly one
consumer**, `src/lib/stores/progress.js`. Every component reads through the
Svelte store, never storage directly.

That is the whole reason the State API migration in §7 is two files rather than
a sweep through 40 components.

---

## 3. The AU map

Nine AUs. `docs/cmi5/cmi5.xml` is generated from the unit JSON by
`node scripts/cmi5-manifest.js`, so unit ids and titles cannot drift from the
course. Regenerate it rather than editing it.

| AU | `moveOn` | Launch URL |
|---|---|---|
| U0 … U7 (one each) | `Completed` | `index.html#/unit/U0` … `#/unit/U7` |
| Interview rehearsal | `Passed`, `masteryScore="0.6"` | `index.html#/rehearsal` |

`0.6` is 12 correct out of 20 — the real test's rule, from `PASS_AT` and `MAX`
in `src/lib/screens/Rehearsal.svelte`. If those constants change, the manifest
must change with them.

**Replace the identifier namespace.** The generated manifest uses
`https://example.org/civics-course`. Activity ids are the key an LRS files
learner records under; changing one after learners have started orphans their
history, because the LMS cannot tell the old and new ids are the same course.
Choose them once, from a domain you control.

### Routes the AUs do not cover

`#/questions` (the 128-question reference), `#/epitome`, `#/completion`,
`#/help`, `#/settings`, `#/rehearsal` and the full-bank sets at
`#/practice/U1` are reachable from inside the app. They are not AUs and should
not become AUs — they are navigation within the learner's own session, not
assignable work. Leave the in-app navigation intact.

Two more are first-run screens rather than destinations: `#/language`, and
`#/welcome` behind it. `App.svelte` redirects to `#/language` only when
`$progress.language` is null **and** the route is `/` — so an AU launched
straight at `#/unit/U3` never sees either, which is what you want. §5 covers
skipping the language screen when the LMS already knows the answer.

---

## 4. Statement design

Standard cmi5: `Initialized` first, `Terminated` last, `Completed` / `Passed` /
`Failed` between them. Every cmi5-defined statement carries the `cmi5` category
activity and the session id from `LMS.LaunchData`.

```js
// context on every cmi5 defined statement
context: {
  registration,                                  // from the launch query string
  contextActivities: {
    category: [{ id: 'https://w3id.org/xapi/cmi5/context/categories/cmi5' }],
  },
  extensions: {
    'https://w3id.org/xapi/cmi5/context/extensions/sessionid': sessionId,
  },
}
```

`Completed`, `Passed`, `Failed` and `Terminated` all require an ISO 8601
`result.duration`. `Passed` / `Failed` require `result.success`; `Completed`
requires `result.completion: true`.

### When to send Completed

A lesson AU is complete when `markUnitComplete(unitId)` fires — that is
`Lesson.svelte`'s `next()` on the last screen, and it is already the course's own
definition of finishing a unit. Do not invent a second one.

Note that the function does **two** things: it appends to `unitsCompleted` and
it clears `screenPosition[unitId]`. A finished unit has no position to be at, and
`Lesson.svelte` refuses a stored one for a completed unit even if a fresh one is
written while the learner walks back through it. Carry both over in §7c — see
the warning there.

### What NOT to send

This is the half that matters, and none of it is guessable from the code alone.

**Guided practice.** `guidedPractice` items are authored teaching exercises, not
test questions. `Lesson.svelte` documents why they are deliberately excluded from
progress (rule G-22): the course's counter is *"questions practiced out of 128"*,
and recording guided items inflates it with things that are not official
questions at all. An implementer who emits interaction statements for them —
which is the natural thing to do — reintroduces exactly the blurring that rule
exists to prevent.

**The eight `◆` dynamic questions.** They change with elections and
appointments, so they are never graded and render as a "current answer" card,
sometimes saying *"this answer has not been checked yet."* Never emit a score
for them, and never emit their answer as fact. `q.dynamic` marks them; QA check 3
enforces their isolation.

**Anything derived from official wording.** Question text and accepted answers
are verbatim USCIS M-1778 text. If a statement includes them — and interaction
statements reasonably might — reproduce them **unaltered**. Do not translate,
paraphrase, or normalise them. Rule G-3, enforced by QA checks 9 and 16.

**Option order.** `presentOptions()` in `src/lib/content/questions.js` shuffles
options deterministically per question. If you emit interaction statements with
a chosen response, take the shuffled array, not `q.options`, or the recorded
response will not match what the learner saw.

---

## 5. Two spec features this course already fits

Both come from the `cmi5LearnerPreferences` Agent Profile document.

**`languagePreference`** is a comma-separated list of RFC 5646 tags. This course
supports exactly `en` and `my`. If the first supported tag in the list matches
one of them, call `progress.setLanguage(...)` and **skip the language screen** —
`src/App.svelte` currently redirects to `#/language` when
`$progress.language` is null. The learner has already told the LMS.

**`audioPreference`** is `"on"` or `"off"`. Narration exists on every teaching
and assessment screen (`docs/NARRATION.md`), so this maps cleanly. Nothing
autoplays and nothing should start to — `"on"` is a preference for the control
being available and prominent, not a licence to speak unasked.

Which screens are narrated has exactly one definition, shared by the app, the
audio script and QA check 17: `NARRATED_FIELDS` in `src/lib/narration-text.js`
for unit screens, and `src/lib/content/standalone-narration.js` for the rest.
Recordings drop in by filename — `docs/AUDIO-ASSETS.md` is the generated map and
holds the naming convention per language. Until they exist, every screen falls
back to `SpeechSynthesis`.

---

## 6. Read this before you emit a Passed statement

**Rehearsal is self-scored.**

`selfMark(gotIt)` in `src/lib/screens/Rehearsal.svelte` records whichever of
*"✓ Yes, I got it"* or *"✗ Not yet"* the learner taps. The question is shown,
the learner answers aloud to themselves, taps to reveal the accepted answers,
and then marks their own recall. **Nothing measures the answer.** A learner
passes by tapping "Yes" twelve times.

That is correct for the course. It rehearses a spoken interview, where the
answer is spoken and cannot be captured without a microphone the project
deliberately does not use, and rule G-1 forbids counting anything against the
learner.

But it means a `Passed` statement derived from it is **attested, not measured**.
Do not let an LMS present it as a proctored score, because the thing being
claimed is somebody's readiness for a citizenship interview.

Two ways to be honest about it:

1. **Mark it.** Emit the Rehearsal `Passed` / `Failed` with the score, and add
   an extension on the statement recording that the result is self-reported, so
   a report builder can see what it is holding.
2. **Score something else.** The objectively scored data is
   `questionsAnswered` — `{ "Q2": true, "Q7": false, … }`, written by
   `recordAnswer()` from single-select practice in lessons, the full-bank sets
   and reviews R1–R3. Those are real multiple-choice items with a real correct
   answer. If a defensible score is needed, build it from there.

If you take (2), the graded AU should be a full-bank set rather than Rehearsal,
and the manifest changes accordingly.

---

## 7. The code changes

Four files, one new module, **no component changes**.

### 7a. `src/lib/lrs.js` — new, the only module allowed to touch the network

```js
// The ONE place this app makes a request. See §9: the no-network rule was
// never "never fetch", it was "no third party" — so this may only ever call
// the endpoint the LMS itself named at launch, and nothing else may fetch.
let auth = null;
let endpoint = null;

export async function connect({ endpoint: ep, fetchUrl }) {
  endpoint = ep.replace(/\/?$/, '/');
  // The fetch URL is single-use. Calling it twice is a conformance failure.
  const res = await fetch(fetchUrl, { method: 'POST' });
  const body = await res.json();
  if (body['error-text']) throw new Error(body['error-text']);
  auth = `Basic ${body['auth-token']}`;
}

const headers = () => ({
  Authorization: auth,
  'X-Experience-API-Version': '1.0.3',
  'Content-Type': 'application/json',
});

export const sendStatement = (s) =>
  fetch(`${endpoint}statements`, { method: 'POST', headers: headers(), body: JSON.stringify(s) });

export async function getState(stateId, { activityId, agent, registration }) {
  const q = new URLSearchParams({ stateId, activityId, agent: JSON.stringify(agent), registration });
  const res = await fetch(`${endpoint}activities/state?${q}`, { headers: headers() });
  return res.status === 404 ? null : res.json();
}

export function putState(stateId, doc, { activityId, agent, registration }) {
  const q = new URLSearchParams({ stateId, activityId, agent: JSON.stringify(agent), registration });
  return fetch(`${endpoint}activities/state?${q}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(doc),
  });
}
```

### 7b. `src/lib/cmi5.js` — new, launch handling

Parse `endpoint`, `fetch`, `actor`, `registration`, `activityId` from
`location.search`. Connect, read the `LMS.LaunchData` state document, read the
`cmi5LearnerPreferences` agent profile, then send `Initialized`.

`LMS.LaunchData` gives you `contextTemplate` (merge it into every statement),
`launchMode`, `moveOn`, `masteryScore` and `returnURL`.

**`launchMode` matters.** In `Browse` or `Review` the AU **must not** send
`Completed`, `Passed` or `Failed`. A learner revisiting finished material must
not be able to re-satisfy it. Gate every completion statement on
`launchMode === 'Normal'`.

### 7c. `src/lib/storage.js` — becomes async

Keep every function name. Replace the bodies: `read()` returns the State
document, `write()` PUTs it. The `DEFAULT_STATE` shape is unchanged and is what
you store:

```js
{ language, theme, unitsCompleted[], questionsAnswered{}, screenPosition{},
  lastUnit, reviewQueue[], fullBankProgress{}, fullBankDone[], reviewsDone[],
  rehearsal{ attempts, bestCorrect, lastResult }, epitomeSeen }
```

**`unitsCompleted` and `screenPosition` have a relationship.** A unit in
`unitsCompleted` has no entry in `screenPosition` — completing it removes one.
Port `markUnitComplete` with both halves intact, or a learner who finishes a
lesson on one device opens it on their other device at the last slide, ticked as
done and apparently mid-way through. That was a real defect here; the LMS is a
new way to reintroduce it, since now the stale position travels.

Use one State document keyed by `registration` so progress follows the learner
across devices — that being the point of an LMS.

Keep the soft-failure behaviour. The current `read()` catches everything and
returns defaults, because on some phones storage simply is not available and the
course must still run. Over a network that matters more, not less: a dropped
request must degrade to a working lesson, never a blank screen.

### 7d. `src/lib/stores/progress.js` — an in-memory mirror

This is what keeps components untouched. Today every method is
`storage.X(); refresh();`. Change it to mutate an in-memory copy, `set()` it
synchronously so the UI updates immediately, and write through asynchronously:

```js
let state = structuredClone(DEFAULT_STATE);
const { subscribe, set } = writable(state);

const commit = (mutate) => {
  mutate(state);
  set(state);              // UI stays synchronous — no component changes
  storage.write(state);    // fire and forget, retried internally
};
```

`export async function load()` fetches the State document once at boot and
`set()`s it.

### 7e. `src/App.svelte` — a boot gate

Render nothing until `load()` resolves. Without it the first paint uses default
state and the app briefly shows a first-run language screen to a returning
learner.

---

## 8. Copy that becomes false

Five strings claim the course sends nothing anywhere. Under cmi5 that is no
longer true, and leaving them is a lie to the learner about where their data
goes.

| Where | Currently says |
|---|---|
| `ui-strings.json` → `help.privacy` | "this course saves your progress only on your own phone" |
| `ui-strings.json` → `settings.saved` | "Your choice is saved on this phone." |
| `Completion.svelte` | "runs entirely on your own phone and does not send your progress anywhere" |
| `Help.svelte` | "This clears all your progress on this phone." |
| `scripts/cmi5-manifest.js` → course description | "…plus an interview rehearsal. **Runs offline on a phone.**" |

**The fifth one is not in the app**, which is why it is the easiest to miss. It
is the course-level description in `cmi5.xml` — the text an LMS shows in its
catalogue, before anyone enrols. And because the manifest is generated, fix it
in `scripts/cmi5-manifest.js` and regenerate; editing the XML puts it out of
step with the script that owns it (§11).

Rewrite them to say that progress is reported to the organisation providing the
course. **The Burmese must be re-translated too** — and note that changing the
English automatically marks the Burmese stale and surfaces it in
`TRANSLATION-REQUEST.md`, which is what the freshness mechanism in
`docs/ARCHITECTURE.md` §2bb is for. Let it work; do not bypass it.

The `Completion.svelte` block telling the learner to *"take a picture of the two
counters"* to prove completion can go entirely. That instruction exists because
the course had no way to report anything. Under cmi5 the LMS **is** the record —
this is the one place where the conversion straightforwardly improves the course.

---

## 9. The QA gate

`npm run qa` runs 20 checks and blocks the build on failure. **Check 8 will fail
the moment you add `fetch`:**

> `8 zero external requests` — fails on any `fetch(`, `XMLHttpRequest`,
> `WebSocket` or `sendBeacon` anywhere in `src/`, and on any external URL
> outside `uscis.gov`.

Do not delete it. The rule it enforces (G-11/G-12) was never "no network" — it
was **no server of our own and no third party**, so that a learner's practice is
not observable by anyone who was not already part of the arrangement.

A cmi5 AU does not break that. It talks to one endpoint, which the LMS itself
supplied at launch, belonging to the organisation the learner enrolled with.

So narrow the check rather than removing it:

- permit the network APIs **only** in `src/lib/lrs.js`;
- keep the ban everywhere else, so no component can start calling out;
- add an assertion that `lrs.js` builds every URL from the launch parameters and
  contains no hardcoded host.

That is a stronger guarantee than the current check, not a weaker one: today
nothing may call the network; afterwards, exactly one file may, and only to an
address the LMS chose.

**The other 19 checks stay as they are.** They will pass unchanged. They are
also the reason this content can be trusted — question integrity, contrast,
tap-target size, honest counters, the never-translate rule, the freshness
guards, and that every image reference resolves and every picture is described
one way. Keep them running in whatever build pipeline you set up.

---

## 10. Packaging

```
package.zip
├── cmi5.xml            ← docs/cmi5/cmi5.xml, namespace replaced
├── index.html
├── assets/             ← JS, CSS, the Myanmar font
├── images/             ← 31 photographs and companion illustrations, WebP
├── audio/              ← empty today; see docs/AUDIO-ASSETS.md
├── favicon.svg
└── icons.svg
```

`npm run build` produces all of it but the manifest, in `dist/`. The manifest
goes at the zip root, not inside `dist/`.

**Do not omit `images/`.** The content references pictures by filename and a
missing file does not error — `ScreenImage.svelte` renders a striped placeholder
naming the file it wanted, so a package built without that folder runs perfectly
and looks unfinished on 31 screens. Filenames are case-sensitive once served;
QA check 18 fails on any reference that does not resolve.

`audio/` ships empty today (0 of 62 files recorded, per `docs/AUDIO-ASSETS.md`).
Every narrated screen falls back to `SpeechSynthesis`, which is the designed
behaviour rather than a gap to fill before packaging.

Watch the size. `dist/` is 1.3 MB today, of which 775 KB is images.
Recorded narration would add several megabytes and the learners this is for are
on prepaid data. Audio is fetched only when someone taps Listen and is never
preloaded — keep it that way. Images are `loading="lazy"` for the same reason,
so a learner pays only for the screens they actually reach.

### Before you distribute

Publishing this to a static host and handing an organisation a zip to run inside
their LMS are different acts, and two things bite only on the second. Neither is
a code change and neither blocks development — check them before a package goes
anywhere real.

| | |
|---|---|
| `voting.webp` | Carries a visible *"© Frame Stock Footage/Shutterstock.com"* watermark — a comp preview, not a licensed download. Replace the file with the licensed version; the content references it by name, so nothing else changes |
| `civil-rights-march.webp` | A well-known press photograph with no licence recorded. Confirm it before publication |

`docs/IMAGE-ASSETS.md` carries both and regenerates with any flagged file still
outstanding, so this list stays true without anyone maintaining it.

Three further things are incomplete rather than wrong, and each is honest about
itself on screen: Burmese is built from sources marked `draft-unreviewed`, with
outstanding fields listed in `docs/TRANSLATION-REQUEST.md`; seven of the eight
dynamic answers are unverified and render as "not checked yet"; and no narration
is recorded, so every screen speaks through `SpeechSynthesis`. None of them
prevents a conforming package. All of them are visible to a learner.

---

## 11. Do not change these

They look arbitrary and each one is load-bearing. All are explained in
`docs/ARCHITECTURE.md` and enforced by `scripts/qa-check.js`.

- **Official question wording, accepted answers and practice options stay
  English**, in every language. The interview is conducted in English; a Burmese
  answer to an English question trains the learner on wording no officer uses.
- **Answers show English first with the Burmese beneath.** Same reason.
- **The counters are honest.** "Questions practiced" counts only the official
  128, never guided practice, never screens merely shown.
- **Generated files are generated.** `audio-manifest.json`,
  `image-manifest.json`, `freshness.json`, `TRANSLATION-REQUEST.md`,
  `translation-source.json`, `AUDIO-ASSETS.md`, `IMAGE-ASSETS.md`,
  `narration-script.json` and `cmi5.xml` all have a script that writes them.
  Editing one by hand puts it out of step with the content it describes.
  `image-manifest.json` is the sharpest case: it holds each file's real pixel
  dimensions, read from the file, so that the renderer sizes a picture from the
  picture. A hand-typed number there reserves the wrong space and crops.
- **`current-answers.json` is unverified.** The eight dynamic answers are
  rendered as "not checked yet" rather than as fact. Do not fill them in from a
  model's memory; they change with elections.

---

## 12. Checking your work

ADL's [CATAPULT](https://github.com/adlnet/CATAPULT) provides a cmi5 conformance
test suite and worked course examples. Run the package through it before
treating any of this as done.

Beyond conformance, three behaviours are specific to this course and worth
testing by hand:

1. Launch a lesson AU in `Review` mode and confirm **no** `Completed` statement
   is sent.
2. Launch with `languagePreference: "my"` and confirm the language screen is
   skipped and the course opens in Burmese.
3. Leave a lesson **part-way** on one device, launch the same registration on
   another, and confirm the learner resumes where they left off. That is the
   whole reason for §7c, and the only way to know it works.

   Then do it with a **finished** lesson, and confirm the opposite: it opens at
   screen 1, with its ✓ intact. Completing a unit clears its position on
   purpose, and the two behaviours are easy to conflate into one bug.
