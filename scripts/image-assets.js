#!/usr/bin/env node
/**
 * image-assets.js — reconcile the artwork with the slots the course defines.
 *
 *   node scripts/image-assets.js     (npm run images)
 *
 * Writes:
 *   src/lib/content/image-manifest.json  what the app reads to tell a filled
 *                                        slot from one still waiting
 *   docs/IMAGE-ASSETS.md                 the map, and the request for the next
 *                                        batch
 *
 * Generated for the same reason as the audio map: a hand-kept list of what is
 * still missing goes stale the first time a screen changes, and then somebody
 * commissions the wrong picture.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const contentDir = join(root, 'src', 'lib', 'content');
const imageDir = join(root, 'public', 'images');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const UNITS = ['unit0', 'unit1', 'unit2', 'unit3', 'unit4', 'unit5', 'unit6', 'unit7'];

/**
 * Intrinsic dimensions, read from the file itself.
 *
 * The shape of an image is a fact about the file, and it used to be stated at
 * the call site instead — so a 512×512 portrait went into a 16:9 box and lost
 * 44% of its height, with the img declaring 960×540 and reserving the wrong
 * space before it even loaded. Recording the real size here means a caller
 * cannot state the wrong one, because it no longer states one at all.
 */
function webpDimensions(buf) {
  if (buf.length < 30 || buf.toString('ascii', 0, 4) !== 'RIFF') return null;
  const format = buf.toString('ascii', 12, 16);
  if (format === 'VP8X') return [buf.readUIntLE(24, 3) + 1, buf.readUIntLE(27, 3) + 1];
  if (format === 'VP8L') {
    const n = buf.readUInt32LE(21);
    return [(n & 0x3fff) + 1, ((n >> 14) & 0x3fff) + 1];
  }
  if (format === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  return null;
}

/**
 * Slots defined outside unit page data. Completion asks for a ceremony
 * photograph in its own markup rather than in JSON.
 */
const STANDALONE = [
  {
    screen: 'Completion',
    unit: 'Course completion',
    image: 'naturalization-ceremony-close.webp',
    alt: 'New citizens at a naturalization ceremony, smiling and waving small United States flags.',
  },
  {
    screen: 'Welcome',
    unit: 'Companion character',
    image: 'companion-welcome.webp',
    alt: '',
    decorative: true,
  },
  {
    screen: 'Rehearsal intro',
    unit: 'Companion character',
    image: 'companion-speaking.webp',
    alt: '',
    decorative: true,
  },
];

/**
 * Known problems with delivered files, recorded here so they are visible in the
 * map every time it is regenerated rather than remembered by one person.
 *
 * Keyed by filename, so replacing a file with a clean version and re-running
 * this script is all it takes to clear one.
 */
const FLAGGED = {
  'voting.webp':
    'Carries a visible "© Frame Stock Footage/Shutterstock.com" watermark — a comp preview rather than a licensed download. Replacing the file with the licensed version needs no code change; the content references it by name.',
  'civil-rights-march.webp':
    'A well-known press photograph of the civil rights movement. Confirm it is licensed for publication before this ships anywhere public.',
  'statue-of-liberty.webp':
    'A portrait photograph padded to 16:9 with blurred fill, so roughly a third of the frame is blur. A landscape crop would fill the slot properly.',
  'three-government-buildings.webp':
    'Unused. Three photographs composited into one frame, each letterboxed with blurred fill. U2-S05 uses the three clean singles instead.',
  'constitution-page-1.webp':
    'The heading reads correctly, but the cursive body text is an approximation rather than the real wording — and at 146 KB it is two and a half times the next largest file, for a parchment texture.',
};

// --- Every slot the course defines ------------------------------------------

function slots() {
  const out = [];
  for (const file of UNITS) {
    const unit = readJson(join(contentDir, `${file}.json`));
    const where = `${unit.id} — ${unit.title}`;
    for (const s of unit.screens) {
      // companionPose has been authored on hook and lock-it-in screens since
      // they were written, and read by nothing. The filename derives from it,
      // which is why these slots never appeared in this map — and therefore
      // why the artwork was never requested.
      if (s.companionPose) {
        out.push({
          screen: s.id,
          unit: 'Companion character',
          image: `companion-${s.companionPose}.webp`,
          alt: '',
          decorative: true,
        });
      }
      if (s.diagram) {
        out.push({ screen: s.id, unit: where, image: `${s.diagram} (drawn)`, alt: '', drawn: true });
      }
      if (s.image) out.push({ screen: s.id, unit: where, image: s.image, alt: s.alt || '', decorative: s.decorative });
      for (const pic of s.imageRow || []) {
        out.push({ screen: s.id, unit: where, image: pic.image, alt: pic.alt || '', row: true });
      }
      for (const col of s.twoColumn || []) {
        if (col.image) out.push({ screen: s.id, unit: where, image: col.image, alt: col.alt || '', column: true });
      }
    }
  }
  return [...out, ...STANDALONE];
}

const onDisk = existsSync(imageDir)
  ? readdirSync(imageDir).filter((n) => /\.(webp|png|jpg|jpeg|avif)$/i.test(n))
  : [];

const all = slots();
for (const slot of all) slot.have = slot.drawn || onDisk.includes(slot.image);

const filled = all.filter((s) => s.have);
const missing = all.filter((s) => !s.have);
const used = new Set(filled.map((s) => s.image));
const unused = onDisk.filter((n) => !used.has(n));

// --- Write -------------------------------------------------------------------

const dimensions = {};
for (const name of [...onDisk].sort()) {
  const d = webpDimensions(readFileSync(join(imageDir, name)));
  if (!d) {
    console.error(`  ! could not read dimensions from ${name} — the renderer cannot size it`);
    process.exitCode = 1;
    continue;
  }
  dimensions[name] = d;
}

writeFileSync(
  join(contentDir, 'image-manifest.json'),
  `${JSON.stringify(
    {
      _note:
        'GENERATED by scripts/image-assets.js from public/images/. Each entry is [width, height] read from the file itself, so the renderer sizes a picture from the picture rather than from whatever a call site guessed. A slot whose file is absent keeps its placeholder, which states what it is waiting for rather than rendering a broken image.',
      images: dimensions,
    },
    null,
    2
  )}\n`
);

const byUnit = {};
for (const s of all) (byUnit[s.unit] ||= []).push(s);

const kb = (name) => {
  try {
    return `${(readFileSync(join(imageDir, name)).length / 1024).toFixed(0)} KB`;
  } catch {
    return '—';
  }
};

let sections = '';
for (const [unit, list] of Object.entries(byUnit)) {
  sections += `\n### ${unit}\n\n| | Screen | File | Size | Alt text |\n|---|---|---|---|---|\n`;
  for (const s of list) {
    const mark = s.drawn ? '◆' : s.have ? '●' : '○';
    const kind = s.row ? ' (row)' : s.column ? ' (column)' : s.decorative ? ' (decorative)' : '';
    sections += `| ${mark} | \`${s.screen}\`${kind} | \`${s.image}\` | ${s.have ? kb(s.image) : '—'} | ${s.alt.replace(/\|/g, '\\|')} |\n`;
  }
}

const flaggedRows = Object.entries(FLAGGED)
  .filter(([name]) => onDisk.includes(name))
  .map(([name, why]) => `| \`${name}\` | ${why} |`)
  .join('\n');

const totalKb = onDisk.reduce((n, f) => n + readFileSync(join(imageDir, f)).length, 0) / 1024;

const doc = `# Image assets — what is placed, and what is still needed

**Generated** by \`npm run images\`. Regenerate after adding or renaming a file,
or after changing a screen's image — do not edit this file.

\`●\` in place · \`◆\` drawn in code, no file needed · \`○\` slot defined, no file yet

**${filled.length} of ${all.length} slots filled.** ${onDisk.length} files on disk, ${totalKb.toFixed(0)} KB total.

---

## Naming

\`\`\`
public/images/<name>.webp
\`\`\`

The content references images by filename, so the name is the contract. **Case
must match exactly** — GitHub Pages is case-sensitive and Windows is not, so
\`US-Capitol.webp\` would work on the machine that made it and 404 for every
learner. QA check 18 fails on any reference that does not resolve.

Files are 960×540. That is the \`aspect-video\` box the screens draw, and the
right pixel count for the 448px column at 2× device pixel ratio — no resizing
needed. Images are lazy-loaded, so a learner pays only for screens they reach.

Replacing a file is a drop-in: same name, no code change, then \`npm run images\`.

---

## Flagged files
${
  flaggedRows
    ? `\n| File | Note |\n|---|---|\n${flaggedRows}\n`
    : '\nNothing flagged.\n'
}
---

## Still needed — ${missing.length} slot${missing.length === 1 ? '' : 's'}

${
  missing.length
    ? `| Screen | Wanted | What it should show |\n|---|---|---|\n${missing
        .map((s) => `| \`${s.screen}\` | \`${s.image}\` | ${(s.alt || 'no alt written yet').replace(/\|/g, '\\|')} |`)
        .join('\n')}\n\nThese screens keep their placeholder, which names the file it is waiting for.`
    : 'Every slot has a file.'
}

${
  unused.length
    ? `---\n\n## On disk but unplaced — ${unused.length}\n\n${unused.map((u) => `- \`${u}\` (${kb(u)})`).join('\n')}\n`
    : ''
}
---

## Every slot
${sections}`;

writeFileSync(join(root, 'docs', 'IMAGE-ASSETS.md'), doc, 'utf8');

console.log('\nImage assets\n');
console.log(`  ${filled.length} of ${all.length} slots filled · ${onDisk.length} files · ${totalKb.toFixed(0)} KB`);
for (const s of missing) console.log(`       ○ ${s.screen} wants ${s.image}`);
for (const u of unused) console.log(`       · ${u} is on disk but unplaced`);
for (const name of Object.keys(FLAGGED)) {
  if (onDisk.includes(name)) console.log(`       ! ${name} — see docs/IMAGE-ASSETS.md`);
}
console.log('\n  src/lib/content/image-manifest.json');
console.log('  docs/IMAGE-ASSETS.md\n');
