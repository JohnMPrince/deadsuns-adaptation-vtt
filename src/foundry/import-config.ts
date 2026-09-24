import {
  resolveContainerHierarchy,
  type ResolvedContainer,
} from "../domain/container-hierarchy.ts";
import type { AdaptationConfig } from "../domain/model.ts";
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
}

export interface ImportExecutionResult {
  readonly plan: ImportPlan;
  readonly created: number;
  readonly unchanged: number;
}

export async function importConfiguredAssets(
  config: AdaptationConfig,
  gateway: FoundryImportGateway,
): Promise<ImportExecutionResult> {
  const plan = await planImport(config, await gateway.listExistingArtifacts());
  if (plan.counts.conflict > 0 || plan.counts.update > 0) {
    throw new Error(
      "DAC-18 supports initial creation and unchanged repeat imports only.",
    );
  }
  if (plan.counts.create > 0) {
    for (const container of resolveContainerHierarchy(config))
      await gateway.ensureContainer(container);
  }
  const byId = new Map(
    config.artifacts.map((artifact) => [artifact.taxonomyId, artifact]),
  );
  for (const entry of plan.entries) {
    if (entry.action !== "create") continue;
    const artifact = byId.get(entry.taxonomyId);
    if (!artifact)
      throw new Error(`Missing planned artifact ${entry.taxonomyId}.`);
    await gateway.createArtifact(
      mapArtifactToFoundry(artifact, entry.desiredFingerprint),
    );
  }
  return {
    plan,
    created: plan.counts.create,
    unchanged: plan.counts.unchanged,
  };
}
