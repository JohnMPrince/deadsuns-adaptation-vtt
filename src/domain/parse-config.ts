import type { ArtifactKind } from "./artifact-catalog.ts";
import type { AdaptationConfig } from "./model.ts";
import type { ValidationIssue } from "./validation-issue.ts";

export type AdaptationConfigParseResult =
  | { readonly success: true; readonly config: AdaptationConfig }
  | { readonly success: false; readonly issues: readonly ValidationIssue[] };

const artifactKinds = new Set<ArtifactKind>([
  "actor",
  "scene",
  "journal",
  "journalPage",
  "handout",
  "item",
  "rollTable",
  "playlist",
  "playlistSound",
  "macro",
]);

/** Safely checks configuration data before it enters the typed domain model. */
export function parseAdaptationConfig(
  input: unknown,
): AdaptationConfigParseResult {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) {
    return failure("configuration", "Expected an object.");
  }

  requireNonblankString(input, "campaign", "campaign", issues);
  requireNonblankString(input, "title", "title", issues);

  if (!Array.isArray(input.artifacts)) {
    issues.push({ path: "artifacts", message: "Expected an array." });
  } else {
    input.artifacts.forEach((artifact, index) => {
      inspectArtifact(artifact, `artifacts[${String(index)}]`, issues);
    });
  }

  return issues.length > 0
    ? { success: false, issues }
    : { success: true, config: input as unknown as AdaptationConfig };
}

function inspectArtifact(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  if (!isRecord(value)) {
    issues.push({ path, message: "Expected an object." });
    return;
  }

  const kind = value.kind;
  if (typeof kind !== "string" || !artifactKinds.has(kind as ArtifactKind)) {
    issues.push({
      path: `${path}.kind`,
      message:
        typeof kind === "string"
          ? `Unsupported artifact kind "${kind}".`
          : "Expected a supported artifact kind.",
    });
  }
  requireNonblankString(value, "taxonomyId", `${path}.taxonomyId`, issues);
  requireNonblankString(value, "name", `${path}.name`, issues);
  inspectOptionalMetadata(value.metadata, `${path}.metadata`, issues);
  inspectOptionalStringArray(value.tags, `${path}.tags`, issues);

  switch (kind) {
    case "scene":
      inspectOptionalString(value, "background", `${path}.background`, issues);
      inspectOptionalReferences(value.actors, `${path}.actors`, issues);
      inspectOptionalReferences(value.journals, `${path}.journals`, issues);
      break;
    case "journalPage":
      inspectReference(value.journal, `${path}.journal`, issues);
      requireString(value, "markdown", `${path}.markdown`, issues);
      break;
    case "playlistSound":
      inspectReference(value.playlist, `${path}.playlist`, issues);
      requireNonblankString(value, "source", `${path}.source`, issues);
      break;
  }
}

function inspectOptionalMetadata(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  if (value === undefined) return;
  if (!isRecord(value)) {
    issues.push({ path, message: "Expected an object." });
    return;
  }
  for (const key of ["containerPath", "chapter", "part", "dataset"] as const) {
    inspectOptionalString(value, key, `${path}.${key}`, issues);
  }
}

function inspectOptionalStringArray(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    issues.push({ path, message: "Expected an array of strings." });
    return;
  }
  value.forEach((entry, index) => {
    if (typeof entry !== "string") {
      issues.push({
        path: `${path}[${String(index)}]`,
        message: "Expected a string.",
      });
    }
  });
}

function inspectOptionalReferences(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    issues.push({ path, message: "Expected an array of artifact references." });
    return;
  }
  value.forEach((reference, index) => {
    inspectReference(reference, `${path}[${String(index)}]`, issues);
  });
}

function inspectReference(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  if (!isRecord(value)) {
    issues.push({ path, message: "Expected an artifact reference object." });
    return;
  }
  requireNonblankString(value, "taxonomyId", `${path}.taxonomyId`, issues);
}

function requireNonblankString(
  value: Readonly<Record<string, unknown>>,
  key: string,
  path: string,
  issues: ValidationIssue[],
): void {
  const entry = value[key];
  if (typeof entry !== "string" || entry.trim().length === 0) {
    issues.push({ path, message: "Expected a nonblank string." });
  }
}

function requireString(
  value: Readonly<Record<string, unknown>>,
  key: string,
  path: string,
  issues: ValidationIssue[],
): void {
  if (typeof value[key] !== "string") {
    issues.push({ path, message: "Expected a string." });
  }
}

function inspectOptionalString(
  value: Readonly<Record<string, unknown>>,
  key: string,
  path: string,
  issues: ValidationIssue[],
): void {
  const entry = value[key];
  if (entry !== undefined && typeof entry !== "string") {
    issues.push({ path, message: "Expected a string." });
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function failure(path: string, message: string): AdaptationConfigParseResult {
  return { success: false, issues: [{ path, message }] };
}
