# What still needs Burmese

**For:** the translator / native reviewer.
**Generated** by `node scripts/translation-request.js` — regenerate after any
content change rather than editing this file, or it will describe a course that
no longer exists.

Remaining: **0 interface strings** and **16 content
fields** — 8 never translated, and
**8 marked ↻**.

A field that is translated and still current is live and is **not** listed here,
so nothing gets translated twice.

## ↻ means revise, not retranslate

The English on these was rewritten *after* you translated it. Your Burmese is
still in the repository and is not lost — the course simply stops showing it,
because a translation of a sentence the screen no longer says is worse than
English. Until a revision arrives, English learners and Burmese learners see the
same words on those lines.

**Your previous Burmese is in `docs/translation-source.json`.** A ↻ entry is an
object rather than a plain value:

```json
"U0-S01.body": {
  "english": "…the new English…",
  "previousMy": "…what you sent last time…"
}
```

Read the two together, change what the rewrite actually changed, and send back
the value in the same shape a plain entry would take. Most are small edits.

The 8 this time: `U1-S01.afterQuote`, `U2-S01.afterQuote`, `U3-S01.afterQuote`, `U3-S05.alt`, `U4-S01.afterQuote`, `U5-S01.afterQuote`, `U6-S01.afterQuote`, `U6-S06.alt`.


**Work from `docs/translation-source.json`, not from the tables below.** The
tables clip long values to fit a markdown column; that JSON carries the full
English for every field listed here, keyed `screenId.field`, in the exact shape
the value must come back in. The first delivery lost 23 fields to that clipping,
which was a defect in this generator rather than anything the translator did.

---

## 0. Three rules that override everything

### Never translate these

| Never translate | Where it lives |
|---|---|
| Official question wording | `questions-u1.json`…`questions-u7.json` → `official` |
| Accepted answers | same files → `acceptedAnswers` |
| Practice options | same files → `options` |

They are verbatim USCIS M-1778 text and the interview is conducted in English
(rule G-3). The **correct** option in each set restates an accepted answer, so
translating options would put a Burmese answer beside an English question and
train the learner on wording no officer will use.

Those files appear nowhere below.

**Six rows carry a ⚠ warning.** Guided-practice items are our own prose, but a
few of them quote an official question word for word, or reuse an accepted
answer as an option. Those are flagged inline: keep the quoted sentence in
English and translate only the words around it. Everything unflagged is safe.

The warnings are detected by the generator against the real question data, not
remembered by a reviewer — so they cannot fall out of step with the content.

### One deliberate exception

On **interpret** items — the "which question is asking the same thing?" ones —
the option text stays **English**, with a Burmese gloss in brackets:

> `What is the highest law in America? (…)`

The skill being taught is recognising an English test question under unfamiliar
wording. Translating those options deletes the thing being practised.

### Send files. Do not paste.

Burmese is three UTF-8 bytes per character, and **two of them fall in the
0x80–0x9F control range** — including the final byte of every base consonant.
Chat and clipboard channels strip those bytes, so pasted Burmese arrives with
every consonant deleted and only the vowel marks surviving. It cannot be
recovered by any amount of cleverness.

**Save the file and drop it into `docs/translations/`.** Two earlier attempts
were lost this way before we worked out the cause.

---

## 1. Interface strings — 0 of 155 remaining

In `src/lib/content/ui-strings.json`. Fill the `my` value; leave `en` alone.

_All 155 interface strings carry Burmese._ They remain `draft-unreviewed` and still need a native pass, but none is missing.

---

## 2. Fields that came back but could not be used

Three cases from the last delivery. None is a translation error: two are shapes
this document asked for badly, and one is a rule the older Unit 1 source
predates. All three are listed in section 4 again, so they are covered by
working through the tables — this section only explains why they reappear.

| Field | What happened | What is needed |
|---|---|---|
| `U1-S08.twoColumn` | returned as one string per column. The build stores `heading` and `body` as separate fields, and a single string cannot be split back into them without guessing where the heading ends | return it as **objects**; `translation-source.json` now shows the shape |
| `U1-S05.paragraphs`, `U1-S06b.paragraphs` | the older bilingual source divides this prose into a different number of paragraphs than the build has | re-split to the count shown in the source JSON |
| `U1-S09.items[0]` `question` and `options` | translated in full — but that question **is** an official question, and option 0 **is** an accepted answer | both stay English. The build now drops any such translation automatically rather than shipping it, so nothing is at risk; the fields simply stay English until translated around |

