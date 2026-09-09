import type { AdaptationConfig } from "../domain/model.ts";
import type { TaxonomyId } from "../domain/taxonomy-id.ts";
import {
  validateConfig,
  type ValidationIssue,
} from "../domain/validate-config.ts";
import { fingerprintArtifact } from "./fingerprint.ts";

export type ImportAction = "create" | "update" | "unchanged" | "conflict";

export interface ExistingArtifactState {
  readonly taxonomyId: TaxonomyId;
  readonly foundryUuid: string;
  readonly importedFingerprint?: string;
  readonly documentFingerprint: string;
}

export interface ImportPlanEntry {
  readonly taxonomyId: TaxonomyId;
  readonly action: ImportAction;
  readonly desiredFingerprint: string;
  readonly foundryUuid?: string;
  readonly reason: string;
}

export interface ImportPlan {
  readonly entries: readonly ImportPlanEntry[];
  readonly counts: Readonly<Record<ImportAction, number>>;
}

export class InvalidAdaptationConfigError extends Error {
  public constructor(public readonly issues: readonly ValidationIssue[]) {
    super(
      `Adaptation configuration has ${String(issues.length)} validation issue(s).`,
    );
    this.name = "InvalidAdaptationConfigError";
  }
}

export async function planImport(
  config: AdaptationConfig,
  existingArtifacts: readonly ExistingArtifactState[],
): Promise<ImportPlan> {
  const issues = validateConfig(config);
  if (issues.length > 0) {
    throw new InvalidAdaptationConfigError(issues);
  }

  const existingByTaxonomyId = groupExistingArtifacts(existingArtifacts);
  const entries = await Promise.all(
    config.artifacts.map(async (artifact) => {
      const desiredFingerprint = await fingerprintArtifact(artifact);
      const existing = existingByTaxonomyId.get(artifact.taxonomyId) ?? [];
      return classifyArtifact(
        artifact.taxonomyId,
        desiredFingerprint,
        existing,
      );
    }),
  );

  return { entries, counts: countActions(entries) };
}

function classifyArtifact(
  taxonomyId: TaxonomyId,
  desiredFingerprint: string,
  existing: readonly ExistingArtifactState[],
): ImportPlanEntry {
  if (existing.length === 0) {
    return {
      taxonomyId,
      action: "create",
      desiredFingerprint,
      reason: "No Foundry artifact carries this taxonomy ID.",
    };
  }

  if (existing.length > 1) {
    return {
      taxonomyId,
      action: "conflict",
      desiredFingerprint,
      reason: "Multiple Foundry artifacts carry this taxonomy ID.",
    };
  }

  const [current] = existing;
  if (!current) {
    throw new Error("Expected one existing artifact.");
  }

  const common = {
    taxonomyId,
    desiredFingerprint,
    foundryUuid: current.foundryUuid,
  } as const;

  if (!current.importedFingerprint) {
    return {
      ...common,
      action: "conflict",
      reason: "The Foundry artifact has no prior import fingerprint.",
    };
  }

  const sourceChanged = desiredFingerprint !== current.importedFingerprint;
  const documentChanged =
    current.documentFingerprint !== current.importedFingerprint;

  if (!sourceChanged && !documentChanged) {
    return {
      ...common,
      action: "unchanged",
      reason: "Source and Foundry artifact are unchanged.",
    };
  }

  if (sourceChanged && !documentChanged) {
    return {
      ...common,
      action: "update",
      reason: "Only the source configuration changed.",
    };
  }

  return {
    ...common,
    action: "conflict",
    reason: sourceChanged
      ? "Both source configuration and Foundry artifact changed."
      : "The Foundry artifact changed after its last import.",
  };
}

function groupExistingArtifacts(
  existingArtifacts: readonly ExistingArtifactState[],
): ReadonlyMap<TaxonomyId, readonly ExistingArtifactState[]> {
  const groups = new Map<TaxonomyId, ExistingArtifactState[]>();
  for (const existing of existingArtifacts) {
    const group = groups.get(existing.taxonomyId) ?? [];
    group.push(existing);
    groups.set(existing.taxonomyId, group);
  }
  return groups;
}

function countActions(
  entries: readonly ImportPlanEntry[],
): Record<ImportAction, number> {
  const counts: Record<ImportAction, number> = {
    create: 0,
    update: 0,
    unchanged: 0,
    conflict: 0,
  };
  for (const entry of entries) {
    counts[entry.action] += 1;
  }
  return counts;
}
