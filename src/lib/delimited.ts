/**
 * Delimited-file parsing.
 *
 * Written by hand rather than pulled from a library because the rules that
 * matter here are small and specific: quoted fields containing the delimiter,
 * doubled quotes as an escape, CRLF from Excel, and a UTF-8 BOM that would
 * otherwise become part of the first column's name.
 *
 * It lives in `lib` with no server-only import so the import wizard can parse
 * a file in the browser for its preview and the import service can re-parse
 * the same bytes on the server. The server's parse is the one that counts.
 */

export interface DelimitedFile {
  columns: string[];
  rows: string[][];
}

export function parseDelimited(text: string): DelimitedFile {
  const clean = text.replace(/^﻿/, '');
  const delimiter = detectDelimiter(clean);

  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < clean.length; index += 1) {
    const char = clean[index];

    if (quoted) {
      if (char === '"') {
        if (clean[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        value += char ?? '';
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(value);
      value = '';
    } else if (char === '\n') {
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
    } else if (char !== '\r') {
      value += char ?? '';
    }
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  const header = rows.shift() ?? [];
  const columns = header.map((name, index) => name.trim() || `column_${index + 1}`);

  // Blank trailing lines are an artifact of the file, not data.
  const body = rows.filter((entry) => entry.some((cell) => cell.trim().length > 0));

  return { columns, rows: body };
}

function detectDelimiter(text: string): string {
  const newline = text.indexOf('\n');
  const firstLine = text.slice(0, newline === -1 ? text.length : newline);

  let best = ',';
  let bestCount = 0;

  for (const candidate of [',', ';', '\t']) {
    const count = firstLine.split(candidate).length - 1;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }

  return best;
}

/** Turn parsed rows into objects keyed by column name. */
export function toRowObjects(file: DelimitedFile): Array<Record<string, string>> {
  return file.rows.map((row) => {
    const entry: Record<string, string> = {};
    file.columns.forEach((column, index) => {
      entry[column] = (row[index] ?? '').trim();
    });
    return entry;
  });
}
