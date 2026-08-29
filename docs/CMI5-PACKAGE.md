# The cmi5 package

**Build it:**

```
node scripts/cmi5-package.js
```

No `--ns` needed — the manifest generator's default is a fixed `urn:uuid:…`
namespace, checked into the repo, that names no host or domain. Pass `--ns
https://your.domain/civics-mvp` only if you specifically want ids under a
domain you control instead; whichever you pick, keep using that exact value on
every future rebuild, since it is the key an LRS files learner records under.

Output is `packages/civics-course-cmi5.zip`, which is **gitignored** — it is a
build artefact of a build artefact, about a megabyte, and committing it would
mean re-uploading the whole course on every content change. Rebuild it whenever
you need it; the command takes a couple of seconds.

**Import it:** TalentLMS → Courses → *hover the course* → Edit → Add → Learning
Activities → **SCORM | xAPI | cmi5** → upload the zip → publish.

---

## Status — read this before trusting it

| | |
|---|---|
| **Verified** | Statement shapes, ordering, `launchMode` gating, duration, context merging, single-use token, actor parsing — against a **fake** LRS in `tests/cmi5.test.js`, 19 tests, each break-tested |
| **Verified** | The archive: `cmi5.xml` at the root, `au/index.html` present, forward-slash paths — read back out of the written zip, and extracted independently with .NET's `ZipFile` |
| **NOT verified** | The authentication handshake against a real LRS |
| **NOT verified** | That TalentLMS marks the activity complete when the statements arrive |
| **NOT verified** | cmi5 conformance. [ADL's CATAPULT](https://github.com/adlnet/CATAPULT) is the test suite; it has not been run |

**This package has never been launched in a real LMS.** A fake LRS proves the AU
sends the right things in the right order. It cannot prove an LMS accepts them.

---

## What the package contains

```
civics-course-cmi5.zip
├── cmi5.xml            ← at the ROOT. An LMS looks here and nowhere else
└── au/
    ├── index.html
    ├── assets/         ← JS, CSS, the Myanmar font subset
    ├── images/         ← 31 photographs and companion illustrations
    ├── audio/          ← empty; narration falls back to speech synthesis
    ├── favicon.svg
    └── icons.svg
```

One AU, `moveOn="Completed"`, no `masteryScore`.

**Why one AU and not nine.** The manifest used to declare an AU per lesson plus
one for the rehearsal, inside a block. That is valid cmi5 and wrong for this
target: TalentLMS imports a package as a *single learning activity*, and nothing
in its documentation says how nine assignable units are surfaced. One AU has one
launch and one completion and depends on no LMS behaviour we cannot confirm.

**Why nothing is scored.** The rehearsal is self-marked — the learner taps "Yes,
I got it" or "Not yet" and nothing measures the answer. As a scored AU that made
`Failed` possible, and TalentLMS maps a package's statements onto the course
around it, so a practice run of 11 out of 20 could have marked someone as having
failed the course they are studying for. Rule G-1 says nothing is counted
against the learner. QA check 21 asserts no code path emits `Failed` and that
the manifest claims no mastery score.

## What it sends

| Verb | When |
|---|---|
| `Initialized` | boot, once |
| `progressed` | each lesson finished, weighted by that lesson's share of the 128 |
| `Completed` + `Passed` | all seven lessons finished |
| `Terminated` | `pagehide` |

Never `Failed`. No interaction statements — guided-practice items are not
official questions (G-22), the eight dynamic answers must never carry a score,
and not emitting them is the only way to be certain no official USCIS wording
leaves the device.

**Course completion is all seven lessons, not Unit 7.** U0 is orientation and
teaches none of the 128, and units are not locked, so a learner may finish U7
third. `courseComplete` in `src/lib/stores/progress.js` is the one definition,
and `Home.svelte` renders from it too — the screen congratulating the learner
and the record sent to their organisation cannot disagree.

**`progressed` is not the on-screen counter.** It is course progress: the share
of the 128 covered by lessons finished. The counter the learner sees is
`questionsPracticedCount`, which counts questions actually *answered* and is
deliberately stricter (G-22). Both top out at 128 and they are not the same
number; do not report one as the other.

---

## Six changes to the prototype runtime

`src/lib/cmi5.js` is built from the `cmi5-lite.js` in the conversion brief — its
module shape, verb map, `active:false` degradation and `keepalive` are all kept.
Six things were changed. They are listed here because the next person to read
that brief will otherwise change them back.

| | Was | Why it matters |
|---|---|---|
| 1 | `launchMode` never read | The spec: in Browse and Review the AU *"MUST send Initialized and Terminated… MUST NOT send other cmi5 defined statements"*. Without it a learner revisiting finished material re-satisfies it on every visit — the brief's own §7 lists this as an open question |
| 2 | No `result.duration` | *"The AU MUST include the `duration` property"*, stated separately for `Completed`, `Passed`, `Failed` and `Terminated` |
| 3 | `progressed` carried the cmi5 category | The category marks a cmi5-*defined* statement; `progressed` is cmi5-*allowed* and uses the context template *"but NOT including cmi5 category ID"* |
| 4 | No guard on the fetch URL | It *"MUST NOT return an authorization token more than once"*; a second request errors with code 1. A double mount or a refresh mid-boot would kill the session for a reason nobody would guess from the symptom |
| 5 | `beforeunload` | Does not fire reliably on mobile, and this course exists for people on cheap Android phones. `pagehide` does. The handler also never set `terminated`, so `terminate()` could send a second one |
| 6 | `JSON.parse(decodeURIComponent(actor))` | `URLSearchParams.get()` has already decoded it. Any actor whose name contains `%` or `+` corrupts or throws |

Fixing 1 required fetching `LMS.LaunchData`, which the prototype never did — and
that document also carries `contextTemplate`, which every statement must merge,
so one fix closed three gaps.

Each is break-tested: reverting it makes exactly one test fail.

---

## Opened without an LMS

No `endpoint` parameter means no LMS. `init()` reports itself inactive, every
other call is a no-op, and the course behaves exactly as it does on GitHub
Pages. That is not a fallback bolted on afterwards — it is the common case, and
`tests/cmi5.test.js` asserts that nothing is sent on it.

Two things the learner is told change when an LMS *is* listening, because the
old wording becomes untrue:

- **Help → privacy.** "saves your progress only on your own phone" becomes a
  statement that it is also reported to the organisation providing the course.
- **Help → start over.** Clearing local storage does not unsend what has already
  been reported, and a learner starting over would otherwise believe their
  record was gone.
- **Completion.** "take a picture of the two counters" existed only because the
  course had no way to report anything. Under an LMS there is a record.

Those strings are new and their Burmese is outstanding — listed in
`docs/TRANSLATION-REQUEST.md`, with English showing until a revision arrives.

`settings.saved` — *"Your choice is saved on this phone"* — is **left alone**.
Language and theme are not reported anywhere, so it is still true.

---

## First launch — what to watch

1. **Does it launch at all?** If the AU shows a blank page, check the browser
   console for a 404 on `assets/…`. That would mean the relative-path assumption
   broke, not the cmi5 wiring.
2. **Finish a lesson.** A `progressed` statement should reach the LRS. TalentLMS
   shows statements in its Timeline.
3. **Finish all seven.** `Completed` and `Passed` should arrive together and the
   activity should register complete.
4. **Relaunch it.** If TalentLMS launches in `Review` mode, **nothing but
   `Initialized` and `Terminated` should be sent.** This is defect 1 and the one
   most likely to bite; if a second `Completed` appears, the launch data is not
   being read and that is where to look.
5. **Set `languagePreference` to `my`** on the learner if TalentLMS exposes it —
   the language screen should be skipped and the course should open in Burmese.

If something is wrong, `src/lib/cmi5.js` logs every failure to the console with
the verb that failed. Nothing there throws: a dropped statement must never take
the lesson down with it.

---

## Before real learners

- **The default namespace is fine to ship as-is** — a fixed `urn:uuid:…` that
  names no host, so it stays correct even if this repo moves or GitHub Pages
  goes away. Only pass `--ns` if you specifically want ids under a domain you
  control. Either way: activity ids are the key an LRS files learner records
  under, so once real learners have started, keep rebuilding with the exact
  same namespace — changing it orphans their history, because the LMS cannot
  tell the old and new ids are the same course.
- **`voting.webp` carries a visible Shutterstock watermark** — a comp preview,
  not a licensed download. Publishing a static site and handing an organisation
  a package to host are different acts. See `docs/IMAGE-ASSETS.md`.
- **`civil-rights-march.webp`** is a press photograph with no licence recorded.
- Burmese is built from sources marked `draft-unreviewed`; seven of the eight
  dynamic answers are unverified and render as "not checked yet"; no narration
  is recorded. All three are honest on screen and none blocks a package.
