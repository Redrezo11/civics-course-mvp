# What still needs Burmese

**For:** the translator / native reviewer.
**Generated** by `node scripts/translation-request.js` — regenerate after any
content change rather than editing this file, or it will describe a course that
no longer exists.

Remaining: **0 interface strings** and **37 content
fields** — 29 never translated, and
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
| U2 Three branches | 4 |
| U3 Who represents you | 7 |
| U4 Federal and state | 3 |
| U5 Rights and responsibilities | 5 |
| U6 How America began | 6 |
| U7 How America changed | 7 |
| **Total** | **37** |

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

**4 fields.**

| | Screen | Field | English |
|---|---|---|---|
| ↻ | `U2-S01` | `afterQuote` | Three branches, built so that no one of them can act alone. Name them, and the rest of this lesson is who does what. |
|  | `U2-S04` | `cards` | branch: one part of the government. — “A branch of government is like one branch of a tree.” \| veto: to say no to a bill. — “The President can veto a bill — say no to it.” \| enforce: to make people follow a rule. — “Police enforce traffic laws.” \| justice: a judge on the Supreme Court. — “There are nine justices on … **[clipped — full text in `translation-source.json` under `U2-S04.cards`]** |
|  | `U2-S05` | `paragraphs` | Three buildings. Three jobs. \| The Capitol: Congress works here — it writes the laws. Congress has two parts, the Senate and the House of Representatives; you will meet them closely in the next lesson. \| The White House: the President works here — the President carries out the laws, leads the executive branch, comman… **[clipped — full text in `translation-source.json` under `U2-S05.paragraphs`]** |
|  | `U2-S06` | `paragraphs` | Now watch the buildings push against each other. \| Congress passes a bill. It is not law yet — it goes to the President, who signs it into law or vetoes it. And even a signed law can be stopped: a court can rule it goes against the Constitution. \| Each branch can block the others. That blocking has a name you already… **[clipped — full text in `translation-source.json` under `U2-S06.paragraphs`]** **⚠ keep the quoted official question in English**; translate only the words around it |

### U3 — Who represents you

**7 fields.**

| | Screen | Field | English |
|---|---|---|---|
| ↻ | `U3-S01` | `afterQuote` | Some answers in this lesson are fixed numbers. Others depend on where you live — and part of the lesson is learning how to look those up. |
|  | `U3-S03` | `bodyList` | Imagine five towns that share one road, one water supply, and one school. \| One town is large; four are small. When they meet to decide things together, how should the voting work? \| If every decision follows population, the four small towns are ignored forever — outvoted before they speak. \| If every town gets one … **[clipped — full text in `translation-source.json` under `U3-S03.bodyList`]** |
|  | `U3-S04` | `cards` | senator: a member of the Senate. — “Each state has two senators.” \| representative: a member of the House. — “A representative represents the people of one district.” \| district: your area. — “Everyone on your street is in your district.” \| term: how long a leader serves before the next election. — “A senator's term… **[clipped — full text in `translation-source.json` under `U3-S04.cards`]** |
|  | `U3-S05` | `paragraphs` | Inside the Capitol are two rooms, built on two opposite principles — on purpose. \| The Senate: every state equal. Two senators per state, big or small. 50 states × 2 = 100 senators. A senator represents the people of their whole state and serves six years — a longer term than representatives get. Why two per state? Eq… **[clipped — full text in `translation-source.json` under `U3-S05.paragraphs`]** |
| ↻ | `U3-S05` | `alt` | The United States Capitol, its white dome above a long colonnaded front, a wing to each side. |
|  | `U3-S06` | `paragraphs` | The President is elected for four years — and may serve only two terms. \| Why the limit? The 22nd Amendment — and you already know the deeper reason: to keep the president from becoming too powerful. The fear of kings, again. \| Who actually decides the winner? The Electoral College — a compromise between electing the… **[clipped — full text in `translation-source.json` under `U3-S06.paragraphs`]** |
|  | `U3-S06` | `alt` | The White House seen across its lawn, the curved columns of the South Portico at its centre. |

### U4 — Federal and state

**3 fields.**

| | Screen | Field | English |
|---|---|---|---|
| ↻ | `U4-S01` | `afterQuote` | Every question here turns on one habit: asking whether a job belongs to the whole country, or to your state. |
|  | `U4-S04` | `cards` | federal: the national government — all fifty states together. — “Federal taxes are paid to the national government.” \| state: one of the fifty. — “Yours is California.” \| treaty: an official agreement between countries. — “Only the federal government can make a treaty.” \| zoning: local rules about land — what can be… **[clipped — full text in `translation-source.json` under `U4-S04.cards`]** |
|  | `U4-S05` | `paragraphs` | Country-sized jobs go to the federal government. \| These are jobs that only work if the whole country does them together: print paper money and mint coins (fifty different currencies would be chaos), declare war, create an army, make treaties with other countries, set foreign policy. One country must speak with one vo… **[clipped — full text in `translation-source.json` under `U4-S05.paragraphs`]** |

### U5 — Rights and responsibilities

**5 fields.**

