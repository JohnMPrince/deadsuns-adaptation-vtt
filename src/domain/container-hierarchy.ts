import type { ArtifactKind } from "./artifact-catalog.ts";
import type { AdaptationConfig } from "./model.ts";
import type { ValidationIssue } from "./validate-config.ts";

/** Logical categories, with no dependency on Foundry classes. */
export type ContainerCategory = Exclude<
  ArtifactKind,
  "journalPage" | "playlistSound"
>;

export interface ResolvedContainer {
  readonly category: ContainerCategory;
  readonly path: string;
  readonly name: string;
  readonly parentPath?: string;
}

/** Slash-separated, case-sensitive names. Accept one optional trailing slash. */
export function parseContainerPath(path: string): readonly string[] {
  const segments = (path.endsWith("/") ? path.slice(0, -1) : path).split("/");
  if (
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment.trim() !== segment ||
        segment === "." ||
        segment === ".." ||
        segment.includes("\\") ||
        hasControlCharacter(segment),
    )
  ) {
    throw new Error(
      "Container paths require nonblank slash-separated names without surrounding whitespace, dot segments, backslashes, or control characters.",
    );
  }
  return segments;
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

export function validateContainers(
  config: AdaptationConfig,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const [index, artifact] of config.artifacts.entries()) {
    const value = artifact.metadata?.containerPath;
    if (value === undefined) continue;
    const path = `artifacts[${String(index)}].metadata.containerPath`;
    let normalized;
    try {
      normalized = parseContainerPath(value).join("/");
    } catch (error) {
      issues.push({
        path,
        message: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
    if (artifact.kind === "journalPage" || artifact.kind === "playlistSound") {
      const parentId =
        artifact.kind === "journalPage"
          ? artifact.journal.taxonomyId
          : artifact.playlist.taxonomyId;
      const parent = config.artifacts.find(
        (candidate) => candidate.taxonomyId === parentId,
      );
      const parentPath = parent?.metadata?.containerPath;
      // Missing/incorrect parent references are reported by validateConfig.
      if (!parent) continue;
      let normalizedParent;
      try {
        normalizedParent =
          parentPath === undefined
            ? undefined
            : parseContainerPath(parentPath).join("/");
      } catch {
        continue;
      }
      if (normalized !== normalizedParent) {
        issues.push({
          path,
          message:
            "Embedded artifacts inherit their owner's container path; an explicit path must match the owner's path.",
        });
      }
    }
  }
  return issues;
}

/** Desired containers for the future importer, including undeclared parents. */
export function resolveContainerHierarchy(
  config: AdaptationConfig,
): readonly ResolvedContainer[] {
  const issues = validateContainers(config);
  if (issues.length)
    throw new Error(
      issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"),
    );
  const resolved = new Map<string, ResolvedContainer>();
  for (const artifact of config.artifacts) {
    if (artifact.kind === "journalPage" || artifact.kind === "playlistSound")
      continue;
    const value = artifact.metadata?.containerPath;
    if (value === undefined) continue;
    let parentPath: string | undefined;
    for (const name of parseContainerPath(value)) {
      const path: string =
        parentPath === undefined ? name : `${parentPath}/${name}`;
      const key = JSON.stringify([artifact.kind, path]);
      if (!resolved.has(key)) {
        resolved.set(key, {
          category: artifact.kind,
          path,
          name,
          ...(parentPath === undefined ? {} : { parentPath }),
        });
      }
      parentPath = path;
    }
  }
  return [...resolved.values()];
}
