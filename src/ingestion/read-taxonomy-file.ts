import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import readExcelFile from "read-excel-file/node";
import type { ValidationIssue } from "../domain/validation-issue.ts";
import {
  parseTaxonomyRows,
  parseTaxonomySheet,
  type TaxonomyParseOptions,
  type TaxonomyParseResult,
} from "./parse-taxonomy.ts";

export interface TaxonomyFileOptions extends TaxonomyParseOptions {
  readonly sheet?: string;
}

/** Node-only file adapter; the Foundry bundle does not include the Excel reader. */
export async function readTaxonomyFile(
  path: string,
  options: TaxonomyFileOptions,
): Promise<TaxonomyParseResult> {
  try {
    const extension = extname(path).toLowerCase();
    if (extension !== ".xlsx" && extension !== ".csv" && extension !== ".tsv")
      return failure(
        "input",
        "Expected an .xlsx, .csv, or .tsv taxonomy file.",
      );
    if (extension !== ".xlsx") {
      if (options.sheet !== undefined)
        return failure(
          "sheet",
          "Worksheet selection applies only to .xlsx files.",
        );
      return parseTaxonomySheet(await readFile(path, "utf8"), {
        ...options,
        delimiter: extension === ".csv" ? "," : "\t",
      });
    }
    const sheets = await readExcelFile(await readFile(path), { trim: false });
    const selected =
      options.sheet === undefined
        ? sheets.length === 1
          ? sheets[0]
          : sheets.find((sheet) => sheet.sheet === "Taxonomy")
        : sheets.find((sheet) => sheet.sheet === options.sheet);
    if (!selected)
      return failure(
        "sheet",
        options.sheet === undefined
          ? "Workbook has multiple worksheets and no Taxonomy worksheet; select one with --sheet."
          : `Worksheet "${options.sheet}" was not found. Available worksheets: ${sheets.map((sheet) => sheet.sheet).join(", ")}.`,
      );
    const prefix = `sheets[${JSON.stringify(selected.sheet)}]`;
    const issues: ValidationIssue[] = [];
    const header = [...(selected.data[0] ?? [])];
    // Spreadsheet readers pad sparse cells; only trailing empty header cells are ignored.
    while (
      header.length > 0 &&
      (header.at(-1) === null || header.at(-1) === "")
    )
      header.pop();
    const rows = selected.data.map((row, index) => {
      const values = index === 0 ? header : row;
      const cells: string[] = [];
      for (
        let column = 0;
        column < Math.max(header.length, values.length);
        column++
      ) {
        const value: unknown = values[column];
        if (
          column >= header.length &&
          (value === null || value === undefined || value === "")
        )
          continue;
        if (value === null || value === undefined) cells.push("");
        else if (typeof value === "string") cells.push(value);
        else {
          issues.push({
            path: `${prefix}.rows[${String(index + 1)}].columns[${String(column + 1)}]`,
            message:
              "Expected a text cell. Store taxonomy columns as text to preserve their exact values.",
          });
          cells.push("");
        }
      }
      return { row: index + 1, cells };
    });
    if (issues.length > 0) return { success: false, issues };
    const result = parseTaxonomyRows(rows, options);
    return result.success
      ? result
      : {
          success: false,
          issues: result.issues.map((issue) => ({
            ...issue,
            path: `${prefix}.${issue.path}`,
          })),
        };
  } catch (error) {
    return failure(
      "input",
      error instanceof Error ? error.message : String(error),
    );
  }
}

function failure(path: string, message: string): TaxonomyParseResult {
  return { success: false, issues: [{ path, message }] };
}
