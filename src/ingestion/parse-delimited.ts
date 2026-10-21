import type { ValidationIssue } from "../domain/validation-issue.ts";

export interface SheetRow {
  readonly row: number;
  readonly cells: readonly string[];
}

export type DelimitedResult =
  | { readonly success: true; readonly rows: readonly SheetRow[] }
  | { readonly success: false; readonly issues: readonly ValidationIssue[] };

/** Reads CSV/TSV exports, including quoted cells containing line breaks. */
export function parseDelimitedSheet(
  input: string,
  delimiter: "\t" | ",",
): DelimitedResult {
  const rows: SheetRow[] = [];
  const text = input.replace(/^\uFEFF/, "");
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  // After a closing quote, only a separator, row ending, or EOF is permitted.
  let closed = false;
  let line = 1;
  // Keep the record's starting line even when a quoted cell spans several lines.
  let row = 1;
  const failure = (message: string): DelimitedResult => ({
    success: false,
    issues: [{ path: `rows[${String(row)}]`, message }],
  });
  for (let index = 0; index < text.length; index++) {
    const char = text.charAt(index);
    if (char === '"') {
      if (quoted) {
        if (text[index + 1] === '"') {
          // CSV/TSV escapes a literal quote by doubling it inside a quoted cell.
          cell += '"';
          index++;
        } else {
          quoted = false;
          closed = true;
        }
      } else if (cell.length === 0 && !closed) {
        quoted = true;
      } else {
        return failure("Unexpected quote in an unquoted cell.");
      }
    } else if (char === "\r" || char === "\n") {
      const newline = char === "\r" && text[index + 1] === "\n" ? "\r\n" : char;
      if (newline.length === 2) index++;
      line++;
      if (quoted) {
        // A quoted line break belongs to the cell, not to a new spreadsheet row.
        cell += newline;
      } else {
        cells.push(cell);
        rows.push({ row, cells });
        cells = [];
        cell = "";
        closed = false;
        row = line;
      }
    } else if (char === delimiter && !quoted) {
      cells.push(cell);
      cell = "";
      closed = false;
    } else {
      if (closed) return failure("Unexpected text after a quoted cell.");
      cell += char;
    }
  }
  if (quoted) return failure("Unterminated quoted cell.");
  if (cell.length > 0 || cells.length > 0 || closed) {
    cells.push(cell);
    rows.push({ row, cells });
  }
  return { success: true, rows };
}
