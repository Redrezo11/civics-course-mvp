# What still needs Burmese

**For:** the translator / native reviewer.
**Generated** by `node scripts/translation-request.js` — regenerate after any
content change rather than editing this file, or it will describe a course that
no longer exists.

Everything already translated is live and is **not** listed here, so nothing gets
translated twice. Remaining: **5 interface strings** and
**264 content fields**.

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

## 1. Interface strings — 5 of 38 remaining

In `src/lib/content/ui-strings.json`. Fill the `my` value; leave `en` alone.

| Key | English |
|---|---|
| `settings.coverage.en` | The course is written in English. |
| `settings.draftBadge` | draft |
| `settings.saved` | Your choice is saved on this phone. |
| `settings.testStaysEnglish` | Test questions and answers stay in English — that is the language of the real interview. |
| `settings.title` | Settings |

---

## 2. Unit 1 — the 11 fields the existing source could not fill

Unit 1 is largely translated. These could **not** be taken from
`docs/translations/unit1.json` because its paragraph splits differ from the
build's, and splitting Burmese prose at a guessed sentence boundary is not
something that can be done without reading it.

| Screen | Why it did not map | What is needed |
|---|---|---|
| `U1-S01` | source is one paragraph; the build has six separate fields | each field separately |
| `U1-S03` | source has 3 paragraphs; `bodyList` expects 4 | re-split to 4 |
| `U1-S05` | source has 5; `paragraphs` expects 3 | re-split to 3, plus `handle` and `handleSub` |
| `U1-S06b` | source has 3; `paragraphs` expects 4 | re-split to 4 |
| `U1-S07b` | source combines term and definition in one line | split into `termA.name` / `termA.def`, same for `termB` |
| `U1-S08` | source is prose; build has `twoColumn` + `closing` | a heading and body per document, plus the closing line |
| `U1-S11`–`S15` | source feedback opens "The correct answer is **X**." | **drop that opening sentence.** The app already prints it, so keeping it shows the answer twice. Only the explanation that follows is wanted. |

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

| Unit | Fields outstanding |
|---|---|
| U0 Test day | 11 |
| U1 We the People | 23 |
| U2 Three branches | 39 |
| U3 Who represents you | 37 |
| U4 Federal and state | 35 |
| U5 Rights and responsibilities | 37 |
| U6 How America began | 35 |
| U7 How America changed | 47 |
| **Total** | **264** |

---

## 4. The fields

### U0 — Test day

**11 fields.**

| Screen | Field | English |
|---|---|---|
| `U0-S01` | `heading` | Welcome |
| `U0-S01` | `body` | This course covers all 128 questions on the U.S. citizenship civics test, in short lessons you can fit around your day. |
| `U0-S02` | `body` | The civics test is a conversation. An officer asks you questions out loud. You answer out loud. There are 128 possible questions. The officer asks up to 20. |
| `U0-S02` | `alt` | A naturalization ceremony: rows of people standing with their right hands raised, small United States flags in their left hands. |
| `U0-S03` | `heading` | 12 |
| `U0-S03` | `body` | Answer 12 correctly — you pass. The officer stops as soon as you reach 12 right. If you get 9 wrong, the test ends. |
| `U0-S04` | `body` | Here is a real test question. Read it, and answer out loud. |
| `U0-S05` | `heading` | The question's opening words tell you what kind of answer |
| `U0-S05` | `body` | The question's opening words tell you what kind of answer the officer wants. |
| `U0-S06` | `body` | Some answers change after elections — like the name of the President. This course shows today's answers and the date we checked them. Always check again before your interview. |
| `U0-S07` | `bodyList` | Short lessons — 8 minutes each. \| Stop anytime. The course remembers your place. |

### U1 — We the People

**23 fields.**

