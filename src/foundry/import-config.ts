import {
  resolveContainerHierarchy,
  type ResolvedContainer,
} from "../import/container-hierarchy.ts";
import type { AdaptationConfig } from "../domain/model.ts";
import { fingerprintArtifactStructure } from "../import/fingerprint.ts";
import {
  planImport,
  type ExistingArtifactState,
  type ImportPlan,
} from "../import/plan-import.ts";
import {
  mapArtifactToFoundry,
  type MappedFoundryArtifact,
} from "./map-artifact.ts";

export interface FoundryImportGateway {
  listExistingArtifacts(): Promise<readonly ExistingArtifactState[]>;
  ensureContainer(container: ResolvedContainer): Promise<void>;
  createArtifact(artifact: MappedFoundryArtifact): Promise<void>;
  updateArtifactMetadata?(artifact: MappedFoundryArtifact): Promise<void>;
}

export interface ImportExecutionResult {
  readonly plan: ImportPlan;
  readonly created: number;
  readonly unchanged: number;
  readonly updated: number;
}

export async function importConfiguredAssets(
  config: AdaptationConfig,
  gateway: FoundryImportGateway,
): Promise<ImportExecutionResult> {
  const existing = await gateway.listExistingArtifacts();
  const plan = await planImport(config, existing);
  // Preflight every mapping before any container or document writes.
  const mapped = new Map<string, MappedFoundryArtifact>();
  for (const entry of plan.entries) {
    const artifact = config.artifacts.find(
      (value) => value.taxonomyId === entry.taxonomyId,
    );
    if (!artifact)
      throw new Error(`Missing planned artifact ${entry.taxonomyId}.`);
    const structure = await fingerprintArtifactStructure(artifact);
    const value = mapArtifactToFoundry(artifact, entry.desiredFingerprint);
    const flags = value.data.flags as Record<string, Record<string, unknown>>;
    mapped.set(entry.taxonomyId, {
      ...value,
      data: {
        ...value.data,
        flags: {
          ...flags,
          "deadsuns-adaptation-vtt": {
            ...flags["deadsuns-adaptation-vtt"],
            importedStructureFingerprint: structure,
            ...(artifact.kind === "playlistSound"
              ? {
                  importedSyrinscapeFields: Object.keys(
                    flags["syrinscape-control"] ?? {},
                  ),
                }
              : {}),
          },
        },
      },
    });
    if (
      entry.action === "update" &&
      (!gateway.updateArtifactMetadata ||
        existing.find((state) => state.taxonomyId === entry.taxonomyId)
          ?.importedStructureFingerprint !== structure)
    ) {
      throw new Error(
        `${entry.taxonomyId}: only metadata updates with a recorded structure fingerprint are supported; content and placement changes remain unsupported.`,
      );
    }
  }
  if (plan.counts.conflict > 0) {
    throw new Error(
      "DAC-18 supports initial creation and unchanged repeat imports only.",
    );
  }
  if (plan.counts.create > 0) {
    for (const container of resolveContainerHierarchy(config))
      await gateway.ensureContainer(container);
  }
  for (const entry of plan.entries) {
    if (entry.action !== "create" && entry.action !== "update") continue;
    const artifact = mapped.get(entry.taxonomyId);
    if (!artifact)
      throw new Error(`Missing planned artifact ${entry.taxonomyId}.`);
    if (entry.action === "create") await gateway.createArtifact(artifact);
    else await gateway.updateArtifactMetadata?.(artifact);
  }
  return {
    plan,
    created: plan.counts.create,
    unchanged: plan.counts.unchanged,
    updated: plan.counts.update,
  };
}