| | Screen | Field | English |
|---|---|---|---|
| ↻ | `U5-S01` | `afterQuote` | The test asks about rights and duties as two short lists. This lesson gives you both — and the difference between them. |
|  | `U5-S04` | `cards` | right: a freedom the law protects for you. — “The right to vote belongs to citizens.” \| responsibility: a duty — something you must or should do. — “Paying taxes is a responsibility.” \| jury: a group of citizens who decide a court case. — “Citizens serve on a jury.” \| oath: an official, serious promise. — “At your c… **[clipped — full text in `translation-source.json` under `U5-S04.cards`]** |
|  | `U5-S05` | `paragraphs` | Remember the Bill of Rights from the rulebook lesson — protections for people living in the United States, not only citizens. \| Everyone here holds these: freedom of speech, freedom of expression, freedom of assembly (gathering in groups), freedom to petition the government (asking it to change something), freedom of … **[clipped — full text in `translation-source.json` under `U5-S05.paragraphs`]** |
|  | `U5-S06` | `paragraphs` | Belonging also asks. \| Everyone who earns money here pays federal taxes — required by law, and it is how the country pays for what it does. Men aged 18 through 25 register for the Selective Service — a list, required by law, that makes a draft fair if one is ever needed. \| And at your ceremony, you will stand and tak… **[clipped — full text in `translation-source.json` under `U5-S06.paragraphs`]** |
|  | `U5-S06` | `alt` | A polling place: a Vote Here sign beside open voting booths, with people filling in ballots. |

### U6 — How America began

**6 fields.**

| | Screen | Field | English |
|---|---|---|---|
| ↻ | `U6-S01` | `afterQuote` | Behind that question is one summer in Philadelphia, thirteen colonies, and a decision none of them could take back. |
|  | `U6-S04` | `cards` | colony: a settlement ruled by a faraway country. — “The thirteen colonies were ruled by Britain.” \| independence: being free — ruling yourself. — “The colonies declared independence in 1776.” \| revolution: a fight to change who rules. — “The American Revolution won independence from Britain.” \| declare: to say offic… **[clipped — full text in `translation-source.json` under `U6-S04.cards`]** |
|  | `U6-S05` | `paragraphs` | Chapter 1 — Before. \| American Indians — Native Americans — lived on this land first, for thousands of years, in many nations: Cherokee, Navajo, Sioux, and hundreds more. \| Then ships came from Europe. The colonists came for reasons you will recognize: freedom — religious freedom, political liberty — economic opportu… **[clipped — full text in `translation-source.json` under `U6-S05.paragraphs`]** |
|  | `U6-S06` | `paragraphs` | Chapter 2 — The break. \| The thirteen colonies were ruled by Britain, and Britain taxed them — the Stamp Act, the Tea Act — while giving them no vote and no voice in the decisions. The colonists gave their complaint a name that still rings: taxation without representation. Protest grew — the Boston Tea Party — and pro… **[clipped — full text in `translation-source.json` under `U6-S06.paragraphs`]** |
| ↻ | `U6-S06` | `alt` | The Declaration of Independence on aged parchment, headed In Congress, July 4, 1776. |
|  | `U6-S07` | `paragraphs` | Chapter 3 — The build. \| The colonies were free — but they were struggling. The first loose arrangement between the states (the Articles of Confederation) proved too weak to work. So in 1787, the states sent their best minds to Philadelphia and wrote the Constitution — the rulebook you know, born from the two fears yo… **[clipped — full text in `translation-source.json` under `U6-S07.paragraphs`]** |

### U7 — How America changed

**7 fields.**

| | Screen | Field | English |
|---|---|---|---|
|  | `U7-S04` | `cards` | slavery: owning people as property — forced work without freedom. — “The Civil War ended slavery.” \| union: the states together as one country. — “Lincoln saved the Union.” \| discrimination: treating people unfairly because of their group. — “The civil rights movement fought discrimination.” \| communism: a system wh… **[clipped — full text in `translation-source.json` under `U7-S04.cards`]** |
|  | `U7-S05` | `paragraphs` | Chapter 1 — The war over the promise. \| First, the country grew: in 1803 the United States bought the Louisiana Territory from France, doubling its size — Jefferson's doing. But growth sharpened the question the founders had left open: slavery. The North and the South finally went to war over it — the Civil War, the w… **[clipped — full text in `translation-source.json` under `U7-S05.paragraphs`]** |
|  | `U7-S06` | `paragraphs` | Chapter 2 — The promise, written into the rulebook. \| After the war, the amendment tool went to work. The 14th Amendment wrote a new promise into the rulebook: all persons born or naturalized in the United States are U.S. citizens. Read that twice — or naturalized. Your certificate, when you receive it, will rest on t… **[clipped — full text in `translation-source.json` under `U7-S06.paragraphs`]** |
|  | `U7-S06` | `alt` | Civil rights marchers walking arm in arm along a road, United States flags carried among them. |
|  | `U7-S07` | `paragraphs` | Chapter 3 — America in the world. \| The 1900s took America into the world, and the test asks why each time — so learn the reasons, not just the names. \| World War I. Germany attacked American ships. The United States entered the war. \| The Great Depression began in 1929 when the stock market crashed. It was the long… **[clipped — full text in `translation-source.json` under `U7-S07.paragraphs`]** |
|  | `U7-S08` | `paragraphs` | Chapter 4 — The symbols you will stand under. \| At your ceremony there will be a flag. Read it like a sentence: 13 stripes — the 13 original colonies, from the founding story. 50 stars — one for each state, from the growing story. \| The capital: Washington, D.C. The Statue of Liberty stands in New York Harbor — for m… **[clipped — full text in `translation-source.json` under `U7-S08.paragraphs`]** |
|  | `U7-S12` | `items[1].buckets` | Memorial Day \| Veterans Day |
