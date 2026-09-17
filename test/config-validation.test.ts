import { describe, expect, test } from "vitest";

import {
  parseAdaptationConfig,
  taxonomyId,
  validateConfig,
  type AdaptationConfig,
} from "../src/domain/index.ts";

describe("adaptation configuration validation", () => {
  test("accepts taxonomy-based relationships and metadata", () => {
    const config: AdaptationConfig = {
      campaign: "DS",
      title: "Dead Suns Adaptation",
      artifacts: [
        {
          kind: "journal",
          taxonomyId: taxonomyId("DS-JRN-08.03.01.00", "JRN"),
          name: "Locations",
          metadata: {
            containerPath: "Dead Suns Adaptation/Miscellaneous",
            chapter: "Miscellaneous",
            part: "Locations",
            dataset: "Initial",
          },
        },
        {
          kind: "journalPage",
          taxonomyId: taxonomyId("DS-JPG-08.03.01.01", "JPG"),
          name: "Absalom Station",
          journal: { taxonomyId: taxonomyId("DS-JRN-08.03.01.00", "JRN") },
          markdown: "# Absalom Station",
        },
        {
          kind: "handout",
          taxonomyId: taxonomyId("DS-HND-01.01.01.00", "HND"),
          name: "Embassy Invitation",
        },
      ],
    };

    expect(validateConfig(config)).toEqual([]);
  });

  test("reports campaign, kind, duplicate, and reference problems together", () => {
    const journalId = taxonomyId("DS-JRN-08.03.01.00", "JRN");
    const config = {
      campaign: "OTHER",
      title: "Broken configuration",
      artifacts: [
        { kind: "journal", taxonomyId: journalId, name: "Locations" },
        { kind: "journal", taxonomyId: journalId, name: "Duplicate" },
        {
          kind: "journalPage",
          taxonomyId: taxonomyId("DS-NPC-08.03.01.01", "NPC"),
          name: "Wrong kind",
          journal: { taxonomyId: taxonomyId("DS-JRN-09.09.09.09", "JRN") },
          markdown: "",
        },
      ],
    } as unknown as AdaptationConfig;

    expect(validateConfig(config).map((issue) => issue.message)).toEqual([
      "Taxonomy campaign DS does not match configuration campaign OTHER.",
      "Taxonomy campaign DS does not match configuration campaign OTHER.",
      'Duplicate taxonomy ID "DS-JRN-08.03.01.00" (already used by journal).',
      "Taxonomy campaign DS does not match configuration campaign OTHER.",
      "Artifact code NPC requires kind actor, not journalPage.",
      'Unknown artifact reference "DS-JRN-09.09.09.09".',
    ]);
  });

  test.each([
    null,
    [],
    { campaign: "DS", title: "Example", artifacts: null },
    { campaign: "DS", title: "Example", artifacts: [null] },
    {
      campaign: "DS",
      title: "Example",
      artifacts: [
        {
          kind: "bogus",
          taxonomyId: "DS-NPC-01.01.01.00",
          name: "Unknown",
        },
      ],
    },
  ])("reports malformed external configuration without throwing", (input) => {
    expect(() => validateConfig(input)).not.toThrow();
    expect(validateConfig(input).length).toBeGreaterThan(0);
  });

  test("reports malformed kind-specific fields with precise paths", () => {
    const result = parseAdaptationConfig({
      campaign: "DS",
      title: "Example",
      artifacts: [
        {
          kind: "scene",
          taxonomyId: "DS-BAT-01.01.01.00",
          name: "Scene",
          actors: [null, { taxonomyId: 42 }],
          tags: ["valid", false],
          metadata: { dataset: 1 },
        },
        {
          kind: "journalPage",
          taxonomyId: "DS-JPG-01.01.01.01",
          name: "Page",
          journal: null,
          markdown: 42,
        },
        {
          kind: "playlistSound",
          taxonomyId: "DS-AUD-01.01.01.01",
          name: "Sound",
          playlist: {},
          source: " ",
        },
      ],
    });

    expect(result).toMatchObject({ success: false });
    if (result.success)
      throw new Error("Expected structural validation issues.");
    expect(result.issues.map(({ path }) => path)).toEqual([
      "artifacts[0].metadata.dataset",
      "artifacts[0].tags[1]",
      "artifacts[0].actors[0]",
      "artifacts[0].actors[1].taxonomyId",
      "artifacts[1].journal",
      "artifacts[1].markdown",
      "artifacts[2].playlist.taxonomyId",
      "artifacts[2].source",
    ]);
  });

  test("parses a structurally valid configuration into the domain model", () => {
    const input: unknown = {
      campaign: "DS",
      title: "Example",
      artifacts: [
        {
          kind: "journalPage",
          taxonomyId: "DS-JPG-01.01.01.01",
          name: "Page",
          journal: { taxonomyId: "DS-JRN-01.01.01.00" },
          markdown: "",
        },
      ],
    };

    const result = parseAdaptationConfig(input);
    expect(result).toEqual({ success: true, config: input });
  });
});