| Screen | Field | English |
|---|---|---|
| `U1-S01` | `unitLabel` | Unit 1 |
| `U1-S01` | `heading` | We the People |
| `U1-S01` | `body` | At your interview, the officer will ask about America's rulebook — questions like: |
| `U1-S01` | `afterQuote` | This lesson will help you answer those questions. |
| `U1-S01` | `coverageLine` | It covers 14 of the 128 on the test. |
| `U1-S01` | `afterTest` | And what you learn here matters after the test too — this rulebook is what protects your rights as a citizen. |
| `U1-S03` | `bodyList` | Every group you have ever been part of had rules. \| A workplace has rules about what the boss can and cannot ask you to do. \| A family has rules everyone knows. \| A game has rules, written down, that even the best player must follow. |
| `U1-S03` | `bodyList2` | America wrote its rules for government down in one book — and made that book very hard to change. \| Even the President must obey it. |
| `U1-S03` | `closing` | That book is the Constitution. |
| `U1-S05` | `paragraphs` | In 1787, the thirteen states had just finished a long war against a king. They needed a government — but they were afraid of two opposite things at the same time. \| They were afraid of having no government. Without one, nobody could defend the country, settle arguments between states, or pay for anything. \| They were… |
| `U1-S05` | `resolution` | The Constitution is their answer to both fears at once. |
| `U1-S05` | `handle` | It creates the government, limits it, and protects your rights. |
| `U1-S05` | `handleSub` | Three jobs, all born from the same fear of kings. |
| `U1-S06b` | `paragraphs` | Can the rulebook change? Yes — by amendment. But the writers made changing it slow and difficult on purpose. A rulebook that is easy to change is not much of a limit on anyone. \| In more than 230 years, it has changed only 27 times. That small number is the point. \| Many people worried that the new Constitution did n… |
| `U1-S07b` | `termA` | Supreme law of the land — the Constitution, the book of rules. |
| `U1-S07b` | `termB` | Supreme Court — the highest court, a group of nine judges. |
| `U1-S08` | `twoColumn` | Declaration of Independence — 1776: An announcement to the world: America is free from Britain. It says all people are created equal, with rights that belong to them — 'Life, Liberty, and the pursuit of Happiness.' \| Constitution — 1787: A rulebook. It builds: the government America still uses today. |
| `U1-S08` | `closing` | First the country announced what it believed. Eleven years later, it wrote the rules to make those beliefs real. 1776 declares. 1787 designs. Remember those two dates — they answer several test questions. |
| `U1-S11` | `feedbackExplain` | Remember the pair: the supreme law of the land is a book of rules. The Supreme Court is the highest court, with nine judges. The judges must follow the book. |
| `U1-S12` | `feedbackExplain` | Twenty-seven — a small number, because changing the rulebook was made slow and difficult on purpose. |
| `U1-S13` | `feedbackExplain` | That is what the rule of law means — no one is above the law. |
| `U1-S14` | `feedbackExplain` | The Constitution begins with “We the People” because political power starts with the people. |
| `U1-S15` | `feedbackExplain` | An amendment is an official change or addition to the Constitution. |

### U2 — Three branches

**39 fields.**

