import { describe, expect, test, vi } from "vitest";
import { dac18SampleConfig } from "../src/config/dac-18-sample.ts";
import type { ArtifactMetadata } from "../src/domain/model.ts";
import { parseAdaptationConfigJson } from "../src/domain/parse-serialized-config.ts";
import { importConfiguredAssets } from "../src/foundry/import-config.ts";
import { mapArtifactToFoundry } from "../src/foundry/map-artifact.ts";

const sound = dac18SampleConfig.artifacts.find(
  (artifact) => artifact.kind === "playlistSound",
);
if (!sound) throw new Error("Missing sample sound");

describe("DAC-28 metadata mapping", () => {
  test.each(["element", "mood", "Element", "Mood"])(
    "maps nested %s without changing domain data",
    (soundType) => {
      const artifact = {
        ...sound,
        metadata: {
          syrinscape: { soundId: "example-sound-id", soundType },
          future: [1, null, { x: true }],
        },
      };
      const before = JSON.stringify(artifact);
      expect(mapArtifactToFoundry(artifact, "f").data.flags).toHaveProperty(
        "syrinscape-control",
        {
          soundId: "example-sound-id",
          soundType: soundType.toLowerCase(),
        },
      );
      expect(JSON.stringify(artifact)).toBe(before);
    },
  );

  test.each<ArtifactMetadata>([
    { syrinscape: null },
    { syrinscape: [] },
    { syrinscape: "bad" },
    { syrinscape: { soundId: "" } },
    { syrinscapeSoundID: -1 },
    { syrinscapeSoundID: 1.5 },
    { syrinscapeSoundID: false },
    { syrinscape: { soundType: "Music" } },
    { syrinscape: { soundType: "mood" }, syrinscapeSoundType: "Element" },
    { syrinscape: { soundId: "2" }, syrinscapeSoundID: 1 },
    { syrinscapeSoundID: 42 },
    { syrinscapeSoundType: "Mood" },
    { syrinscape: { soundId: "42" } },
    { syrinscape: { soundType: "mood" } },
  ])(
    "reports invalid supported metadata before writes: %j",
    async (metadata) => {
      const config = {
        ...dac18SampleConfig,
        artifacts: dac18SampleConfig.artifacts.map((artifact) =>
          artifact.taxonomyId === sound.taxonomyId
            ? { ...artifact, metadata }
            : artifact,
        ),
      };
      // The generic domain continues to accept integration-specific values.
      expect(parseAdaptationConfigJson(JSON.stringify(config)).success).toBe(
        true,
      );
      const gateway = {
        listExistingArtifacts: vi.fn().mockResolvedValue([]),
        ensureContainer: vi.fn(),
        createArtifact: vi.fn(),
      };
      await expect(importConfiguredAssets(config, gateway)).rejects.toThrow(
        `${sound.taxonomyId} metadata.syrinscape`,
      );
      expect(gateway.ensureContainer).not.toHaveBeenCalled();
      expect(gateway.createArtifact).not.toHaveBeenCalled();
    },
  );

  test("ignores unknown properties and leaves ordinary tracks unchanged", () => {
    const plain = mapArtifactToFoundry({ ...sound, metadata: {} }, "f");
    expect(
      mapArtifactToFoundry(
        { ...sound, metadata: { future: { arbitrary: [true, null] } } },
        "f",
      ),
    ).toEqual(plain);
  });
  test("accepts matching aliases for a complete configuration", () => {
    expect(
      mapArtifactToFoundry(
        {
          ...sound,
          metadata: {
            syrinscapeSoundID: 42,
            syrinscape: { soundId: "42", soundType: "mood" },
          },
        },
        "f",
      ).data.flags,
    ).toHaveProperty("syrinscape-control", {
      soundId: "42",
      soundType: "mood",
    });
  });

  test.each<ArtifactMetadata>([
    { syrinscapeSoundID: 42, syrinscape: { soundType: "mood" } },
    { syrinscapeSoundType: "Mood", syrinscape: { soundId: "42" } },
  ])("accepts a complete pair split across aliases: %j", (metadata) => {
    expect(
      mapArtifactToFoundry({ ...sound, metadata }, "f").data.flags,
    ).toHaveProperty("syrinscape-control", {
      soundId: "42",
      soundType: "mood",
    });
  });

  test.each<ArtifactMetadata>([
    { syrinscapeSoundID: 42 },
    { syrinscapeSoundType: "Mood" },
    { syrinscape: { soundId: "42" } },
    { syrinscape: { soundType: "mood" } },
  ])("reports an incomplete pair explicitly: %j", (metadata) => {
    expect(() => mapArtifactToFoundry({ ...sound, metadata }, "f")).toThrow(
      "sound ID and sound type must be supplied together",
    );
  });

  test.each<ArtifactMetadata>([
    { syrinscape: {} },
    { syrinscape: { future: true } },
  ])(
    "does not map an object containing neither supported field: %j",
    (metadata) => {
      expect(
        mapArtifactToFoundry({ ...sound, metadata }, "f").data.flags,
      ).not.toHaveProperty("syrinscape-control");
    },
  );
  test("reports supported audio metadata on the wrong document kind", () => {
    const artifact = dac18SampleConfig.artifacts[0];
    if (!artifact) throw new Error("Missing sample artifact");
    expect(() =>
      mapArtifactToFoundry(
        {
          ...artifact,
          metadata: { syrinscapeSoundID: 1 },
        },
        "f",
      ),
    ).toThrow("supported only on playlist sounds");
  });
});
