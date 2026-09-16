import { describe, expect, test } from "vitest";
import { deadSunsContainerPaths } from "../src/config/dead-suns-containers.ts";
import {
  parseContainerPath,
  resolveContainerHierarchy,
  taxonomyId,
  validateConfig,
  type AdaptationConfig,
  type AdaptationArtifactDefinition,
} from "../src/domain/index.ts";
import {
  InvalidAdaptationConfigError,
  planImport,
} from "../src/import/plan-import.ts";
import { fingerprintArtifact } from "../src/import/fingerprint.ts";

function config(
  ...artifacts: AdaptationArtifactDefinition[]
): AdaptationConfig {
  return { campaign: "DS", title: "Dead Suns", artifacts };
}
function scene(path?: string): AdaptationArtifactDefinition {
  return {
    kind: "scene",
    taxonomyId: taxonomyId("DS-BAT-01.01.01.00", "BAT"),
    name: "Battle",
    ...(path === undefined ? {} : { metadata: { containerPath: path } }),
  };
}

describe("category-scoped path hierarchy", () => {
  test("supports unassigned artifacts and an empty configuration", () => {
    expect(resolveContainerHierarchy(config())).toEqual([]);
    expect(resolveContainerHierarchy(config(scene()))).toEqual([]);
  });
  test("resolves a root and accepts a single trailing slash", () => {
    expect(
      resolveContainerHierarchy(config(scene("Dead Suns Adaptation/"))),
    ).toEqual([
      {
        category: "scene",
        name: "Dead Suns Adaptation",
        path: "Dead Suns Adaptation",
      },
    ]);
  });
  test("derives arbitrary parents in parent-first order without mutation", () => {
    const input = config(scene("Campaign/Chapter/Part/Area/Room"));
    const before = structuredClone(input);
    expect(validateConfig(input)).toEqual([]);
    const hierarchy = resolveContainerHierarchy(input);
    expect(hierarchy.map((container) => container.path)).toEqual([
      "Campaign",
      "Campaign/Chapter",
      "Campaign/Chapter/Part",
      "Campaign/Chapter/Part/Area",
      "Campaign/Chapter/Part/Area/Room",
    ]);
    expect(hierarchy[4]).toEqual({
      category: "scene",
      name: "Room",
      path: "Campaign/Chapter/Part/Area/Room",
      parentPath: "Campaign/Chapter/Part/Area",
    });
    expect(resolveContainerHierarchy(input)).toEqual(hierarchy);
    expect(input).toEqual(before);
    expect(
      resolveContainerHierarchy(
        config(
          scene(
            Array.from({ length: 100 }, (_, i) => `Level ${String(i)}`).join(
              "/",
            ),
          ),
        ),
      ),
    ).toHaveLength(100);
  });
  test("deduplicates paths across scene subtypes, including parent references", () => {
    const input = config(
      scene("Campaign/Chapter"),
      {
        kind: "scene",
        taxonomyId: taxonomyId("DS-CIN-01.01.02.00", "CIN"),
        name: "Cinematic",
        metadata: { containerPath: "Campaign/Chapter/" },
      },
      {
        kind: "scene",
        taxonomyId: taxonomyId("DS-REG-01.01.03.00", "REG"),
        name: "Region",
        metadata: { containerPath: "Campaign" },
      },
    );
    expect(validateConfig(input)).toEqual([]);
    expect(resolveContainerHierarchy(input)).toHaveLength(2);
  });
  test("separates Scene and Playlist trees at identical paths", () => {
    const hierarchy = resolveContainerHierarchy(
      config(scene("Campaign/Chapter"), {
        kind: "playlist",
        taxonomyId: taxonomyId("DS-PLY-01.01.01.00", "PLY"),
        name: "Music",
        metadata: { containerPath: "Campaign/Chapter" },
      }),
    );
    expect(hierarchy.map(({ category, path }) => [category, path])).toEqual([
      ["scene", "Campaign"],
      ["scene", "Campaign/Chapter"],
      ["playlist", "Campaign"],
      ["playlist", "Campaign/Chapter"],
    ]);
  });
  test("supports every top-level category without Foundry classes", () => {
    const hierarchy = resolveContainerHierarchy(
      config(
        scene("Root"),
        {
          kind: "actor",
          taxonomyId: taxonomyId("DS-NPC-01.01.01.00", "NPC"),
          name: "Actor",
          metadata: { containerPath: "Root" },
        },
        {
          kind: "journal",
          taxonomyId: taxonomyId("DS-JRN-01.01.01.00", "JRN"),
          name: "Journal",
          metadata: { containerPath: "Root" },
        },
        {
          kind: "handout",
          taxonomyId: taxonomyId("DS-HND-01.01.01.00", "HND"),
          name: "Handout",
          metadata: { containerPath: "Root" },
        },
        {
          kind: "item",
          taxonomyId: taxonomyId("DS-ITM-01.01.01.00", "ITM"),
          name: "Item",
          metadata: { containerPath: "Root" },
        },
        {
          kind: "rollTable",
          taxonomyId: taxonomyId("DS-TBL-01.01.01.00", "TBL"),
          name: "Table",
          metadata: { containerPath: "Root" },
        },
        {
          kind: "playlist",
          taxonomyId: taxonomyId("DS-PLY-01.01.01.00", "PLY"),
          name: "Playlist",
          metadata: { containerPath: "Root" },
        },
        {
          kind: "macro",
          taxonomyId: taxonomyId("DS-MAC-01.01.01.00", "MAC"),
          name: "Macro",
          metadata: { containerPath: "Root" },
        },
      ),
    );
    expect(hierarchy.map((entry) => entry.category)).toEqual([
      "scene",
      "actor",
      "journal",
      "handout",
      "item",
      "rollTable",
      "playlist",
      "macro",
    ]);
  });
  test.each([
    "",
    "/",
    "/Root",
    "Root//Child",
    "Root//",
    " Root",
    "Root ",
    "Root/ /Child",
    "Root/./Child",
    "Root/../Child",
    "Root\\Child",
    "Root/Bad\nName",
    "Root/Bad\u0000Name",
    "Root/Bad\u007fName",
  ])("rejects invalid path %j before import", async (path) => {
    const input = config(scene(path));
    expect(validateConfig(input)).toEqual([
      expect.objectContaining({ path: "artifacts[0].metadata.containerPath" }),
    ]);
    expect(() => parseContainerPath(path)).toThrow();
    expect(() => resolveContainerHierarchy(input)).toThrow();
    await expect(planImport(input, [])).rejects.toBeInstanceOf(
      InvalidAdaptationConfigError,
    );
  });
  test("preserves case, Unicode, and meaningful internal spaces", () => {
    expect(parseContainerPath("Dead Suns/Éléments/Room  One")).toEqual([
      "Dead Suns",
      "Éléments",
      "Room  One",
    ]);
    expect(
      resolveContainerHierarchy(
        config(scene("Root"), {
          kind: "playlist",
          taxonomyId: taxonomyId("DS-PLY-01.01.01.00", "PLY"),
          name: "Music",
          metadata: { containerPath: "root" },
        }),
      ).map((entry) => entry.path),
    ).toEqual(["Root", "root"]);
  });
  test.each(["journal", "playlist"] as const)(
    "embedded children inherit %s placement",
    (kind) => {
      const parent: AdaptationArtifactDefinition =
        kind === "journal"
          ? {
              kind,
              taxonomyId: taxonomyId("DS-JRN-01.01.01.00", "JRN"),
              name: "Parent",
              metadata: { containerPath: "Root/Child" },
            }
          : {
              kind,
              taxonomyId: taxonomyId("DS-PLY-01.01.01.00", "PLY"),
              name: "Parent",
              metadata: { containerPath: "Root/Child" },
            };
      const child: AdaptationArtifactDefinition =
        kind === "journal"
          ? {
              kind: "journalPage",
              taxonomyId: taxonomyId("DS-JPG-01.01.01.01", "JPG"),
              name: "Page",
              journal: { taxonomyId: taxonomyId("DS-JRN-01.01.01.00", "JRN") },
              markdown: "",
            }
          : {
              kind: "playlistSound",
              taxonomyId: taxonomyId("DS-AUD-01.01.01.01", "AUD"),
              name: "Sound",
              playlist: { taxonomyId: taxonomyId("DS-PLY-01.01.01.00", "PLY") },
              source: "sound.ogg",
            };
      for (const metadata of [undefined, { containerPath: "Root/Child/" }]) {
        const input = config(parent, {
          ...child,
          ...(metadata ? { metadata } : {}),
        });
        expect(validateConfig(input)).toEqual([]);
        expect(resolveContainerHierarchy(input)).toHaveLength(2);
      }
      expect(
        validateConfig(
          config(parent, { ...child, metadata: { containerPath: "Other" } }),
        ),
      ).toEqual([
        expect.objectContaining({
          path: "artifacts[1].metadata.containerPath",
        }),
      ]);
    },
  );
  test("a path move retains taxonomy identity and triggers an import update", async () => {
    const original = scene("Root/Old");
    const fingerprint = await fingerprintArtifact(original);
    const result = await planImport(config(scene("Root/New")), [
      {
        taxonomyId: original.taxonomyId,
        foundryUuid: "Scene.example",
        importedFingerprint: fingerprint,
        documentFingerprint: fingerprint,
      },
    ]);
    expect(result.entries[0]).toMatchObject({
      taxonomyId: original.taxonomyId,
      action: "update",
    });
  });
  test("retains the five suggested authoring paths without forcing all categories to use them", () => {
    expect(Object.values(deadSunsContainerPaths)).toEqual([
      "Dead Suns Adaptation",
      "Dead Suns Adaptation/Miscellaneous",
      "Dead Suns Adaptation/Locations",
      "Dead Suns Adaptation/Elements",
      "Dead Suns Adaptation/Chapter 1",
    ]);
    expect(
      resolveContainerHierarchy(
        config(scene(deadSunsContainerPaths.locations)),
      ),
    ).toHaveLength(2);
  });
});
