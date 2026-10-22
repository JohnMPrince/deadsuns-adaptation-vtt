import { describe, expect, test } from "vitest";
import {
  parseAdaptationConfig,
  parseAdaptationConfigJson,
  type ArtifactMetadata,
} from "../src/domain/index.ts";
import { fingerprintArtifact } from "../src/import/fingerprint.ts";
import { parseTaxonomySheet } from "../src/ingestion/parse-taxonomy.ts";

const options = { campaign: "DS", title: "Scene metadata" };
function sheet(
  metadata: string,
  code = "BAT",
  containerPath = "Dead Suns Adaptation/Chapter 1",
) {
  return [
    [
      "Taxonomy ID",
      "Campaign",
      "Taxonomy Code",
      "Index",
      "Artifact Name",
      "Container Path",
      "Chapter",
      "Metadata",
    ],
    [
      `DS-${code}-01.01.02.00`,
      "DS",
      code,
      "01.01.02.00",
      "Docking Bay 94",
      containerPath,
      "Chapter 1",
      metadata,
    ],
  ]
    .map((cells) =>
      cells.map((cell) => `"${cell.replaceAll('"', '""')}"`).join("\t"),
    )
    .join("\n");
}
const composition: ArtifactMetadata = {
  walls: [{ coordinates: [0, 10, 200, 10], movement: true }],
  doors: [{ wall: 0, state: "closed", locked: false }],
  lighting: { ambient: 0.5, tint: null },
  futureField: "preserved",
};

