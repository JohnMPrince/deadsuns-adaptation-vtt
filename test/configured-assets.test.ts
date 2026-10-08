import { describe, expect, test } from "vitest";
import { dac18SampleConfig } from "../src/config/dac-18-sample.ts";
import {
  taxonomyId,
  type AdaptationArtifactDefinition,
} from "../src/domain/index.ts";
import { mapArtifactToFoundry } from "../src/foundry/map-artifact.ts";

function sample(
  kind: AdaptationArtifactDefinition["kind"],
): AdaptationArtifactDefinition {
  const artifact = dac18SampleConfig.artifacts.find(
    (entry) => entry.kind === kind,
  );
  if (!artifact) throw new Error(`Missing sample ${kind}`);
  return artifact;
}

describe("configured Foundry asset slots", () => {
  test.each(["NPC", "AA", "SA"] as const)(
    "maps %s portrait and prototype token independently without altering paths or configuration",
    (code) => {
      const artifact = {
        kind: "actor" as const,
        taxonomyId: taxonomyId(`DS-${code}-01.01.01.00`, code),
        name: "Actor",
        assets: [
          { role: "portrait", path: "assets/Missing portrait.webp" },
          { role: "token", path: "https://example.org/token.webp" },
        ],
      };
      const before = JSON.stringify(artifact);
      const { data } = mapArtifactToFoundry(artifact, "fingerprint");
      expect(data.img).toBe("assets/Missing portrait.webp");
      expect(data.prototypeToken).toEqual({
        texture: { src: "https://example.org/token.webp" },
      });
      expect(JSON.stringify(artifact)).toBe(before);
      expect(data).toHaveProperty(
        "flags.deadsuns-adaptation-vtt.importedFingerprint",
        "fingerprint",
      );
    },
  );

  test("uses the first exact role and ignores unsupported roles", () => {
    const { data } = mapArtifactToFoundry(
      {
        ...sample("actor"),
        assets: [
          { role: "Portrait", path: "wrong.webp" },
          { role: "background", path: "wrong.webp" },
          { role: "portrait", path: "first.webp" },
          { role: "portrait", path: "second.webp" },
        ],
      },
      "fingerprint",
    );
    expect(data.img).toBe("first.webp");
    expect(data).not.toHaveProperty("prototypeToken");
  });

  test("configured background and audio override legacy fields", () => {
    expect(
      mapArtifactToFoundry(
        {
          ...sample("scene"),
          assets: [{ role: "background", path: "missing.webp" }],
        },
        "f",
      ).data.levels,
    ).toEqual([{ name: "Background", background: { src: "missing.webp" } }]);
    expect(
      mapArtifactToFoundry(
        {
          ...sample("playlistSound"),
          assets: [{ role: "audio", path: "missing.ogg" }],
        },
        "f",
      ).data.path,
    ).toBe("missing.ogg");
  });

  test.each(["CIN", "BAT", "REG", "SOC"] as const)(
    "maps %s backgrounds into one v14 Level without deprecated Scene fields",
    (code) => {
      const artifact = {
        kind: "scene" as const,
        taxonomyId: taxonomyId(`DS-${code}-01.01.01.00`, code),
        name: "Scene",
        background: "legacy.webp",
        assets: [{ role: "background", path: "configured.webp" }],
      };
      const { data } = mapArtifactToFoundry(artifact, "f");
      expect(data.levels).toEqual([
        { name: "Background", background: { src: "configured.webp" } },
      ]);
      expect(data).not.toHaveProperty("background");
      expect(data).not.toHaveProperty("initialLevel");
      expect(
        mapArtifactToFoundry({ ...artifact, assets: null }, "f").data.levels,
      ).toEqual([{ name: "Background", background: { src: "legacy.webp" } }]);
      const empty = mapArtifactToFoundry(
        { kind: "scene", taxonomyId: artifact.taxonomyId, name: "Empty" },
        "f",
      ).data;
      expect(empty).not.toHaveProperty("levels");
      expect(empty).not.toHaveProperty("background");
    },
  );

  test.each([undefined, null, [], [{ role: "unknown", path: "ignored.webp" }]])(
    "preserves legacy mappings when slots are unassigned: %j",
    (assets) => {
      for (const kind of [
        "actor",
        "scene",
        "journalPage",
        "playlistSound",
      ] as const) {
        const artifact = sample(kind);
        const withAssets =
          assets === undefined ? artifact : { ...artifact, assets };
        expect(mapArtifactToFoundry(withAssets, "f")).toEqual(
          mapArtifactToFoundry(artifact, "f"),
        );
      }
    },
  );

  test("identifies the Markdown content source while retaining fallback text and parent identity", () => {
    const artifact = sample("journalPage");
    if (artifact.kind !== "journalPage") throw new Error("Expected page");
    const mapped = mapArtifactToFoundry(
      {
        ...artifact,
        assets: [
          { role: "content", path: "assets/page.md" },
          { role: "image", path: "ignored.webp" },
        ],
      },
      "f",
    );
    expect(mapped.documentName).toBe("JournalEntryPage");
    expect(mapped.parentTaxonomyId).toBe(artifact.journal.taxonomyId);
    expect(mapped.journalContentSource).toBe("assets/page.md");
    expect(mapped.data).toMatchObject({
      type: "text",
      text: { content: artifact.markdown, format: 1 },
    });
    expect(mapped.data).not.toHaveProperty("src");
  });

  test("maps Items with or without images into the Item container category", () => {
    const item = {
      kind: "item" as const,
      taxonomyId: taxonomyId("DS-ITM-01.01.01.00", "ITM"),
      name: "Example",
      metadata: { containerPath: "Equipment" },
    };
    const mapped = mapArtifactToFoundry(
      { ...item, assets: [{ role: "portrait", path: "missing.webp" }] },
      "f",
    );
    expect(mapped).toMatchObject({
      documentName: "Item",
      containerCategory: "item",
      containerPath: "Equipment",
      data: { type: "equipment", system: {}, img: "missing.webp" },
    });
    expect(mapArtifactToFoundry(item, "f").data).not.toHaveProperty("img");
    expect(
      mapArtifactToFoundry(
        { ...item, assets: [{ role: "image", path: "ignored.webp" }] },
        "f",
      ).data,
    ).not.toHaveProperty("img");
  });
  test.each(["journal", "playlist"] as const)(
    "preserves %s behavior despite asset references",
    (kind) => {
      const artifact = sample(kind);
      expect(
        mapArtifactToFoundry(
          {
            ...artifact,
            assets: [
              { role: "portrait", path: "ignored.webp" },
              { role: "content", path: "ignored.md" },
            ],
          },
          "f",
        ),
      ).toEqual(mapArtifactToFoundry(artifact, "f"));
    },
  );
});
