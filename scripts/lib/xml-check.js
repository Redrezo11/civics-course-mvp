// xml-check.js — is this string well-formed XML?
//
// WHY A GENERATED FILE NEEDS CHECKING AT ALL.
//
// scripts/cmi5-manifest.js escapes every value it interpolates, so the DATA was
// never the risk. The prose around it was. A comment in the generator's own
// template read:
//
//     Regenerate with a namespace you control: --ns https://your.domain/civics
//
// and `--` is forbidden inside an XML comment. That manifest was not well-formed
// XML, so any conforming parser — which an LMS importer certainly is — rejects
// the package outright, and the error it reports is about line 4 of a file
// nobody hand-wrote. One wasted upload cycle, minimum.
//
// Node has no XML parser and this project has no dependencies, so this is a
// scanner rather than a parser. It is not a general XML validator: it checks
// well-formedness for the subset a generator can emit — comments, declarations,
// elements, attributes and text. That is enough to catch anything this
// generator can do to itself, which is the actual threat.

/**
 * Returns a list of problems. Empty means well-formed as far as this can tell.
 */
export function xmlProblems(source) {
  const problems = [];
  const lineAt = (index) => source.slice(0, index).split('\n').length;

  const stack = [];
  let i = 0;

  while (i < source.length) {
    const lt = source.indexOf('<', i);

    // Text between elements: a bare < is impossible here (we just searched for
    // one), but a bare & is the classic way a generated file breaks.
    const text = source.slice(i, lt === -1 ? source.length : lt);
    for (const m of text.matchAll(/&(?!(#\d+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);)/g)) {
      problems.push(`line ${lineAt(i + m.index)}: unescaped "&" in text — write &amp;`);
    }
    if (lt === -1) break;

    if (source.startsWith('<!--', lt)) {
      const end = source.indexOf('-->', lt + 4);
      if (end === -1) {
        problems.push(`line ${lineAt(lt)}: comment is never closed`);
        break;
      }
      const body = source.slice(lt + 4, end);
      if (body.includes('--')) {
        problems.push(
          `line ${lineAt(lt)}: comment contains "--", which XML forbids — the whole document is ill-formed`
        );
      }
      if (body.endsWith('-')) {
        problems.push(`line ${lineAt(lt)}: comment body ends with "-", which XML forbids`);
      }
      i = end + 3;
      continue;
    }

    if (source.startsWith('<?', lt)) {
      const end = source.indexOf('?>', lt + 2);
      if (end === -1) {
        problems.push(`line ${lineAt(lt)}: processing instruction is never closed`);
        break;
      }
      i = end + 2;
      continue;
    }

    if (source.startsWith('<!', lt)) {
      const end = source.indexOf('>', lt);
      i = end === -1 ? source.length : end + 1;
      continue;
    }

    const end = source.indexOf('>', lt);
    if (end === -1) {
      problems.push(`line ${lineAt(lt)}: tag is never closed`);
      break;
    }
    const raw = source.slice(lt + 1, end);
    const selfClosing = raw.endsWith('/');
    const body = selfClosing ? raw.slice(0, -1) : raw;
    const closing = body.startsWith('/');
    const nameMatch = /^\/?\s*([A-Za-z_][\w.:-]*)/.exec(body);

    if (!nameMatch) {
      problems.push(`line ${lineAt(lt)}: "<${body.slice(0, 24)}" is not a tag name`);
    } else {
      const name = nameMatch[1];
      if (closing) {
        const open = stack.pop();
        if (open === undefined) {
          problems.push(`line ${lineAt(lt)}: </${name}> with nothing open`);
        } else if (open.name !== name) {
          problems.push(`line ${lineAt(lt)}: </${name}> closes <${open.name}> opened on line ${open.line}`);
        }
      } else {
        // Attribute values must be quoted, and must not contain a raw <.
        const attrs = body.slice(nameMatch[0].length);
        for (const m of attrs.matchAll(/([\w.:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
          if (m[4] !== undefined) {
            problems.push(`line ${lineAt(lt)}: attribute ${m[1]} is unquoted`);
          }
          const value = m[2] ?? m[3] ?? '';
          if (value.includes('<')) {
            problems.push(`line ${lineAt(lt)}: attribute ${m[1]} contains a raw "<"`);
          }
        }
        if (!selfClosing) stack.push({ name, line: lineAt(lt) });
      }
    }
    i = end + 1;
  }

  for (const open of stack) problems.push(`<${open.name}> opened on line ${open.line} is never closed`);
  return problems;
}

/** Throw unless `source` is well-formed. Used where a bad file must not ship. */
export function assertWellFormed(source, label = 'document') {
  const problems = xmlProblems(source);
  if (problems.length) {
    throw new Error(`${label} is not well-formed XML:\n  ${problems.join('\n  ')}`);
  }
}
