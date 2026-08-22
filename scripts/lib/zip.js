// zip.js — write a ZIP archive, correctly, with no dependency.
//
// WHY THIS EXISTS RATHER THAN Compress-Archive.
//
// PowerShell 5.1 — which is what ships with Windows — writes archive entries
// with BACKSLASH separators: `au\index.html` instead of `au/index.html`. The
// ZIP appnote requires forward slashes. Many extractors are forgiving; Java's
// ZipInputStream is not, and reads that entry as a single root-level file whose
// name happens to contain backslashes. A cmi5 package extracted that way has no
// `au/` directory at all, so the AU has nothing to launch — and the LMS reports
// it as a bad package without saying why.
//
// That is a whole upload-and-debug cycle spent on a path separator. Node has
// had `zlib.crc32` since v22 and `deflateRawSync` forever, and the parts of the
// ZIP format needed to write one are three fixed-layout records, so the archive
// is built here instead. It is also deterministic, which Compress-Archive
// is not.
//
// Deliberately minimal: no zip64, no encryption, no unicode path extra field.
// A cmi5 package is a few dozen ASCII-named files well under 4 GB.

import { deflateRawSync, crc32 } from 'node:zlib';
import { writeFileSync, readFileSync } from 'node:fs';

const DEFLATE = 8;
const STORE = 0;

/** DOS timestamp. Fixed, so the same input produces the same archive bytes. */
const DOS_TIME = 0x0000; // 00:00:00
const DOS_DATE = 0x2821; // 1 January 2000

function localHeader(entry) {
  const name = Buffer.from(entry.name, 'utf8');
  const head = Buffer.alloc(30);
  head.writeUInt32LE(0x04034b50, 0); // signature
  head.writeUInt16LE(20, 4); // version needed
  head.writeUInt16LE(0, 6); // flags
  head.writeUInt16LE(entry.method, 8);
  head.writeUInt16LE(DOS_TIME, 10);
  head.writeUInt16LE(DOS_DATE, 12);
  head.writeUInt32LE(entry.crc, 14);
  head.writeUInt32LE(entry.compressed.length, 18);
  head.writeUInt32LE(entry.size, 22);
  head.writeUInt16LE(name.length, 26);
  head.writeUInt16LE(0, 28); // extra field length
  return Buffer.concat([head, name]);
}

function centralHeader(entry) {
  const name = Buffer.from(entry.name, 'utf8');
  const head = Buffer.alloc(46);
  head.writeUInt32LE(0x02014b50, 0);
  head.writeUInt16LE(20, 4); // version made by
  head.writeUInt16LE(20, 6); // version needed
  head.writeUInt16LE(0, 8);
  head.writeUInt16LE(entry.method, 10);
  head.writeUInt16LE(DOS_TIME, 12);
  head.writeUInt16LE(DOS_DATE, 14);
  head.writeUInt32LE(entry.crc, 16);
  head.writeUInt32LE(entry.compressed.length, 20);
  head.writeUInt32LE(entry.size, 24);
  head.writeUInt16LE(name.length, 28);
  head.writeUInt16LE(0, 30); // extra
  head.writeUInt16LE(0, 32); // comment
  head.writeUInt16LE(0, 34); // disk number
  head.writeUInt16LE(0, 36); // internal attrs
  head.writeUInt32LE(0, 38); // external attrs
  head.writeUInt32LE(entry.offset, 42);
  return Buffer.concat([head, name]);
}

/**
 * Write `files` — `[{ name, data }]` — to `zipPath`.
 *
 * `name` is the path inside the archive and MUST use forward slashes; the whole
 * point of this module is that it does, so it is asserted rather than silently
 * corrected. A caller building a name from `path.join()` on Windows will get
 * backslashes and should be told, not quietly patched.
 */
export function writeZip(zipPath, files) {
  const bad = files.filter((f) => f.name.includes('\\'));
  if (bad.length) {
    throw new Error(
      `zip entry names must use forward slashes: ${bad.map((f) => f.name).join(', ')}`
    );
  }

  const chunks = [];
  const entries = [];
  let offset = 0;

  for (const { name, data } of files) {
    const compressed = deflateRawSync(data, { level: 9 });
    // Storing beats deflating for anything already compressed — WebP, woff2 —
    // where the deflate pass costs time and adds bytes.
    const useDeflate = compressed.length < data.length;
    const entry = {
      name,
      size: data.length,
      crc: crc32(data),
      method: useDeflate ? DEFLATE : STORE,
      compressed: useDeflate ? compressed : data,
      offset,
    };
    const header = localHeader(entry);
    chunks.push(header, entry.compressed);
    offset += header.length + entry.compressed.length;
    entries.push(entry);
  }

  const central = entries.map(centralHeader);
  const centralSize = central.reduce((n, b) => n + b.length, 0);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4); // disk
  end.writeUInt16LE(0, 6); // disk with central dir
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20); // comment length

  writeFileSync(zipPath, Buffer.concat([...chunks, ...central, end]));
  return entries.map((e) => ({ name: e.name, size: e.size, stored: e.compressed.length }));
}

/**
 * Entry names, read back out of a written archive's central directory.
 *
 * Verifying the archive rather than the folder it was built from is the whole
 * lesson of the backslash bug: a check against the staging directory passed
 * while the zip itself was malformed. This reads what an LMS would read.
 */
export function readZipEntryNames(zipPath) {
  const buf = readFileSync(zipPath);

  // End-of-central-directory sits at the tail, after a comment of unknown
  // length, so it is found by scanning backwards for the signature.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error(`${zipPath} has no end-of-central-directory record`);

  const count = buf.readUInt16LE(eocd + 10);
  let at = buf.readUInt32LE(eocd + 16);
  const names = [];
  for (let i = 0; i < count; i += 1) {
    if (buf.readUInt32LE(at) !== 0x02014b50) throw new Error('corrupt central directory');
    const nameLen = buf.readUInt16LE(at + 28);
    const extraLen = buf.readUInt16LE(at + 30);
    const commentLen = buf.readUInt16LE(at + 32);
    names.push(buf.toString('utf8', at + 46, at + 46 + nameLen));
    at += 46 + nameLen + extraLen + commentLen;
  }
  return names;
}
