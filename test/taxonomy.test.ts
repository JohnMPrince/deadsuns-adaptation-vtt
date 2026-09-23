import { describe, expect, test } from "vitest";

import {
  artifactCodeDefinitions,
  artifactCodes,
  parseTaxonomyId,
  taxonomyId,
} from "../src/domain/index.ts";

describe("artifact code catalogue", () => {
  test("contains every expected adaptation artifact code", () => {
    expect(artifactCodes).toEqual([
      "CIN",
      "BAT",
      "REG",
      "SOC",
      "NPC",
      "AA",
      "SA",
      "JRN",
      "JPG",
      "HND",
      "ITM",
      "TBL",
      "PLY",
      "AUD",
      "MAC",
    ]);
  });

  test("maps every code to its domain kind and subcategory", () => {
    expect(artifactCodeDefinitions).toEqual({
      CIN: { kind: "scene", subcategory: "cinematic" },
      BAT: { kind: "scene", subcategory: "battleMap" },
      REG: { kind: "scene", subcategory: "regionalMap" },
      SOC: { kind: "scene", subcategory: "socialMap" },
      NPC: {
        kind: "actor",
        subcategory: "nonPlayerCharacter",
      },
      AA: { kind: "actor", subcategory: "alienArchive" },
      SA: {
        kind: "actor",
        subcategory: "starshipArchive",
      },
      JRN: {
        kind: "journal",
        subcategory: "entry",
      },
      JPG: {
        kind: "journalPage",
        subcategory: "page",
      },
      HND: { kind: "handout", subcategory: null },
      ITM: { kind: "item", subcategory: null },
      TBL: { kind: "rollTable", subcategory: null },
      PLY: { kind: "playlist", subcategory: null },
      AUD: {
        kind: "playlistSound",
        subcategory: null,
      },
      MAC: { kind: "macro", subcategory: null },
    });
  });
});

describe("taxonomy IDs", () => {
  test("parses the campaign, artifact code, and hierarchical index", () => {
    expect(parseTaxonomyId("DS-JPG-08.03.01.01")).toEqual({
      value: "DS-JPG-08.03.01.01",
      campaign: "DS",
      artifactCode: "JPG",
      index: ["08", "03", "01", "01"],
    });
  });

  test("rejects malformed and unsupported identifiers", () => {
    expect(() => taxonomyId("ds-JRN-08.01.01.00")).toThrow(
      /Invalid taxonomy ID/,
    );
    expect(() => taxonomyId("DS-XYZ-08.01.01.00")).toThrow(
      /Unsupported artifact code/,
    );
    expect(() => taxonomyId("DS-JRN-8.1.1.0")).toThrow(/Invalid taxonomy ID/);
  });

  test("can enforce an expected artifact code", () => {
    expect(() => taxonomyId("DS-JPG-08.03.01.01", "JRN")).toThrow(
      /uses JPG; expected JRN/,
    );
  });
});
