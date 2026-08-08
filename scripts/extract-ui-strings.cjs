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
  // Drop the <script> block and HTML comments: neither is learner-visible.
  const body = text
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  const found = new Set();

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
