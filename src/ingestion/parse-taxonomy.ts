import { artifactCodeDefinitions } from "../domain/artifact-catalog.ts";
import type { AdaptationConfig } from "../domain/model.ts";
import { parseAssetReferences } from "../domain/parse-asset-references.ts";
import { parseAdaptationConfigJson } from "../domain/parse-serialized-config.ts";
import { parseTaxonomyId } from "../domain/taxonomy-id.ts";
import type { ValidationIssue } from "../domain/validation-issue.ts";
import { parseDelimitedSheet, type SheetRow } from "./parse-delimited.ts";
import { parseSoundMetadata } from "./parse-sound-metadata.ts";

export interface TaxonomyParseOptions {
  readonly campaign: string;
  readonly title: string;
  readonly delimiter?: "\t" | ",";
  readonly dataset?: string;
  /** Explicit owners override index-based journal/playlist ownership. */
  readonly owners?: Readonly<Record<string, string>>;
  readonly journalOwnership?: "index" | "explicit";
  readonly normalizeMarkdownRole?: boolean;
}

export type TaxonomyParseResult =
  | {
      readonly success: true;
      readonly config: AdaptationConfig;
      readonly json: string;
    }
  | { readonly success: false; readonly issues: readonly ValidationIssue[] };

const requiredHeaders = [
  "Taxonomy ID",
  "Campaign",
  "Taxonomy Code",
  "Index",
  "Artifact Name",
];
const optionalHeaders = [
  "Asset Path",
  "Container Path",
  "Chapter",
  "Part",
  "Metadata",
  "Dataset",
];

/** Converts a spreadsheet export into the unchanged adaptation import contract. */
export function parseTaxonomySheet(
  input: string,
  options: TaxonomyParseOptions,
): TaxonomyParseResult {
  const parsed = parseDelimitedSheet(input, options.delimiter ?? "\t");
  if (!parsed.success) return parsed;
  return parseTaxonomyRows(parsed.rows, options);
}

