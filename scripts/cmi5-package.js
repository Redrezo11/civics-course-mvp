#!/usr/bin/env node
/**
 * cmi5-package.js — build the importable package.
 *
 *   node scripts/cmi5-package.js
 *   node scripts/cmi5-package.js --ns https://your.domain/civics-mvp   # optional: own the ids
 *
 * Produces packages/civics-course-cmi5.zip:
 *
 *   cmi5.xml          ← at the ROOT. An LMS looks for it there and nowhere else
 *   au/               ← the built app
 *     index.html
 *     assets/  images/  audio/  favicon.svg  icons.svg
 *
 * The layout above is not a preference. A package whose manifest is one
 * directory down imports as a broken file with no useful error, so this script
 * prints the archive listing at the end and you can see cmi5.xml sitting at the
 * top of it.
 *
 * NO NEW DEPENDENCY. The archive is written by scripts/lib/zip.js, which exists
 * because PowerShell 5.1's Compress-Archive writes entry names with backslashes
 * — `au\index.html` — and a Java-based extractor reads that as one root-level
 * file rather than a directory, leaving the AU with nothing to launch. See the
 * note at the top of that file.
 *
 * Output is gitignored: the zip is a build artefact of a build artefact, it is
 * about a megabyte and a half, and committing it would mean re-uploading the
 * whole course on every content change.
 */

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { writeZip, readZipEntryNames } from './lib/zip.js';
import { xmlProblems } from './lib/xml-check.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const NS = arg('--ns', null);
const name = arg('--name', 'civics-course-cmi5');

const staging = join(root, 'dist-cmi5');
const outDir = join(root, 'packages');
const zipPath = join(outDir, `${name}.zip`);

// Everything is run as `node <script>` rather than through npm.
//
// npm on Windows is npm.cmd, which recent Node refuses to spawn without a shell
// (EINVAL), and passing shell:true deprecation-warns because the arguments are
// concatenated rather than escaped. Vite has a Node entry point, so there is no
// reason to involve a shell at all.
const run = (script, args = []) =>
  execFileSync(process.execPath, [script, ...args], { cwd: root, stdio: 'inherit' });

const VITE = join(root, 'node_modules', 'vite', 'bin', 'vite.js');

console.log('\ncmi5 package\n');

// --- 1. Build -----------------------------------------------------------------

console.log('  building…');
run(VITE, ['build']);

const dist = join(root, 'dist');
if (!existsSync(join(dist, 'index.html'))) {
  console.error('\n  ! dist/index.html is missing — the build did not produce an app\n');
  process.exit(1);
}

// --- 2. Stage -----------------------------------------------------------------

rmSync(staging, { recursive: true, force: true });
mkdirSync(join(staging, 'au'), { recursive: true });
cpSync(dist, join(staging, 'au'), { recursive: true });

// The manifest is written straight into the staging root rather than copied
// from docs/, so the packaged manifest is generated with the namespace this
// package was built for and cannot be a stale copy of a different one.
run(join(root, 'scripts', 'cmi5-manifest.js'), [
  ...(NS ? ['--ns', NS] : []),
  '--out',
  join(staging, 'cmi5.xml'),
]);

// --- 3. Zip -------------------------------------------------------------------

// Collected with explicit forward slashes rather than path.join, because on
// Windows join gives backslashes and those are exactly what must not reach the
// archive. zip.js throws rather than correcting them.
const files = [];
(function walk(dir, prefix) {
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name)
  )) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, `${prefix}${entry.name}/`);
    else files.push({ name: `${prefix}${entry.name}`, data: readFileSync(full) });
  }
})(staging, '');

mkdirSync(outDir, { recursive: true });
rmSync(zipPath, { force: true });
const written = writeZip(zipPath, files);

// --- 4. Verify the ARCHIVE, not the folder it was made from -------------------

// Reading the central directory back is the only check that means anything.
// Asserting against the staging folder would have passed while the archive
// itself was malformed, which is how the backslash bug survived its first pass.
const entryNames = readZipEntryNames(zipPath);

const total = files.reduce((n, f) => n + f.data.length, 0);
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

console.log(`\n  ${zipPath.replace(root, '.')}  (${kb(statSync(zipPath).size)} compressed, ${kb(total)} of files)\n`);
for (const { name, size } of written.slice(0, 8)) console.log(`    ${name.padEnd(46)} ${kb(size)}`);
if (written.length > 8) console.log(`    … and ${written.length - 8} more files`);

const manifestAtRoot = entryNames.includes('cmi5.xml');
const appAtAu = entryNames.includes('au/index.html');
const anyBackslash = entryNames.filter((n) => n.includes('\\'));

// The manifest is checked again HERE, on the copy that is actually in the zip.
// The generator checks its own output, but this is the file an LMS parses, and
// the two have been different before — the archive had backslash paths while
// the folder it came from did not.
const packagedManifest = files.find((f) => f.name === 'cmi5.xml');
const manifestProblems = packagedManifest
  ? xmlProblems(packagedManifest.data.toString('utf8'))
  : ['no cmi5.xml in the archive'];

console.log(`\n  read back from the archive itself:`);
console.log(`    cmi5.xml at the root          ${manifestAtRoot ? 'yes' : 'NO — the import will fail'}`);
console.log(`    au/index.html present         ${appAtAu ? 'yes' : 'NO — the AU has nothing to launch'}`);
console.log(`    forward-slash paths           ${anyBackslash.length ? `NO — ${anyBackslash.length} bad entries` : 'yes'}`);
console.log(`    manifest is well-formed XML   ${manifestProblems.length ? 'NO' : 'yes'}`);
for (const p of manifestProblems) console.log(`      ${p}`);

if (!manifestAtRoot || !appAtAu || anyBackslash.length || manifestProblems.length) process.exit(1);

if (!NS) {
  console.log(
    '\n  Built with the default namespace (a fixed urn:uuid — see scripts/cmi5-manifest.js).\n' +
      '    That is fine to ship as-is: it identifies nothing but this course and does not\n' +
      '    depend on any domain or host. Pass --ns only if you specifically want ids under\n' +
      '    a domain you control instead. Either way, once learners have started, keep\n' +
      '    rebuilding with the SAME namespace — changing it orphans every record filed\n' +
      '    against the old one.'
  );
}

console.log(
  '\n  Import: TalentLMS → Courses → Edit → Add → Learning Activities →\n' +
    '          SCORM | xAPI | cmi5 → upload this zip.\n' +
    '\n  This package has never been launched in a real LMS. See docs/CMI5-PACKAGE.md\n' +
    '  for what that means and what to watch for on the first run.\n'
);
