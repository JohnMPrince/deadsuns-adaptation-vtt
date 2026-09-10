import { describe, expect, test } from "vitest";

import { taxonomyId, type AdaptationConfig } from "../src/domain/index.ts";
import { fingerprintArtifact } from "../src/import/fingerprint.ts";
import {
  InvalidAdaptationConfigError,
  planImport,
  type ExistingArtifactState,
} from "../src/import/plan-import.ts";

const config: AdaptationConfig = {
  campaign: "DS",
  title: "Dead Suns Adaptation",
  artifacts: [
    {
      kind: "actor",
      taxonomyId: taxonomyId("DS-NPC-01.01.01.00", "NPC"),
      name: "Create",
    },
    {
      kind: "item",
      taxonomyId: taxonomyId("DS-ITM-01.01.02.00", "ITM"),
      name: "Unchanged",
    },
    {
      kind: "macro",
      taxonomyId: taxonomyId("DS-MAC-01.01.03.00", "MAC"),
      name: "Update",
    },
    {
      kind: "handout",
      taxonomyId: taxonomyId("DS-HND-01.01.04.00", "HND"),
      name: "Conflict",
    },
    {
      kind: "rollTable",
      taxonomyId: taxonomyId("DS-TBL-01.01.05.00", "TBL"),
      name: "Edited",
    },
  ],
};

describe("import planning", () => {
  test("fingerprints equivalent artifacts independently of object key order", async () => {
    const left = {
      kind: "item" as const,
      taxonomyId: taxonomyId("DS-ITM-01.01.09.00", "ITM"),
      name: "Ordered item",
      metadata: { chapter: "One", dataset: "Initial" },
    };
    const right = {
      metadata: { dataset: "Initial", chapter: "One" },
      name: "Ordered item",
      taxonomyId: taxonomyId("DS-ITM-01.01.09.00", "ITM"),
      kind: "item" as const,
    };

    expect(await fingerprintArtifact(left)).toBe(
      await fingerprintArtifact(right),
    );
  });

  test("classifies create, unchanged, update, and conflict without writing", async () => {
    const [, unchanged, update, conflict, edited] = config.artifacts;
    if (!unchanged || !update || !conflict || !edited) {
      throw new Error("Expected planning fixtures.");
    }

    const unchangedFingerprint = await fingerprintArtifact(unchanged);
    const existing: ExistingArtifactState[] = [
      state(unchanged.taxonomyId, unchangedFingerprint, unchangedFingerprint),
      state(update.taxonomyId, "prior-source", "prior-source"),
      state(conflict.taxonomyId, "prior-source", "foundry-edit"),
      state(
        edited.taxonomyId,
        await fingerprintArtifact(edited),
        "foundry-edit",
      ),
    ];

    const plan = await planImport(config, existing);

    expect(plan.entries.map(({ action }) => action)).toEqual([
      "create",
      "unchanged",
      "update",
      "conflict",
      "conflict",
    ]);
    expect(plan.counts).toEqual({
      create: 1,
      update: 1,
      unchanged: 1,
      conflict: 2,
    });
  });

  test("treats duplicate Foundry taxonomy IDs as a conflict", async () => {
    const [artifact] = config.artifacts;
    if (!artifact) {
      throw new Error("Expected an artifact fixture.");
    }

    const plan = await planImport(config, [
      state(artifact.taxonomyId, "old", "old", "Actor.one"),
      state(artifact.taxonomyId, "old", "old", "Actor.two"),
    ]);

    expect(plan.entries[0]).toMatchObject({
      action: "conflict",
      reason: "Multiple Foundry artifacts carry this taxonomy ID.",
    });
  });

  test("refuses to plan an invalid configuration", async () => {
    const invalid = { ...config, campaign: "NOT-DS" };

    await expect(planImport(invalid, [])).rejects.toBeInstanceOf(
      InvalidAdaptationConfigError,
    );
  });
});

function state(
  taxonomyIdValue: ExistingArtifactState["taxonomyId"],
  importedFingerprint: string,
  documentFingerprint: string,
  foundryUuid = "Document.fixture",
): ExistingArtifactState {
  return {
    taxonomyId: taxonomyIdValue,
    foundryUuid,
    importedFingerprint,
    documentFingerprint,
  };
}