| Screen | Field | English |
|---|---|---|
| `U2-S01` | `unitLabel` | Unit 2 |
| `U2-S01` | `heading` | Three branches |
| `U2-S01` | `body` | The officer will ask how American government is built — questions like: |
| `U2-S01` | `afterQuote` | This lesson will help you answer those questions. |
| `U2-S01` | `coverageLine` | It covers 20 of the 128 on the test. |
| `U2-S01` | `afterTest` | And after the test: this is how to understand any news story about Washington. |
| `U2-S02` | `question` | Imagine one person writes the rules, enforces the rules, AND judges everyone accused of breaking them. Good idea or bad idea? |
| `U2-S02` | `feedback` | The founders' answer: very bad idea. They had just escaped a ruler with too much power. So they split the power into three. |
| `U2-S03` | `bodyList` | You have seen this everywhere. \| In a soccer game, the players do not referee themselves, and the referee does not write the rulebook — three different hands, on purpose. \| At work, the person who spends the money is usually not the person who checks the books. |
| `U2-S03` | `bodyList2` | When one person holds every job, honest mistakes go uncorrected and dishonest ones go unpunished. \| Splitting the jobs is how groups protect themselves. |
| `U2-S03` | `closing` | America built its whole government on that idea. |
| `U2-S04` | `cards` | branch: one part of the government. — “A branch of government is like one branch of a tree.” \| veto: to say no to a bill. — “The President can veto a bill — say no to it.” \| enforce: to make people follow a rule. — “Police enforce traffic laws.” \| justice: a judge on the Supreme Court. — “There are nine justices on … |
| `U2-S05` | `paragraphs` | Three buildings. Three jobs. \| The Capitol: Congress works here — it writes the laws. Congress has two parts, the Senate and the House of Representatives; you will meet them closely in the next lesson. \| The White House: the President works here — the President carries out the laws, leads the executive branch, comman… |
| `U2-S05` | `handle` | Congress makes the laws. The President carries them out. The courts explain them. |
| `U2-S05` | `handleSub` | No branch can do another branch's job. |
| `U2-S05` | `alt` | Three government buildings side by side: the domed Capitol, the White House, and the columned Supreme Court. |
| `U2-S06` | `paragraphs` | Now watch the buildings push against each other. \| Congress passes a bill. It is not law yet — it goes to the President, who signs it into law or vetoes it. And even a signed law can be stopped: a court can rule it goes against the Constitution. \| Each branch can block the others. That blocking has a name you already… **⚠ keep the quoted official question in English**; translate only the words around it |
| `U2-S06` | `resolution` | It usually takes five of the nine justices to decide a case. The President appoints federal judges — but cannot remove them. |
| `U2-S06` | `handle` | Checks and balances exist so no one part becomes too powerful. |
| `U2-S07` | `heading` | Each branch can stop the others. That is the design working. |
| `U2-S07` | `example` | Congress writes a bill raising a tax. The President vetoes it. The bill does not become law — unless a very large majority in Congress votes again to overrule the veto. Two branches, pushing. |
| `U2-S07` | `nonExample` | A king announces a tax in the morning, collects it that same afternoon, and puts anyone who complains in prison that night. One person, all three jobs — the exact thing the three buildings exist to prevent. |
| `U2-S07` | `takeaway` | Splitting the jobs is what stops any one of them from becoming a king. |
| `U2-S08` | `heading` | Two names on the test sound alike. Do not mix them up. |
| `U2-S08` | `termA` | The Cabinet — advises the President. It is a small team of people the President chooses. |
| `U2-S08` | `termB` | Congress — writes the laws. It has 535 members, and they are elected by voters — not chosen by the President. |
| `U2-S08` | `resolution` | The President picks the Cabinet. Voters pick Congress. |
| `U2-S10` | `items[0].instructions` | Tap to sort each job into the branch that does it. |
| `U2-S10` | `items[0].sortItems` | Writes laws \| Vetoes bills \| Explains laws \| Commander in Chief \| Decides if a law goes against the Constitution \| The Cabinet |
| `U2-S10` | `items[0].buckets` | Congress \| President \| Courts |
| `U2-S10` | `items[1].question` | A bill is written. Before it becomes law, whose desk must it cross — and what two things can happen there? |
| `U2-S10` | `items[1].options` | The President's — who signs it into law, or vetoes it \| The Chief Justice's — who approves it, or strikes it down \| The Speaker's — who publishes it, or delays it |
| `U2-S10` | `items[2].question` | Why can a court stop a law that Congress and the President both approved? |
| `U2-S10` | `items[2].options` | Because the Constitution is above all three of them \| Because judges are elected by the people \| Because the President asked them to |
| `U2-S10` | `items[3].question` | The officer asks this. Is the first word asking for a list, or a reason? |
| `U2-S10` | `items[3].options` | A reason — because no one part should become too powerful \| A list — legislative, executive, and judicial \| A number — three |
| `U2-S15` | `feedbackExplain` | A justice serves for life so that no one can remove them for a decision. A judge with no one to fear is free to follow only the rulebook. |
| `U2-S18` | `heading` | Lesson 2 finished. |
| `U2-S18` | `learnedLine` | You learned the ideas behind all 20 questions in this lesson, and practiced 6 of them. |

### U3 — Who represents you

**37 fields.**

