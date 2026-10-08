import { describe, expect, test } from "vitest";
import {
  artifactCodes,
  artifactCodeDefinitions,
  parseAdaptationConfig,
  parseAdaptationConfigJson,
  parseAssetReferences,
  taxonomyId,
  type ActorDefinition,
} from "../src/domain/index.ts";
import { fingerprintArtifact } from "../src/import/fingerprint.ts";

const actor: ActorDefinition = {
  kind: "actor",
  taxonomyId: taxonomyId("DS-NPC-01.01.01.00", "NPC"),
  name: "Example",
};
const assets = [
  { role: "portrait", path: "assets/actors/npcs/ferani-nadaz.webp" },
  { role: "token", path: "assets/actors/npcs/ferani-nadaz-token.webp" },
];
function configFor(artifact: unknown) {
  return { campaign: "DS", title: "Example", artifacts: [artifact] };
}

describe("typed asset references", () => {
  test.each(artifactCodes)("supports assets on %s", (code) => {
    const config = configFor({
      kind: artifactCodeDefinitions[code].kind,
      taxonomyId: taxonomyId(`DS-${code}-01.01.01.00`),
      name: "Example",
      assets,
      ...(code === "JPG"
        ? { journal: { taxonomyId: "DS-JRN-01.01.01.00" }, markdown: "" }
        : {}),
      ...(code === "AUD"
        ? {
            playlist: { taxonomyId: "DS-PLY-01.01.01.00" },
            source: "audio.ogg",
          }
        : {}),
    });
    expect(parseAdaptationConfig(config)).toEqual({ success: true, config });
  });
  test("preserves legacy configuration without adding assets", () => {
    const config = configFor(actor);
    const result = parseAdaptationConfigJson(JSON.stringify(config));
    expect(result).toEqual({ success: true, config });
    if (!result.success) throw new Error("Expected legacy configuration.");
    expect(result.config.artifacts[0]).not.toHaveProperty("assets");
  });
  test.each(
    [null, [], [assets[0]], assets, [...assets, assets[0]]].map((value) => ({
      value,
    })),
  )(
    "round-trips nullable, empty, single, multiple and duplicate assets: %j",
    ({ value }) => {
      const config = configFor({ ...actor, assets: value });
      expect(parseAdaptationConfigJson(JSON.stringify(config))).toEqual({
        success: true,
        config,
      });
    },
  );
  test.each(["path.webp", 42, {}])(
    "rejects non-array collections: %j",
    (value) => {
      expect(
        parseAdaptationConfig(configFor({ ...actor, assets: value })),
      ).toEqual({
        success: false,
        issues: [
          {
            path: "artifacts[0].assets",
            message: "Expected an array of asset references or null.",
          },
        ],
      });
    },
  );
  test("reports invalid references and missing, blank or non-string fields", () => {
    const result = parseAdaptationConfig(
      configFor({
        ...actor,
        assets: [null, "path.webp", {}, { role: " ", path: 42 }],
      }),
    );
    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected validation issues.");
    expect(result.issues.map(({ path }) => path)).toEqual([
      "artifacts[0].assets[0]",
      "artifacts[0].assets[1]",
      "artifacts[0].assets[2].role",
      "artifacts[0].assets[2].path",
      "artifacts[0].assets[3].role",
      "artifacts[0].assets[3].path",
    ]);
  });
  test("accepts missing files and unrestricted role names without modifying paths", () => {
    const config = configFor({
      ...actor,
      assets: [{ role: "custom", path: "assets/Missing file.webp" }],
    });
    expect(parseAdaptationConfigJson(JSON.stringify(config))).toEqual({
      success: true,
      config,
    });
  });
  test("fingerprints include asset roles, paths and order", async () => {
    const original = await fingerprintArtifact({ ...actor, assets });
    for (const changed of [
      actor,
      { ...actor, assets: [...assets].reverse() },
      {
        ...actor,
        assets: [
          { role: "other", path: "assets/actors/npcs/ferani-nadaz.webp" },
        ],
      },
      { ...actor, assets: [{ role: "portrait", path: "different.webp" }] },
    ]) {
      expect(await fingerprintArtifact(changed)).not.toBe(original);
    }
  });
});

describe("Asset Path cell parsing", () => {
  test.each([undefined, null, "", "  \r\n\t\r\n"])(
    "treats missing or blank input as no assets: %j",
    (input) => {
      expect(parseAssetReferences(input)).toEqual([]);
    },
  );
  test("parses a single scene background", () => {
    expect(
      parseAssetReferences(
        "background: assets/scenes/chapter-1/docking-bay-94.webp",
      ),
    ).toEqual([
      {
        role: "background",
        path: "assets/scenes/chapter-1/docking-bay-94.webp",
      },
    ]);
  });
  test.each(["\n", "\r", "\r\n"])(
    "parses portrait and token separated by %j",
    (separator) => {
      const input = assets
        .map(({ role, path }) => `  ${role} : ${path}  `)
        .join(separator);
      expect(parseAssetReferences(input)).toEqual(assets);
    },
  );
  test("preserves order, duplicates, case, spaces and colons in paths", () => {
    expect(
      parseAssetReferences(
        "Portrait: assets/My Actor:portrait.webp\r\n\n token: assets/token.webp\rPortrait: assets/My Actor:portrait.webp",
      ),
    ).toEqual([
      { role: "Portrait", path: "assets/My Actor:portrait.webp" },
      { role: "token", path: "assets/token.webp" },
      { role: "Portrait", path: "assets/My Actor:portrait.webp" },
    ]);
  });
  test.each(["path.webp", ": path.webp", "portrait: "])(
    "rejects malformed role/path entries: %j",
    (input) => {
      expect(() => parseAssetReferences(`\n${input}`)).toThrow(
        "Invalid asset reference on line 2",
      );
    },
  );
});