describe("extensible artifact metadata", () => {
  const config = (metadata?: unknown) => ({
    ...options,
    artifacts: [
      {
        kind: "actor",
        taxonomyId: "DS-NPC-01.01.02.00",
        name: "Actor",
        ...(metadata === undefined ? {} : { metadata }),
      },
    ],
  });
  test.each([undefined, {}, { nested: [null, false, 0, "", { values: [] }] }])(
    "preserves optional and nested metadata through construction and JSON: %j",
    (metadata) => {
      const input = config(metadata);
      const before = JSON.stringify(input);
      const result = parseAdaptationConfig(input);
      expect(result.success).toBe(true);
      if (!result.success) throw new Error("Expected valid metadata.");
      expect(result.config).toBe(input);
      expect(JSON.stringify(result.config)).toBe(before);
      expect(parseAdaptationConfigJson(before)).toEqual({
        success: true,
        config: input,
      });
      expect(Object.hasOwn(result.config.artifacts[0] ?? {}, "metadata")).toBe(
        metadata !== undefined,
      );
    },
  );
  test("treats formerly reserved keys as opaque JSON in the domain", () => {
    const input = config({
      chapter: 7,
      part: false,
      containerPath: { arbitrary: true },
      dataset: "Initial",
      syrinscapeSoundID: -1,
      syrinscapeSoundType: ["future"],
    });
    expect(parseAdaptationConfigJson(JSON.stringify(input))).toEqual({
      success: true,
      config: input,
    });
  });
  test.each([[], [1], null, 1, "text", true])(
    "rejects non-object metadata: %j",
    (metadata) => {
      expect(parseAdaptationConfig(config(metadata))).toMatchObject({
        success: false,
        issues: [{ path: "artifacts[0].metadata" }],
      });
      expect(
        parseAdaptationConfigJson(JSON.stringify(config(metadata))),
      ).toMatchObject({ success: false, stage: "structure" });
    },
  );
  test.each(["containerPath", "chapter", "part", "custom"])(
    "rejects undefined values uniformly: %s",
    (key) => {
      expect(parseAdaptationConfig(config({ [key]: undefined }))).toMatchObject(
        { success: false, issues: [{ path: `artifacts[0].metadata.${key}` }] },
      );
    },
  );
  test("rejects malformed JSON within metadata at the syntax boundary", () => {
    expect(
      parseAdaptationConfigJson(
        '{"campaign":"DS","title":"Example","artifacts":[{"metadata":{"x":}}]}',
      ),
    ).toMatchObject({ success: false, stage: "syntax" });
  });
  test.each(["BAT", "NPC", "JRN", "ITM"])(
    "retains unknown nested metadata on %s",
    (code) => {
      const result = parseTaxonomySheet(
        sheet(JSON.stringify(composition), code),
        options,
      );
      if (!result.success) throw new Error(JSON.stringify(result.issues));
      expect(result.config.artifacts[0]?.metadata).toEqual({
        ...composition,
        containerPath: "Dead Suns Adaptation/Chapter 1",
        chapter: "Chapter 1",
      });
      expect(parseAdaptationConfigJson(result.json)).toEqual({
        success: true,
        config: result.config,
      });
    },
  );
  test("parses nested values and quoted separators in key/value metadata", () => {
    const result = parseTaxonomySheet(
      sheet(
        'walls: [{"coordinates":[0,10,200,10],"movement":true}],\ndoors: [{"state":"closed"}],\nnotes: "Rooms, walls: and doors",\ndescription: A Maestro\'s Symphony,\ncount: 2, enabled: false, optional: null',
      ),
      options,
    );
    if (!result.success) throw new Error(JSON.stringify(result.issues));
    expect(result.config.artifacts[0]?.metadata).toMatchObject({
      walls: [{ coordinates: [0, 10, 200, 10], movement: true }],
      doors: [{ state: "closed" }],
      notes: "Rooms, walls: and doors",
      description: "A Maestro's Symphony",
      count: 2,
      enabled: false,
      optional: null,
    });
  });
  test("preserves arbitrary dictionary keys without altering object prototypes", () => {
    const result = parseTaxonomySheet(
      sheet(
        '{"__proto__":{"custom":true},"constructor":"value","newField":42}',
      ),
      options,
    );
    if (!result.success) throw new Error(JSON.stringify(result.issues));
    const metadata = result.config.artifacts[0]?.metadata;
    expect(Object.getPrototypeOf(metadata)).toBe(Object.prototype);
    expect(Object.hasOwn(metadata ?? {}, "__proto__")).toBe(true);
    expect(metadata?.constructor).toBe("value");
    expect(result.json).toContain('"newField": 42');
  });
  test("known placement metadata cannot conflict with dedicated columns", () => {
    expect(
      parseTaxonomySheet(sheet('{"containerPath":"Elsewhere"}'), options),
    ).toMatchObject({
      success: false,
      issues: [{ path: "rows[2].Metadata.containerPath" }],
    });
    expect(
      parseTaxonomySheet(
        sheet('{"containerPath":"Dead Suns Adaptation/Chapter 1"}'),
        options,
      ).success,
    ).toBe(true);
    expect(
      parseTaxonomySheet(
        sheet('{"containerPath":"Metadata folder"}', "BAT", ""),
        options,
      ).success,
    ).toBe(true);
  });
  test.each([
    "walls: [invalid]",
    "walls: [1,2",
    "notes: 'unfinished",
    "field: 1, field: 2",
    ": value",
    "syrinscape sound id: 1, syrinscapeSoundID: 2",
  ])("rejects malformed metadata or invalid known fields: %s", (metadata) => {
    expect(parseTaxonomySheet(sheet(metadata), options).success).toBe(false);
  });
  test("future geometry changes affect fingerprints without a schema update", async () => {
    const result = parseTaxonomySheet(
      sheet(JSON.stringify(composition)),
      options,
    );
    if (!result.success) throw new Error(JSON.stringify(result.issues));
    const scene = result.config.artifacts[0];
    if (!scene) throw new Error("Missing scene.");
    expect(await fingerprintArtifact(scene)).not.toBe(
      await fingerprintArtifact({
        ...scene,
        metadata: {
          ...scene.metadata,
          walls: [{ coordinates: [0, 10, 300, 10] }],
        },
      }),
    );
  });
  test.each([
    undefined,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    BigInt(1),
    () => 1,
    new Date(),
    new Map(),
    [undefined],
  ])("rejects non-JSON custom values: %s", (value) => {
    expect(
      parseAdaptationConfig({
        ...options,
        artifacts: [
          {
            kind: "scene",
            taxonomyId: "DS-BAT-01.01.02.00",
            name: "Scene",
            metadata: { custom: value },
          },
        ],
      }).success,
    ).toBe(false);
  });
  test("reports circular metadata instead of overflowing", () => {
    const metadata: Record<string, unknown> = {};
    metadata.loop = metadata;
    const result = parseAdaptationConfig({
      ...options,
      artifacts: [
        {
          kind: "scene",
          taxonomyId: "DS-BAT-01.01.02.00",
          name: "Scene",
          metadata,
        },
      ],
    });
    expect(result).toMatchObject({
      success: false,
      issues: [
        {
          path: "artifacts[0].metadata.loop.loop",
          message: "Metadata must not contain circular references.",
        },
      ],
    });
  });
});