| Screen | Field | English |
|---|---|---|
| `U3-S01` | `unitLabel` | Unit 3 |
| `U3-S01` | `heading` | Who represents you |
| `U3-S01` | `body` | The officer will ask about the people you will help elect — questions like: |
| `U3-S01` | `afterQuote` | This lesson will help you answer those questions. |
| `U3-S01` | `coverageLine` | It covers 23 of the 128 — the biggest single lesson. |
| `U3-S01` | `afterTest` | After you naturalize, you vote for every one of these jobs. |
| `U3-S02` | `question` | California has about 39 million people. Wyoming has about half a million. In Congress, should California's voice be 78 times louder? |
| `U3-S02` | `feedback` | In 1787 the states nearly walked away from each other over exactly this question. Their compromise built Congress — and it is worth understanding, because it explains six test answers at once. |
| `U3-S03` | `bodyList` | Imagine five towns that share one road, one water supply, and one school. \| One town is large; four are small. When they meet to decide things together, how should the voting work? \| If every decision follows population, the four small towns are ignored forever — outvoted before they speak. \| If every town gets one … |
| `U3-S03` | `bodyList2` | Neither rule alone is fair. \| So groups like this often use both: some decisions counted one way, some the other. |
| `U3-S03` | `closing` | America's Congress is that compromise, made permanent. |
| `U3-S04` | `cards` | senator: a member of the Senate. — “Each state has two senators.” \| representative: a member of the House. — “A representative represents the people of one district.” \| district: your area. — “Everyone on your street is in your district.” \| term: how long a leader serves before the next election. — “A senator's term… |
| `U3-S05` | `paragraphs` | Inside the Capitol are two rooms, built on two opposite principles — on purpose. \| The Senate: every state equal. Two senators per state, big or small. 50 states × 2 = 100 senators. A senator represents the people of their whole state and serves six years — a longer term than representatives get. Why two per state? Eq… |
| `U3-S05` | `handle` | One state, two kinds of voice. |
| `U3-S05` | `handleSub` | Citizens elect both. |
| `U3-S05` | `alt` | The United States Capitol building, with its two wings marked as the Senate chamber and the House chamber. |
| `U3-S06` | `paragraphs` | The President is elected for four years — and may serve only two terms. \| Why the limit? The 22nd Amendment — and you already know the deeper reason: to keep the president from becoming too powerful. The fear of kings, again. \| Who actually decides the winner? The Electoral College — a compromise between electing the… |
| `U3-S06` | `resolution` | And if the President can no longer serve, the Vice President becomes President. |
| `U3-S07` | `heading` | Two rooms, two kinds of fairness — both true at once. |
| `U3-S07` | `example` | Wyoming's two senators can stand equal to California's two — while in the House, California sends dozens of representatives, because it has far more people. Both truths, both rooms. |
| `U3-S07` | `nonExample` | Imagine only one room, seats by population alone. The five biggest states could outvote the other forty-five on everything, forever. The small states saw that future in 1787 and refused it. |
| `U3-S07` | `takeaway` | That refusal is why the Senate exists. |
| `U3-S08` | `heading` | Two jobs on the test sound alike. Do not mix them up. |
| `U3-S08` | `termA` | Senator — represents an entire state. Two per state, six-year term. |
| `U3-S08` | `termB` | Representative — represents one district within a state. 435 in all, two-year term. |
| `U3-S08` | `resolution` | That is the difference the test cares about — everything else follows from it. |
| `U3-S09` | `items[0].instructions` | Tap to sort each fact into the Senate or the House. |
| `U3-S09` | `items[0].sortItems` | 100 members \| 435 members \| 6-year term \| 2-year term \| Two per state \| Based on population |
| `U3-S09` | `items[0].buckets` | Senate \| House |
| `U3-S09` | `items[1].question` | Why do representatives serve shorter terms than senators? |
| `U3-S09` | `items[1].options` | So they must face the voters more often \| Because there are more of them \| Because their work is easier |
| `U3-S09` | `items[2].question` | Who does a senator represent, and who does a representative represent? |
| `U3-S09` | `items[2].options` | A senator: the whole state. A representative: one district \| A senator: one district. A representative: the whole state \| Both represent the whole country |
| `U3-S09` | `items[3].question` | The officer asks this. Is he asking for a number, a name, or a reason? |
| `U3-S09` | `items[3].options` | A name — and it changes with elections \| A number — there are two per state \| A reason — equal representation for small states |
| `U3-S17` | `heading` | Lesson 3 finished. |
| `U3-S17` | `learnedLine` | You learned the ideas behind all 23 questions in this lesson, and practiced 6 of them. That is more than half of the government questions. |

### U4 — Federal and state

**35 fields.**

