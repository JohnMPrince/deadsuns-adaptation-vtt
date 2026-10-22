import { describe, expect, test } from "vitest";
import { parseAdaptationConfigJson } from "../src/domain/parse-serialized-config.ts";
import { mapArtifactToFoundry } from "../src/foundry/map-artifact.ts";
import { fingerprintArtifact } from "../src/import/fingerprint.ts";
import { parseTaxonomySheet } from "../src/ingestion/parse-taxonomy.ts";

const options = { campaign: "DS", title: "Audio example" };
function input(metadata: string) {
  const rows = [
    [
      "Taxonomy ID",
      "Campaign",
      "Taxonomy Code",
      "Index",
      "Artifact Name",
      "Asset Path",
      "Metadata",
    ],
    ["DS-PLY-08.15.02.00", "DS", "PLY", "08.15.02.00", "Soundboard", "", ""],
    [
      "DS-AUD-08.15.02.02",
      "DS",
      "AUD",
      "08.15.02.02",
      "Laser pistol fires (single shot)",
      "audio: assets/example.ogg",
      metadata,
    ],
  ];
  return rows
    .map((cells) =>
      cells.map((cell) => `"${cell.replaceAll('"', '""')}"`).join("\t"),
    )
    .join("\n");
}

describe("Syrinscape sound metadata", () => {
  test.each(["Element", "Mood"])(
    "accepts and preserves %s through ingestion and JSON",
    (type) => {
      const result = parseTaxonomySheet(
        input(`syrinscapeSoundID: 123456\nsyrinscapeSoundType: ${type}`),
        options,
      );
      if (!result.success) throw new Error(JSON.stringify(result.issues));
      expect(result.config.artifacts[1]?.metadata?.syrinscapeSoundType).toBe(
        type,
      );
      expect(parseAdaptationConfigJson(result.json)).toEqual({
        success: true,
        config: result.config,
      });
    },
  );
  test.each(["element", "mood", "Music", "Element ", "", null, 123])(
    "preserves arbitrary sound type in import JSON: %j",
    (type) => {
      const valid = parseTaxonomySheet(
        input("syrinscapeSoundType: Element"),
        options,
      );
      if (!valid.success) throw new Error(JSON.stringify(valid.issues));
      const artifacts = valid.config.artifacts.map((artifact) =>
        artifact.kind === "playlistSound"
          ? {
              ...artifact,
              metadata: { ...artifact.metadata, syrinscapeSoundType: type },
            }
          : artifact,
      );
      expect(
        parseAdaptationConfigJson(
          JSON.stringify({ ...valid.config, artifacts }),
        ),
      ).toMatchObject({
        success: true,
        config: {
          artifacts: [
            expect.anything(),
            { metadata: { syrinscapeSoundType: type } },
          ],
        },
      });
    },
  );
  test.each([
    "syrinscapeSoundID: 123456,\nsyrinscapeSoundType: 'Element'",
    "syrinscape sound type: Element\nsyrinscape sound id: 123456",
    '{"syrinscapeSoundID":123456,"syrinscapeSoundType":"Element"}',
  ])(
    "preserves metadata through ingestion, JSON and Foundry flags: %s",
    (metadata) => {
      const result = parseTaxonomySheet(input(metadata), options);
      if (!result.success) throw new Error(JSON.stringify(result.issues));
      expect(parseAdaptationConfigJson(result.json)).toEqual({
        success: true,
        config: result.config,
      });
      const sound = result.config.artifacts[1];
      if (!sound) throw new Error("Missing sound.");
      expect(sound.metadata).toEqual({
        syrinscapeSoundID: 123456,
        syrinscapeSoundType: "Element",
      });
      expect(mapArtifactToFoundry(sound, "example").data.flags).toEqual({
        "syrinscape-control": { soundId: "123456", soundType: "element" },
        "deadsuns-adaptation-vtt": {
          taxonomyId: "DS-AUD-08.15.02.02",
          importedFingerprint: "example",
          syrinscapeSoundID: 123456,
          syrinscapeSoundType: "Element",
        },
      });
    },
  );
  test.each([
    "syrinscapeSoundID: 1\nsyrinscapeSoundID: 2",
    "not metadata",
    "{invalid}",
  ])("rejects malformed metadata: %s", (metadata) => {
    const result = parseTaxonomySheet(input(metadata), options);
    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected invalid metadata.");
    expect(
      result.issues.some((issue) => issue.path.startsWith("rows[3].")),
    ).toBe(true);
    expect(result).not.toHaveProperty("json");
  });
  test("preserves Syrinscape fields on a journal", () => {
    const result = parseAdaptationConfigJson(
      JSON.stringify({
        ...options,
        artifacts: [
          {
            kind: "journal",
            taxonomyId: "DS-JRN-08.15.02.00",
            name: "Journal",
            metadata: { syrinscapeSoundID: 123456 },
          },
        ],
      }),
    );
    expect(result.success).toBe(true);
  });
  test("metadata changes affect the source fingerprint", async () => {
    const result = parseTaxonomySheet(
      input("syrinscapeSoundID: 123456\nsyrinscapeSoundType: Element"),
      options,
    );
    if (!result.success) throw new Error(JSON.stringify(result.issues));
    const sound = result.config.artifacts[1];
    if (!sound) throw new Error("Missing sound.");
    expect(await fingerprintArtifact(sound)).not.toBe(
      await fingerprintArtifact({
        ...sound,
        metadata: { ...sound.metadata, syrinscapeSoundID: 654321 },
      }),
    );
  });
});
