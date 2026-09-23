import { describe, expect, test } from "vitest";

import { dac18SampleConfig } from "../src/config/dac-18-sample.ts";
import { validateConfig } from "../src/domain/validate-config.ts";
import type { AdaptationConfig } from "../src/domain/model.ts";
import {
  importConfiguredAssets,
  type FoundryImportGateway,
} from "../src/foundry/import-config.ts";
import type { MappedFoundryArtifact } from "../src/foundry/map-artifact.ts";
import type { ResolvedContainer } from "../src/domain/container-hierarchy.ts";
import type { ExistingArtifactState } from "../src/import/plan-import.ts";

describe("DAC-18 Docking Bay sample import", () => {
  test("contains the dependency-complete 16-artifact sample", () => {
    expect(validateConfig(dac18SampleConfig)).toEqual([]);
    expect(dac18SampleConfig.artifacts).toHaveLength(16);
    expect(countKinds()).toEqual({
      actor: 3,
      journal: 3,
      journalPage: 4,
      playlist: 1,
      playlistSound: 4,
      scene: 1,
    });
  });

  test("creates mapped artifacts in dependency order and persists provenance", async () => {
    const gateway = new MemoryGateway();
    const result = await importConfiguredAssets(dac18SampleConfig, gateway);

    expect(result.created).toBe(16);
    expect(gateway.created).toHaveLength(16);
    expect(gateway.created.map(({ documentName }) => documentName)).toEqual([
      "JournalEntry",
      "JournalEntry",
      "JournalEntry",
      "JournalEntryPage",
      "JournalEntryPage",
      "JournalEntryPage",
      "JournalEntryPage",
      "Scene",
      "Actor",
      "Actor",
      "Actor",
      "Playlist",
      "PlaylistSound",
      "PlaylistSound",
      "PlaylistSound",
      "PlaylistSound",
    ]);
    for (const artifact of gateway.created) {
      expect(artifact.data).toHaveProperty(
        "flags.deadsuns-adaptation-vtt.taxonomyId",
        artifact.taxonomyId,
      );
      expect(artifact.data).toHaveProperty(
        "flags.deadsuns-adaptation-vtt.importedFingerprint",
      );
      if (artifact.parentTaxonomyId) {
        const parentIndex = gateway.created.findIndex(
          ({ taxonomyId }) => taxonomyId === artifact.parentTaxonomyId,
        );
        expect(parentIndex).toBeGreaterThanOrEqual(0);
        expect(parentIndex).toBeLessThan(gateway.created.indexOf(artifact));
      }
    }
  });

  test("is unchanged and writes nothing on a repeat import", async () => {
    const gateway = new MemoryGateway();
    await importConfiguredAssets(dac18SampleConfig, gateway);
    const containers = gateway.containers.length;
    const result = await importConfiguredAssets(dac18SampleConfig, gateway);

    expect(result.created).toBe(0);
    expect(result.unchanged).toBe(16);
    expect(gateway.created).toHaveLength(16);
    expect(gateway.containers).toHaveLength(containers);
  });

  test("rejects an invalid configuration before any writes", async () => {
    const gateway = new MemoryGateway();
    const invalid: AdaptationConfig = {
      ...dac18SampleConfig,
      campaign: "OTHER",
    };

    await expect(importConfiguredAssets(invalid, gateway)).rejects.toThrow(
      "validation issue",
    );
    expect(gateway.created).toHaveLength(0);
    expect(gateway.containers).toHaveLength(0);
  });
});

function countKinds(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const artifact of dac18SampleConfig.artifacts) {
    counts[artifact.kind] = (counts[artifact.kind] ?? 0) + 1;
  }
  return counts;
}

class MemoryGateway implements FoundryImportGateway {
  public readonly created: MappedFoundryArtifact[] = [];
  public readonly containers: ResolvedContainer[] = [];

  public listExistingArtifacts(): Promise<readonly ExistingArtifactState[]> {
    return Promise.resolve(
      this.created.map((artifact) => {
        const flags = artifact.data.flags as Record<
          string,
          Record<string, string>
        >;
        const fingerprint =
          flags["deadsuns-adaptation-vtt"]?.importedFingerprint ?? "";
        return {
          taxonomyId:
            artifact.taxonomyId as ExistingArtifactState["taxonomyId"],
          foundryUuid: `${artifact.documentName}.${artifact.taxonomyId}`,
          importedFingerprint: fingerprint,
          documentFingerprint: fingerprint,
        };
      }),
    );
  }

  public ensureContainer(container: ResolvedContainer): Promise<void> {
    if (
      !this.containers.some(
        ({ category, path }) =>
          category === container.category && path === container.path,
      )
    ) {
      this.containers.push(container);
    }
    return Promise.resolve();
  }

  public createArtifact(artifact: MappedFoundryArtifact): Promise<void> {
    this.created.push(artifact);
    return Promise.resolve();
  }
}
