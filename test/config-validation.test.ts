import { describe, expect, test } from "vitest";

import {
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
});
