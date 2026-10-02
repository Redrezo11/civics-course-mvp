#!/usr/bin/env node
/**
 * official-gloss-sheet.js — the review sheet for the official-question Burmese.
 *
 *   node scripts/official-gloss-sheet.js
 *
 * Writes docs/translations/official-glosses-review.csv: one row per official
 * question, answer option and accepted answer, in question order, with the
 * drafted Burmese and an empty column for a reviewer's correction. Opens in
 * Excel or Google Sheets (UTF-8 with a byte-order mark, which is what makes
 * Excel read Myanmar script instead of mojibake).
 *
 * Each English string appears once, under the first question that uses it —
 * the gloss is keyed by the English, so correcting it once corrects it
 * everywhere it appears.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const content = join(root, 'src', 'lib', 'content');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const questions = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7']
  .flatMap((u) => readJson(join(content, `questions-${u}.json`)))
  .sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
const { glosses } = readJson(join(content, 'translations', 'official-glosses-my.json'));

const csv = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
const rows = [['Question', 'Type', 'English (do not change)', 'Burmese (draft)', 'Corrected Burmese', 'Notes']];
const seen = new Set();

for (const q of questions) {
  const accepted = new Set(q.acceptedAnswers || []);
  const entries = [
    [q.official, 'question'],
    ...(q.dynamic
      ? []
      : [...new Set([...(q.options || []), ...(q.acceptedAnswers || [])])].map((s) => [
          s,
          accepted.has(s) ? 'accepted answer' : 'wrong option',
        ])),
  ];
  for (const [en, type] of entries) {
    if (seen.has(en)) continue;
    seen.add(en);
    rows.push([q.id, type, en, glosses[en] || '', '', '']);
  }
}

const out = join(root, 'docs', 'translations', 'official-glosses-review.csv');
writeFileSync(out, '﻿' + rows.map((r) => r.map(csv).join(',')).join('\r\n') + '\r\n', 'utf8');
console.log(`${out.replace(root, '.')} — ${rows.length - 1} rows`);
