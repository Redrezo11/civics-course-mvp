// Extracts learner-visible strings from every .svelte file, so the
// translation inventory is generated from source rather than typed by hand.
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2] || 'src';

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.svelte$/.test(e.name) ? [p] : [];
  });
}

const result = {};
let total = 0;

for (const file of walk(ROOT).sort()) {
  const text = fs.readFileSync(file, 'utf8');

  // THE SCRIPT BLOCK IS SCANNED TOO, AND USED NOT TO BE.
  //
  // This said "Drop the <script> block and HTML comments: neither is
  // learner-visible", which is true of comments and false of script. Help.svelte
  // held its entire FAQ — six questions and six answers — in a plain array
  // there, and so did the unit titles in Home, FullBank and QuestionBank. All
  // of it rendered to the learner; none of it could be seen by this tool, so
  // a sweep that reported "every learner-visible string is accounted for" was
  // reporting on a file it had already thrown half of away.
  //
  // Comments really are not learner-visible, so those still go — including the
  // long explanatory ones in the script, which would otherwise flood the
  // inventory with prose nobody can read on screen.
  const scriptBlocks = [...text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1])
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  const body = text
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  const found = new Set();

  // Prose held in a script-block literal. Deliberately strict: a string only
  // counts if it reads like a sentence — two or more words, at least one of
  // them long — so class lists, keys, ids and paths do not flood the list.
  for (const m of scriptBlocks.matchAll(/'([^'\n]{12,})'|"([^"\n]{12,})"|`([^`\n${]{12,})`/g)) {
    const s = (m[1] || m[2] || m[3]).trim();
    if (!s || /^[.#/]|^https?:/.test(s)) continue;
    if (/^[a-z0-9\-:_[\]/. ]+$/.test(s)) continue; // class list / path / key
    if (!/[A-Za-z]{3,}\s+\S/.test(s)) continue; // needs at least two words
    found.add(`[script] ${s}`);
  }

  // 1. Text nodes between tags. Interpolations are collapsed to a placeholder
  // FIRST — otherwise a sentence like "The correct answer is {x}." is skipped
  // entirely, and most learner-facing sentences in this app contain one.
  const flat = body.replace(/\{[^{}]*\}/g, '⟨…⟩');
  for (const m of flat.matchAll(/>([^<>]*[A-Za-z]{3}[^<>]*)</g)) {
    const s = m[1].replace(/\s+/g, ' ').trim();
    if (s.length > 2 && /[a-z]/i.test(s) && !/^[0-9\s.,:%–—-]+$/.test(s)) found.add(s);
  }

  // A Tailwind class list in a ternary is not learner-facing text. Classes are
  // all-lowercase tokens and at least one carries a '-' or ':' modifier.
  const isClassList = (s) =>
    /^[a-z0-9!:_\-[\]/.\s]+$/.test(s) && /[-:]/.test(s) && !/[.?!,]$/.test(s);

  // 2. Literal strings inside template expressions (ternaries, fallbacks).
  for (const m of body.matchAll(/'([^'\n]{6,})'/g)) {
    const s = m[1].trim();
    if (/[a-z]/i.test(s) && !/^[.#\w-]+$/.test(s) && !s.includes('/') && !isClassList(s)) {
      found.add(s);
    }
  }
  for (const m of body.matchAll(/`([^`\n$]{6,})`/g)) {
    const s = m[1].trim();
    if (/[a-z]/i.test(s)) found.add(s);
  }

  // 3. Attributes a screen reader or user reads.
  for (const m of body.matchAll(/(?:placeholder|aria-label)="([^"{}]{4,})"/g)) {
    found.add(`[attr] ${m[1]}`);
  }

  if (found.size) {
    const rel = file.split(path.sep).join('/');
    result[rel] = [...found].sort();
    total += found.size;
  }
}

if (process.argv.includes('--markdown')) {
  for (const [file, strings] of Object.entries(result)) {
    console.log(`\n#### \`${file}\` — ${strings.length}\n`);
    for (const s of strings) console.log(`- ${s.replace(/\|/g, '\\|')}`);
  }
  console.log(`\n**Total: ${total} strings across ${Object.keys(result).length} files.**`);
} else {
  for (const [file, strings] of Object.entries(result)) {
    console.log(String(strings.length).padStart(4), file);
  }
  console.log('\nTOTAL:', total, 'strings in', Object.keys(result).length, 'files');
}
