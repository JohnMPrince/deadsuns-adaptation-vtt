import { describe, expect, test } from "vitest";
import { deadSunsContainers } from "../src/config/dead-suns-containers.ts";
import {
  resolveContainerHierarchy,
  taxonomyId,
  validateConfig,
  type AdaptationConfig,
} from "../src/domain/index.ts";
import {
  InvalidAdaptationConfigError,
  planImport,
} from "../src/import/plan-import.ts";
import { fingerprintArtifact } from "../src/import/fingerprint.ts";

const config: AdaptationConfig = {
  campaign: "DS",
  title: "Dead Suns",
  containers: [
    { id: "part-one", name: "Part One", parentId: "chapter-one" },
    { id: "campaign", name: "Dead Suns" },
    { id: "chapter-one", name: "Chapter One", parentId: "campaign" },
    { id: "misc", name: "Miscellaneous", parentId: "campaign" },
  ],
  artifacts: [
    {
      kind: "journal",
      taxonomyId: taxonomyId("DS-JRN-01.01.01.00", "JRN"),
      name: "Locations",
      containerId: "part-one",
    },
  ],
};

describe("container hierarchy", () => {
  test("resolves out-of-order configuration parent-first without mutation", () => {
    const before = structuredClone(config);
    expect(validateConfig(config)).toEqual([]);
    const result = resolveContainerHierarchy(config);
    expect(result.map((entry) => entry.id)).toEqual([
      "campaign",
      "chapter-one",
      "part-one",
      "misc",
    ]);
    expect(result[2]).toMatchObject({
      ancestry: ["campaign", "chapter-one", "part-one"],
      path: ["Dead Suns", "Chapter One", "Part One"],
    });
    expect(resolveContainerHierarchy(config)).toEqual(result);
    expect(config).toEqual(before);
  });

  test("supports empty and legacy configurations", () => {
    expect(
      resolveContainerHierarchy({ campaign: "DS", title: "DS", artifacts: [] }),
    ).toEqual([]);
    expect(
      validateConfig({
        campaign: "DS",
        title: "DS",
        artifacts: [
          {
            kind: "journal",
            taxonomyId: taxonomyId("DS-JRN-01.01.01.00", "JRN"),
            name: "Legacy",
            metadata: { containerPath: "Old/Path" },
          },
        ],
      }),
    ).toEqual([]);
  });

  test("allows multiple roots and repeated display names", () => {
    expect(
      resolveContainerHierarchy({
        ...config,
        artifacts: [],
        containers: [
          { id: "a", name: "Same" },
          { id: "b", name: "Same" },
        ],
      }).map((entry) => entry.id),
    ).toEqual(["a", "b"]);
  });

  test.each([
    [{ id: "Bad ID", name: "Name" }],
    [{ id: "a", name: " " }],
    [
      { id: "a", name: "A" },
      { id: "a", name: "B" },
    ],
    [{ id: "a", name: "A", parentId: "missing" }],
    [{ id: "a", name: "A", parentId: "a" }],
    [
      { id: "a", name: "A", parentId: "b" },
      { id: "b", name: "B", parentId: "a" },
    ],
  ])("rejects invalid hierarchy %j", (...containers) => {
    const invalid = { ...config, containers, artifacts: [] };
    expect(validateConfig(invalid).length).toBeGreaterThan(0);
    expect(() => resolveContainerHierarchy(invalid)).toThrow();
  });

  test("reports missing placement and rejects import before planning", async () => {
    const invalid = { ...config, containers: [] };
    expect(validateConfig(invalid)).toEqual([
      {
        path: "artifacts[0].containerId",
        message: 'Unknown container "part-one".',
      },
    ]);
    await expect(planImport(invalid, [])).rejects.toBeInstanceOf(
      InvalidAdaptationConfigError,
    );
  });

  test("rejects ambiguous legacy placement and embedded placement", () => {
    const invalid: AdaptationConfig = {
      ...config,
      artifacts: [
        { ...journal(), metadata: { containerPath: "Legacy" } },
        {
          kind: "journalPage",
          taxonomyId: taxonomyId("DS-JPG-01.01.01.01", "JPG"),
          name: "Page",
          journal: { taxonomyId: taxonomyId("DS-JRN-01.01.01.00", "JRN") },
          markdown: "",
          containerId: "part-one",
        },
        {
          kind: "playlist",
          taxonomyId: taxonomyId("DS-PLY-01.01.01.00", "PLY"),
          name: "Music",
        },
        {
          kind: "playlistSound",
          taxonomyId: taxonomyId("DS-AUD-01.01.01.01", "AUD"),
          name: "Sound",
          playlist: { taxonomyId: taxonomyId("DS-PLY-01.01.01.00", "PLY") },
          source: "music.ogg",
          containerId: "part-one",
        },
      ],
    };
    expect(validateConfig(invalid).map((issue) => issue.path)).toEqual([
      "artifacts[0].containerId",
      "artifacts[1].containerId",
      "artifacts[3].containerId",
    ]);
  });

  test("moving an artifact retains identity and produces an update", async () => {
    const artifact = journal();
    const fingerprint = await fingerprintArtifact(artifact);
    const plan = await planImport(
      { ...config, artifacts: [{ ...artifact, containerId: "misc" }] },
      [
        {
          taxonomyId: artifact.taxonomyId,
          foundryUuid: "JournalEntry.example",
          importedFingerprint: fingerprint,
          documentFingerprint: fingerprint,
        },
      ],
    );
    expect(plan.entries[0]).toMatchObject({
      taxonomyId: artifact.taxonomyId,
      action: "update",
    });
  });
});

function journal() {
  const artifact = config.artifacts[0];
  if (!artifact) throw new Error("Missing test journal");
  return artifact;
}

test("ships the requested initial Dead Suns tree", () => {
  const resolved = resolveContainerHierarchy({
    campaign: "DS",
    title: "Dead Suns",
    containers: deadSunsContainers,
    artifacts: [],
  });
  expect(resolved.map((container) => container.path.join("/"))).toEqual([
    "Dead Suns Adaptation",
    "Dead Suns Adaptation/Miscellaneous",
    "Dead Suns Adaptation/Locations",
    "Dead Suns Adaptation/Elements",
    "Dead Suns Adaptation/Chapter 1",
  ]);
});