/** Shared mapping boundary for worksheet adapters; row numbers are source lines. */
export function parseTaxonomyRows(
  rows: readonly SheetRow[],
  options: TaxonomyParseOptions,
): TaxonomyParseResult {
  const issues: ValidationIssue[] = [];
  const header = rows[0];
  if (!header)
    return {
      success: false,
      issues: [{ path: "header", message: "Missing taxonomy header row." }],
    };
  const headers = header.cells.map((cell) => cell.trim());
  const known = new Set([...requiredHeaders, ...optionalHeaders]);
  for (const name of requiredHeaders) {
    if (!headers.includes(name))
      issues.push({
        path: "header",
        message: `Missing required column "${name}".`,
      });
  }
  for (const [index, name] of headers.entries()) {
    if (!known.has(name))
      issues.push({
        path: `header[${String(index + 1)}]`,
        message: `Unknown column "${name}".`,
      });
    if (headers.indexOf(name) !== index)
      issues.push({ path: "header", message: `Duplicate column "${name}".` });
  }
  if (options.dataset !== undefined && !headers.includes("Dataset")) {
    issues.push({
      path: "header",
      message: "Dataset filtering requires the Dataset column.",
    });
  }
  if (issues.length > 0) return { success: false, issues };
  const artifacts: Record<string, unknown>[] = [];
  const sourceRows: number[] = [];
  for (const row of rows.slice(1)) {
    if (row.cells.every((cell) => cell.trim() === "")) continue;
    const path = `rows[${String(row.row)}]`;
    if (row.cells.length !== headers.length) {
      issues.push({
        path,
        message: `Expected ${String(headers.length)} cells; received ${String(row.cells.length)}.`,
      });
      continue;
    }
    const raw = (name: string) => row.cells[headers.indexOf(name)] ?? "";
    const value = (name: string) => raw(name).trim();
    if (options.dataset !== undefined && value("Dataset") !== options.dataset)
      continue;
    const start = issues.length;
    for (const name of requiredHeaders) {
      if (!value(name))
        issues.push({
          path: `${path}.${name}`,
          message: "Expected a nonblank string.",
        });
    }
    let id;
    try {
      id = parseTaxonomyId(value("Taxonomy ID"));
    } catch (error) {
      issues.push({ path: `${path}.Taxonomy ID`, message: messageOf(error) });
      continue;
    }
    for (const [column, expected] of [
      ["Campaign", id.campaign],
      ["Taxonomy Code", id.artifactCode],
      ["Index", id.index.join(".")],
    ]) {
      if (value(column ?? "") !== expected)
        issues.push({
          path: `${path}.${column ?? ""}`,
          message: `Value must match taxonomy ID (${expected ?? ""}).`,
        });
    }
    let assets;
    try {
      assets = parseAssetReferences(raw("Asset Path"));
    } catch (error) {
      issues.push({ path: `${path}.Asset Path`, message: messageOf(error) });
      continue;
    }
    if (options.normalizeMarkdownRole !== false && id.artifactCode === "JPG") {
      assets = assets.map((asset) =>
        asset.role === "markdown" ? { ...asset, role: "content" } : asset,
      );
    }
    const soundMetadata =
      id.artifactCode === "AUD"
        ? parseSoundMetadata(raw("Metadata"), `${path}.Metadata`, issues)
        : {};
    if (value("Metadata") && id.artifactCode !== "AUD")
      issues.push({
        path: `${path}.Metadata`,
        message:
          "Free-form Metadata has no mapping in the import contract; move required values into supported columns.",
      });
    if (issues.length !== start) continue;
    const metadata = {
      ...Object.fromEntries<string>(
        (
          [
            ["containerPath", value("Container Path")],
            ["chapter", value("Chapter")],
            ["part", value("Part")],
          ] satisfies [string, string][]
        ).filter(([, entry]) => entry),
      ),
      ...soundMetadata,
    };
    artifacts.push({
      kind: artifactCodeDefinitions[id.artifactCode].kind,
      taxonomyId: id.value,
      name: value("Artifact Name"),
      ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
      ...(assets.length > 0 ? { assets } : {}),
      ...(id.artifactCode === "JPG" ? { markdown: "" } : {}),
      ...(id.artifactCode === "AUD"
        ? { source: assets.find((asset) => asset.role === "audio")?.path ?? "" }
        : {}),
    });
    sourceRows.push(row.row);
  }
  // Resolve against the whole selected sheet so source row order has no meaning.
  for (const [index, artifact] of artifacts.entries()) {
    if (artifact.kind !== "journalPage" && artifact.kind !== "playlistSound")
      continue;
    const id = parseTaxonomyId(String(artifact.taxonomyId));
    const ownerCode = artifact.kind === "journalPage" ? "JRN" : "PLY";
    let owner = options.owners?.[id.value];
    if (
      owner === undefined &&
      (artifact.kind === "playlistSound" ||
        options.journalOwnership !== "explicit")
    ) {
      const prefix = id.index.slice(0, 3).join(".");
      const exact = `${id.campaign}-${ownerCode}-${prefix}.00`;
      const exactMatches = artifacts.filter(
        (entry) => entry.taxonomyId === exact,
      );
      if (exactMatches.length === 1) owner = exact;
      if (exactMatches.length === 0 && artifact.kind === "journalPage") {
        const candidates = artifacts.filter((entry) => {
          const candidate = parseTaxonomyId(String(entry.taxonomyId));
          return (
            candidate.campaign === id.campaign &&
            candidate.artifactCode === "JRN" &&
            candidate.index.slice(0, 2).join(".") ===
              id.index.slice(0, 2).join(".")
          );
        });
        if (candidates.length === 1) owner = String(candidates[0]?.taxonomyId);
      }
    }
    const field = artifact.kind === "journalPage" ? "journal" : "playlist";
    if (!owner)
      issues.push({
        path: `rows[${String(sourceRows[index])}].${field}`,
        message: `Missing or ambiguous ${ownerCode} owner; supply an explicit owner mapping.`,
      });
    else artifact[field] = { taxonomyId: owner };
  }
  const result = parseAdaptationConfigJson(
    JSON.stringify({
      campaign: options.campaign,
      title: options.title,
      artifacts,
    }),
  );
  if (!result.success) {
    issues.push(
      ...result.issues.map((issue) => ({
        ...issue,
        path: issue.path.replace(
          /^artifacts\[(\d+)\]/,
          (_, index: string) => `rows[${String(sourceRows[Number(index)])}]`,
        ),
      })),
    );
  }
  if (issues.length > 0 || !result.success) return { success: false, issues };
  return {
    success: true,
    config: result.config,
    json: JSON.stringify(result.config, null, 2) + "\n",
  };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