| Screen | Field | English |
|---|---|---|
| `U4-S01` | `unitLabel` | Unit 4 |
| `U4-S01` | `heading` | Federal and state |
| `U4-S01` | `body` | The officer will ask which level of government does what — questions like: |
| `U4-S01` | `afterQuote` | This lesson will help you answer those questions. |
| `U4-S01` | `coverageLine` | Only 5 of the 128 — but they guard against easy mistakes. |
| `U4-S01` | `afterTest` | After the test: this is why some offices are 'federal' and some are 'state' — and which one to call. |
| `U4-S02` | `question` | Who gave you your driver's license — the United States, or California? |
| `U4-S02` | `feedback` | California. Keep that card in your pocket; it unlocks this whole family of questions. |
| `U4-S03` | `bodyList` | A big apartment building runs on two levels of rules. \| The building management handles what must be the same for everyone — the roof, the water, the front door. \| Each family runs its own home — meals, bedtimes, guests. |
| `U4-S03` | `bodyList2` | Nobody wants management choosing their dinner, and no family can fix the roof alone. |
| `U4-S03` | `closing` | America runs the same way: one country, fifty states, two levels, different jobs. |
| `U4-S04` | `cards` | federal: the national government — all fifty states together. — “Federal taxes are paid to the national government.” \| state: one of the fifty. — “Yours is California.” \| treaty: an official agreement between countries. — “Only the federal government can make a treaty.” \| zoning: local rules about land — what can be… |
| `U4-S05` | `paragraphs` | Country-sized jobs go to the federal government. \| These are jobs that only work if the whole country does them together: print paper money and mint coins (fifty different currencies would be chaos), declare war, create an army, make treaties with other countries, set foreign policy. One country must speak with one vo… |
| `U4-S05` | `resolution` | The federal government gets only what the Constitution gives it. Everything else stays close to home. |
| `U4-S05` | `handle` | Country-sized jobs are federal. Close-to-home jobs are state. |
| `U4-S05` | `alt` | Two levels drawn as a diagram: a single national government above, and fifty state governments below it. |
| `U4-S06` | `heading` | The size of the job decides the level of government. |
| `U4-S06` | `example` | The United States declares war; California issues your driver's license. Each level, its own size of job. |
| `U4-S06` | `nonExample` | Imagine California printing its own money — dollars that stop working at the Nevada border. Or imagine Washington, D.C. trying to give every person in America a driver's license — one office, for 330 million people. |
| `U4-S06` | `takeaway` | Wrong-sized jobs fail. That is the whole logic. |
| `U4-S07` | `heading` | The trap to avoid. |
| `U4-S07` | `termA` | Federal — does not mean 'more important.' It means country-sized. |
| `U4-S07` | `termB` | State — handles what is close to home — your school, your police, your roads. |
| `U4-S07` | `resolution` | Your school and your police are state matters — and they matter. |
| `U4-S08` | `items[0].instructions` | Tap to sort each power into Federal or State. |
| `U4-S08` | `items[0].sortItems` | Print money \| Give a driver's license \| Declare war \| Schools \| Make treaties \| Police |
| `U4-S08` | `items[0].buckets` | Federal \| State |
| `U4-S08` | `items[1].question` | Name one power that is only for the federal government. Remember the handle: one voice to the world. **⚠ keep the quoted official question in English**; translate only the words around it |
| `U4-S08` | `items[1].options` | Make treaties with other countries \| Approve zoning for a new building \| Issue driver's licenses |
| `U4-S08` | `items[2].question` | A city decides what can be built on an empty lot. Which level is that — and which word from this lesson names it? |
| `U4-S08` | `items[2].options` | State — and the word is zoning \| Federal — and the word is treaty \| Federal — and the word is zoning |
| `U4-S08` | `items[3].question` | The officer asks this. What does 'your state' tell you about the answer? |
| `U4-S08` | `items[3].options` | The answer depends on where you live — for you, Sacramento \| The answer is the same for everyone — Washington, D.C. \| The answer is a reason, not a place |
| `U4-S13` | `heading` | Lesson 4 finished. |
| `U4-S13` | `learnedLine` | You learned the ideas behind all 5 questions in this lesson, and practiced 3 of them. |

### U5 — Rights and responsibilities

**37 fields.**

| Screen | Field | English |
|---|---|---|
| `U5-S01` | `unitLabel` | Unit 5 |
| `U5-S01` | `heading` | Rights and responsibilities |
| `U5-S01` | `body` | The officer will ask what citizens can do and must do — questions like: |
| `U5-S01` | `afterQuote` | This lesson will help you answer those questions. |
| `U5-S01` | `coverageLine` | It covers 10 of the 128 on the test. |
| `U5-S01` | `afterTest` | And this lesson is different from every other one: it is about you. These are the rights you will hold and the promises you will make. |
| `U5-S02` | `question` | Which of these belongs to everyone living in America — citizen or not? |
| `U5-S02` | `feedback` | Freedom of speech belongs to everyone here. Voting belongs to citizens. That line — everyone vs. citizens — is the key to this whole lesson. |
| `U5-S03` | `bodyList` | Joining any organization changes your standing. \| A guest at a community center is welcome and safe — but members vote at the meetings, and members pay the dues. \| Belonging brings both: a louder voice, and real duties. |
| `U5-S03` | `bodyList2` | Citizenship works the same way. \| Living in America already gives you strong protections. |
| `U5-S03` | `closing` | Becoming a citizen adds the member's voice — and the member's promises. |
| `U5-S04` | `cards` | right: a freedom the law protects for you. — “You have the right to speak freely.” \| responsibility: a duty — something you must or should do. — “Paying taxes is a responsibility.” \| jury: a group of citizens who decide a court case. — “Citizens serve on a jury.” \| oath: an official, serious promise. — “At your cere… |
| `U5-S05` | `paragraphs` | Remember the Bill of Rights from the rulebook lesson — protections for people living in the United States, not only citizens. \| Everyone here holds these: freedom of speech, freedom of expression, freedom of assembly (gathering in groups), freedom to petition the government (asking it to change something), freedom of … |
| `U5-S05` | `resolution` | The full story of that widening is Lesson 7. |
| `U5-S05` | `handle` | Everyone here holds rights. Citizens hold the vote. |
| `U5-S06` | `paragraphs` | Belonging also asks. \| Everyone who earns money here pays federal taxes — required by law, and it is how the country pays for what it does. Men aged 18 through 25 register for the Selective Service — a list, required by law, that makes a draft fair if one is ever needed. \| And at your ceremony, you will stand and tak… |
| `U5-S06` | `handle` | Rights and responsibilities are two halves of one standing. |
| `U5-S07` | `heading` | Rights protect you now. The member's voice comes at the ceremony. |
| `U5-S07` | `example` | A permanent resident writes a letter to a newspaper criticizing a law — fully protected, citizen or not. The same person cannot yet vote on that law. |
| `U5-S07` | `nonExample` | 'Rights are things I get; responsibilities are optional.' No — they are two halves of one standing. The same oath that gives you the ballot asks for your loyalty. |
| `U5-S07` | `takeaway` | Rights: yes, today. The member's voice: at the ceremony. |
| `U5-S08` | `heading` | Two words on the test sound alike. Do not mix them up. |
| `U5-S08` | `termA` | A right — something the law protects for you — speech, religion, assembly. |
| `U5-S08` | `termB` | A responsibility — something the law or the community expects from you — taxes, jury service. |
| `U5-S08` | `resolution` | Voting is special — it is a right you hold and a responsibility worth exercising. |
| `U5-S09` | `items[0].instructions` | Tap to sort each one into Everyone here or Citizens only. |
| `U5-S09` | `items[0].sortItems` | Freedom of speech \| Vote in federal elections \| Freedom of religion \| Serve on a jury \| Run for federal office \| Freedom of assembly |
| `U5-S09` | `items[0].buckets` | Everyone here \| Citizens only |
| `U5-S09` | `items[1].question` | What is one way Americans can serve their country? Many answers are accepted — pick one of them. **⚠ keep the quoted official question in English**; translate only the words around it |
| `U5-S09` | `items[1].options` | Pay taxes \| Travel to other countries \| Buy American products only |
| `U5-S09` | `items[2].question` | Why do men aged 18–25 register for Selective Service when there is no draft? |
| `U5-S09` | `items[2].options` | So that a draft, if ever needed, would be fair \| Because they must join the military \| Because it is required to vote |
| `U5-S09` | `items[3].question` | The officer asks this. The question tells you the count — what should you do? |
| `U5-S09` | `items[3].options` | Give two, then stop — extra answers only add chances for mistakes \| Give as many as you can remember \| Give one, because any one is enough |
| `U5-S15` | `feedbackExplain` | “Naturalize” is the door you are walking through yourself. |
| `U5-S16` | `heading` | Lesson 5 finished. |
| `U5-S16` | `learnedLine` | You learned the ideas behind all 10 questions in this lesson, and practiced 5 of them. |

