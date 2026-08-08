# Burmese delivery — notes

**Delivered:** 241 of 264 content fields, plus all 5 outstanding interface strings.
**Status:** `draft-unreviewed`. Machine-drafted Burmese, not native-reviewed. Safe to build against; not safe to show learners until a bilingual reviewer has passed over it.

**Files** — drop into `docs/translations/`:

| File | Fields |
|---|---|
| `unit0.json` | 11 |
| `unit1.json` | 21 |
| `unit2.json` | 36 |
| `unit3.json` | 33 |
| `unit4.json` | 33 |
| `unit5.json` | 34 |
| `unit6.json` | 31 |
| `unit7.json` | 42 |
| `ui-strings-patch.json` | 5 interface strings (merge `my` only) |

Every list field returns the same item count as the English. Verified programmatically, not by eye.

---

## The 23 fields not delivered

**Cause: the English source is truncated inside `TRANSLATION-REQUEST.md` itself.** The generator clips long values with `…` for table display, so for these fields the request shows an opening fragment and nothing else. They are not skipped, refused, or overlooked — the text to translate was not in the file.

| Unit | Field |
|---|---|
| U1 | `U1-S05.paragraphs` · `U1-S06b.paragraphs` |
| U2 | `U2-S04.cards` · `U2-S05.paragraphs` · `U2-S06.paragraphs` |
| U3 | `U3-S03.bodyList` · `U3-S04.cards` · `U3-S05.paragraphs` · `U3-S06.paragraphs` |
| U4 | `U4-S04.cards` · `U4-S05.paragraphs` |
| U5 | `U5-S04.cards` · `U5-S05.paragraphs` · `U5-S06.paragraphs` |
| U6 | `U6-S04.cards` · `U6-S05.paragraphs` · `U6-S06.paragraphs` · `U6-S07.paragraphs` |
| U7 | `U7-S04.cards` · `U7-S05.paragraphs` · `U7-S06.paragraphs` · `U7-S07.paragraphs` · `U7-S08.paragraphs` |

The pattern is exact: every `cards` set and every multi-paragraph `paragraphs` field. These are the longest values in the course, which is why they clipped.

**To unblock:** regenerate the request without value truncation, or emit a companion `translation-source.json` carrying full untruncated English keyed the same way. The second is more robust — a JSON payload has no display width to clip against, and it removes the markdown-table parse from the loop entirely. `U1-S05` and `U1-S06b` are worth noting separately: the build's prose there has diverged from Storyboard v5.3, so the storyboard cannot be used as a substitute source.

---

## Decisions applied

**Never-translate rule, honoured.** No official question wording, accepted answer, or `options` value from `questions-u1.json`…`questions-u7.json` appears anywhere in these files.

**The three ⚠ rows delivered** keep their quoted official sentence in English and translate only the surrounding words:

- `U4-S08.items[1].question` — keeps *Name one power that is only for the federal government.*
- `U5-S09.items[1].question` — keeps *What is one way Americans can serve their country?*
- `U6-S09.items[2].question` — keeps *Benjamin Franklin is famous for many things. Name one.*

**The two ⚠ KEEP ENGLISH option sets are returned verbatim in English**, untouched: `U6-S09.items[2].options` and `U7-S12.items[2].options`. They are present in the files rather than omitted so the build receives a complete set and does not fall back.

**Official terms carry an English + Burmese gloss** rather than being translated away, in one specific place: sort-bucket labels and option text that restates an accepted answer — `Senate (အထက်လွှတ်တော်)`, `Memorial Day`, `15th Amendment`, `Federal (ဖက်ဒရယ်)`. These were unflagged by the generator, so translating them was permitted, but a learner who only ever meets `အထက်လွှတ်တော်` will not recognise *Senate* when an officer says it. The gloss form teaches the Burmese meaning while keeping the English form in front of the learner. **If the build prefers these fully translated, say so and they will be changed — this is the one place I departed from the plain reading of the request.**

**`U1-S11`–`S15` feedback** drops the "The correct answer is X." opening sentence as instructed; only the explanation is returned.

**`U1-S07b` termA/termB** are split into `name` and `def` objects as instructed. Everything else follows the flat `screen → field` shape from §3.

---

## Transfer integrity

Burmese is 3 bytes per character with two bytes in the C1 range, which is what destroyed the earlier attempts. **Download these files; do not paste their contents.** Verify after transfer:

| File | sha256 (first 12) | Myanmar chars |
|---|---|---|
| `unit0.json` | `a3115d30b956` | 1076 |
| `unit1.json` | `4ce62f9baba8` | 2301 |
| `unit2.json` | `400bfd60de3c` | 3693 |
| `unit3.json` | `67b33da1f039` | 2903 |
| `unit4.json` | `a3d03a0b296b` | 2816 |
| `unit5.json` | `959bd184bf99` | 3253 |
| `unit6.json` | `fda1dbeb387e` | 3013 |
| `unit7.json` | `c525511af6a4` | 4043 |
| `ui-strings-patch.json` | `8529ae31f6fb` | 221 |

If a file arrives with a lower Myanmar character count than listed, the consonants were stripped in transit and the file must be re-fetched rather than repaired.