---

## 3. How to deliver

One file per unit, `docs/translations/unitN.json`, keyed by screen id then by
the exact `Field` name from the tables below:

```json
{
  "U2-S01": { "heading": "…", "body": "…", "afterQuote": "…" },
  "U2-S05": { "paragraphs": ["…", "…", "…"] }
}
```

Where a value below shows several parts separated by ` | `, that field is a
**list** — return the same number of items in the same order. A wrong count is
caught by `node scripts/build-translations.js unitN` rather than shipped.

Two list shapes are worth naming; both are visible in `translation-source.json`,
which is the authority if this description and the JSON ever disagree:

- **`sortItems`** goes out as plain strings and comes back as plain strings. The
  build re-attaches each item's sorting bucket **by position**, so the order is
  what makes the exercise score correctly. Translate in place; never reorder.
- **`twoColumn` and `cards`** go out as objects and must come back as objects.
  Flattening them loses the boundary between one field and the next, and it
  cannot be recovered afterwards.

| Unit | Fields outstanding |
|---|---|
| U0 Test day | 2 |
| U1 We the People | 3 |
| U2 Three branches | 1 |
| U3 Who represents you | 3 |
| U4 Federal and state | 1 |
| U5 Rights and responsibilities | 2 |
| U6 How America began | 2 |
| U7 How America changed | 2 |
| **Total** | **16** |

---

## 4. The fields

### U0 — Test day

**2 fields.**

| | Screen | Field | English |
|---|---|---|---|
|  | `U0-S01` | `alt` |  |
|  | `U0-S07` | `alt` |  |

### U1 — We the People

**3 fields.**

| | Screen | Field | English |
|---|---|---|---|
| ↻ | `U1-S01` | `afterQuote` | One document is the answer to that question — and to most of the others in this lesson. |
|  | `U1-S09` | `items[0].question` | Name one thing the U.S. Constitution does. **⚠ keep the quoted official question in English**; translate only the words around it |
|  | `U1-S09` | `items[1].instructions` | Tap to sort into Declaration or Constitution. |

### U2 — Three branches

**1 fields.**

| | Screen | Field | English |
|---|---|---|---|
| ↻ | `U2-S01` | `afterQuote` | Three branches, built so that no one of them can act alone. Name them, and the rest of this lesson is who does what. |

### U3 — Who represents you

**3 fields.**

| | Screen | Field | English |
|---|---|---|---|
| ↻ | `U3-S01` | `afterQuote` | Some answers in this lesson are fixed numbers. Others depend on where you live — and part of the lesson is learning how to look those up. |
| ↻ | `U3-S05` | `alt` | The United States Capitol, its white dome above a long colonnaded front, a wing to each side. |
|  | `U3-S06` | `alt` | The White House seen across its lawn, the curved columns of the South Portico at its centre. |

### U4 — Federal and state

**1 fields.**

| | Screen | Field | English |
|---|---|---|---|
| ↻ | `U4-S01` | `afterQuote` | Every question here turns on one habit: asking whether a job belongs to the whole country, or to your state. |

### U5 — Rights and responsibilities

**2 fields.**

| | Screen | Field | English |
|---|---|---|---|
| ↻ | `U5-S01` | `afterQuote` | The test asks about rights and duties as two short lists. This lesson gives you both — and the difference between them. |
|  | `U5-S06` | `alt` | A polling place: a Vote Here sign beside open voting booths, with people filling in ballots. |

### U6 — How America began

**2 fields.**

| | Screen | Field | English |
|---|---|---|---|
| ↻ | `U6-S01` | `afterQuote` | Behind that question is one summer in Philadelphia, thirteen colonies, and a decision none of them could take back. |
| ↻ | `U6-S06` | `alt` | The Declaration of Independence on aged parchment, headed In Congress, July 4, 1776. |

### U7 — How America changed

**2 fields.**

| | Screen | Field | English |
|---|---|---|---|
|  | `U7-S06` | `alt` | Civil rights marchers walking arm in arm along a road, United States flags carried among them. |
|  | `U7-S12` | `items[1].buckets` | Memorial Day \| Veterans Day |