### U6 — How America began

**35 fields.**

| Screen | Field | English |
|---|---|---|
| `U6-S01` | `unitLabel` | Unit 6 |
| `U6-S01` | `heading` | How America began |
| `U6-S01` | `body` | The officer will ask how the country began — questions like: |
| `U6-S01` | `afterQuote` | This lesson will help you answer those questions. |
| `U6-S01` | `coverageLine` | It covers 17 of the 128 on the test. |
| `U6-S01` | `afterTest` | History can feel like a long list of names and dates to remember. Here it is one story — and the answers are part of it. |
| `U6-S02` | `question` | Imagine your paycheck is taxed by people you never chose, meeting in a room you may not enter, an ocean away. You may not vote for them or against them. What would you do? |
| `U6-S02` | `feedback` | Thirteen colonies faced exactly that. Their answer created the United States — and it explains almost every question in this lesson. |
| `U6-S03` | `bodyList` | You already know the ending of this story. \| In Lesson 1 you learned what the founders built — a rulebook born from the fear of kings. |
| `U6-S03` | `bodyList2` | This lesson is how they got there: who was here first, who came and why, what broke, and what they built from the pieces. |
| `U6-S03` | `closing` | One story, three chapters. |
| `U6-S04` | `cards` | colony: a settlement ruled by a faraway country. — “The thirteen colonies were ruled by Britain.” \| independence: being free — ruling yourself. — “The colonies declared independence in 1776.” \| revolution: a fight to change who rules. — “The American Revolution won independence from Britain.” \| declare: to say offic… |
| `U6-S05` | `paragraphs` | Chapter 1 — Before. \| American Indians — Native Americans — lived on this land first, for thousands of years, in many nations: Cherokee, Navajo, Sioux, and hundreds more. \| Then ships came from Europe. The colonists came for reasons you will recognize: freedom — religious freedom, political liberty — economic opportu… |
| `U6-S05` | `resolution` | Their story does not end here — it returns in the next lesson, at the center of the country's greatest test. |
| `U6-S05` | `alt` | A colonial American settlement on a coastline, with wooden houses and a sailing ship anchored offshore. |
| `U6-S06` | `paragraphs` | Chapter 2 — The break. \| The thirteen colonies were ruled by Britain, and Britain taxed them — the Stamp Act, the Tea Act — while giving them no vote and no voice in the decisions. The colonists gave their complaint a name that still rings: taxation without representation. Protest grew — the Boston Tea Party — and pro… |
| `U6-S06` | `resolution` | The colonies were free. Now they had to become a country. |
| `U6-S06` | `alt` | The signing of the Declaration of Independence: men in eighteenth-century dress gathered around a desk in a meeting hall. |
| `U6-S07` | `paragraphs` | Chapter 3 — The build. \| The colonies were free — but they were struggling. The first loose arrangement between the states (the Articles of Confederation) proved too weak to work. So in 1787, the states sent their best minds to Philadelphia and wrote the Constitution — the rulebook you know, born from the two fears yo… |
| `U6-S07` | `handle` | 1776 declares. 1787 designs. |
| `U6-S07` | `handleSub` | You have now seen both dates from inside the story. |
| `U6-S08` | `heading` | The pattern to hold: six steps, one direction. |
| `U6-S08` | `example` | The colonists had no voice, so they protested. Protest became war. In 1776 they declared independence. They won the war. In 1787 they designed the Constitution. |
| `U6-S08` | `nonExample` | The Declaration did not create the government — it announced freedom. The Constitution did not declare independence — it wrote the rules for a working government. Eleven years and a war stand between them. |
| `U6-S08` | `takeaway` | If a question mentions free from Britain — Declaration. If it mentions government, law, or 1787 — Constitution. |
| `U6-S09` | `items[0].instructions` | Tap these four events into the order they happened. |
| `U6-S09` | `items[0].orderItems` | Colonies ruled by Britain \| Declaration of Independence (1776) \| Revolutionary War is won \| Constitution is written (1787) |
| `U6-S09` | `items[1].question` | Why did 'taxation without representation' anger the colonists? |
| `U6-S09` | `items[1].options` | They were taxed by a government they had no vote in \| The taxes were the highest in the world \| Britain refused to trade with them |
| `U6-S09` | `items[2].question` | Benjamin Franklin is famous for many things. Name one. **⚠ keep the quoted official question in English**; translate only the words around it |
| `U6-S09` | `items[2].options` | Founded the first free public libraries \| First president of the United States \| Led the Union during the Civil War **⚠ KEEP ENGLISH** — these restate accepted answers |
| `U6-S09` | `items[3].question` | Same document, two different first words. Which pair of answers is right? |
| `U6-S09` | `items[3].options` | Who wants a person — Jefferson. When wants a date — July 4, 1776 \| Who wants a date — July 4, 1776. When wants a person — Jefferson \| Both want the same answer — the Declaration of Independence |
| `U6-S17` | `heading` | Lesson 6 finished. |
| `U6-S17` | `learnedLine` | You learned the ideas behind all 17 questions in this lesson, and practiced 6 of them. |

### U7 — How America changed

**47 fields.**

| Screen | Field | English |
|---|---|---|
| `U7-S01` | `unitLabel` | Unit 7 |
| `U7-S01` | `heading` | How America changed |
| `U7-S01` | `body` | The last lesson — and the biggest. The officer will ask about everything from the Civil War to the flag on the courthouse: |
| `U7-S01` | `afterQuote` | One thread ties them together: the promise of 1776 — all people are created equal — being slowly, painfully kept. |
| `U7-S01` | `coverageLine` | It covers 39 of the 128 on the test. |
| `U7-S01` | `afterTest` | That promise is why your naturalization is possible. This is the story of how it grew. |
| `U7-S02` | `question` | In 1860, millions of people in America were enslaved — in the same country whose founding document said all people are created equal. A country cannot hold both forever. What happened? |
| `U7-S02` | `feedback` | The country split and fought — the Civil War. What followed is the story of a promise finally being kept, one amendment at a time. |
| `U7-S03` | `bodyList` | You know the founding story: a country built on a promise it was not yet keeping. \| And you know the tool for change — the amendment, from Lesson 1. |
| `U7-S03` | `bodyList2` | This lesson is what happens when a country uses that tool on itself, again and again, until the promise reaches more and more people. |
| `U7-S03` | `closing` | It ends with you: your citizenship will rest on one of these amendments. |
| `U7-S04` | `cards` | slavery: owning people as property — forced work without freedom. — “The Civil War ended slavery.” \| union: the states together as one country. — “Lincoln saved the Union.” \| discrimination: treating people unfairly because of their group. — “The civil rights movement fought discrimination.” \| communism: a system wh… |
| `U7-S05` | `paragraphs` | Chapter 1 — The war over the promise. \| First, the country grew: in 1803 the United States bought the Louisiana Territory from France, doubling its size — Jefferson's doing. But growth sharpened the question the founders had left open: slavery. The North and the South finally went to war over it — the Civil War, the w… |
| `U7-S05` | `resolution` | Lincoln was assassinated days after the fighting ended: the 16th president, remembered above all as the man who freed the slaves and preserved the Union. |
| `U7-S05` | `alt` | Union and Confederate soldiers facing each other across an open field during the Civil War. |
| `U7-S06` | `paragraphs` | Chapter 2 — The promise, written into the rulebook. \| After the war, the amendment tool went to work. The 14th Amendment wrote a new promise into the rulebook: all persons born or naturalized in the United States are U.S. citizens. Read that twice — or naturalized. Your certificate, when you receive it, will rest on t… |
| `U7-S06` | `handle` | The promise of 1776, extended by amendment and by movement, decade after decade. |
| `U7-S06` | `handleSub` | To any race, to women, to the discriminated-against — and through the 14th Amendment, to you. |
| `U7-S07` | `paragraphs` | Chapter 3 — America in the world. \| The 1900s took America into the world, and the test asks why each time — so learn the reasons, not just the names. \| World War I. Germany attacked American ships. The United States entered the war. \| The Great Depression began in 1929 when the stock market crashed. It was the long… |
| `U7-S08` | `paragraphs` | Chapter 4 — The symbols you will stand under. \| At your ceremony there will be a flag. Read it like a sentence: 13 stripes — the 13 original colonies, from the founding story. 50 stars — one for each state, from the growing story. \| The capital: Washington, D.C. The Statue of Liberty stands in New York Harbor — for m… |
| `U7-S08` | `resolution` | For 'name three national holidays,' keep three you already live with: New Year's Day, Independence Day, Thanksgiving. |
| `U7-S08` | `alt` | The United States flag with its thirteen stripes and fifty stars, and the Statue of Liberty standing in the harbour behind it. |
| `U7-S09` | `heading` | These are not 39 separate facts. |
| `U7-S09` | `example` | In 1776, America made a promise. The Civil War forced the country to face that promise. Amendments wrote it into law. Movements like the civil rights movement pushed until the law was real. And the 14th Amendment — the one that says born or naturalized — is how that promise reaches you. |
| `U7-S09` | `nonExample` | Almost every 'why' question in this lesson has one of three answers. America was keeping its promise — the Civil War, the amendments, civil rights. America was attacked — the ships in World War I, Pearl Harbor, September 11. America was stopping communism — Korea, Vietnam, the Cold War. |
| `U7-S09` | `takeaway` | One thread, three reasons. That is the whole lesson. |
| `U7-S10` | `heading` | Two holidays on the test sound alike. Do not mix them up. |
| `U7-S10` | `termA` | Memorial Day — honors soldiers who died in military service. |
| `U7-S10` | `termB` | Veterans Day — honors all who served in the military. |
| `U7-S10` | `resolution` | Everyone who died in service was also a veteran — but not every veteran died. Memorial Day is for the ones who did not come home. |
| `U7-S11` | `heading` | Two amendments about voting. Keep them in order. |
| `U7-S11` | `termA` | 15th Amendment — any race can vote — 1870, after the Civil War. |
| `U7-S11` | `termB` | 19th Amendment — women can vote — 1920, after World War I. |
| `U7-S11` | `resolution` | Race first, women fifty years later. |
| `U7-S12` | `items[0].instructions` | Tap these four events into the order they happened. |
| `U7-S12` | `items[0].orderItems` | Civil War \| 15th Amendment (any race votes) \| 19th Amendment (women vote) \| Civil rights movement |
| `U7-S12` | `items[1].instructions` | Tap to sort each into the holiday it describes. |
| `U7-S12` | `items[1].sortItems` | Honors soldiers who died \| Honors all who served |
| `U7-S12` | `items[1].buckets` | Memorial Day \| Veterans Day |
| `U7-S12` | `items[2].question` | Korea and Vietnam have the same test answer. What is it? |
| `U7-S12` | `items[2].options` | To stop the spread of communism \| To defend Pearl Harbor \| To free Kuwait **⚠ KEEP ENGLISH** — these restate accepted answers |
| `U7-S12` | `items[3].question` | Every 'Why did the United States enter…' question wants a reason — and this lesson gave you only three. Match World War II to its reason. |
| `U7-S12` | `items[3].options` | America was attacked — Pearl Harbor \| America was stopping communism \| America was keeping its promise |
| `U7-S16` | `feedbackExplain` | Read the 14th Amendment twice: all persons born “or naturalized” in the United States. Those two words are what your certificate will rest on. |
| `U7-S20` | `feedbackExplain` | The question asks for three. Give three and stop — extra answers only add chances for a mistake. |
| `U7-S21` | `heading` | Lesson 7 finished. |
| `U7-S21` | `learnedLine` | You have now seen the ideas behind all 128 questions. |
