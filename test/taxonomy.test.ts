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

  test("maps every code to its domain kind, subcategory, and Foundry target", () => {
    expect(artifactCodeDefinitions).toEqual({
      CIN: { kind: "scene", subcategory: "cinematic", foundryType: "Scene" },
      BAT: { kind: "scene", subcategory: "battleMap", foundryType: "Scene" },
      REG: { kind: "scene", subcategory: "regionalMap", foundryType: "Scene" },
      SOC: { kind: "scene", subcategory: "socialMap", foundryType: "Scene" },
      NPC: {
        kind: "actor",
        subcategory: "nonPlayerCharacter",
        foundryType: "Actor",
      },
      AA: { kind: "actor", subcategory: "alienArchive", foundryType: "Actor" },
      SA: {
        kind: "actor",
        subcategory: "starshipArchive",
        foundryType: "Actor",
      },
      JRN: {
        kind: "journal",
        subcategory: "entry",
        foundryType: "JournalEntry",
      },
      JPG: {
        kind: "journalPage",
        subcategory: "page",
        foundryType: "JournalEntryPage",
      },
      HND: { kind: "handout", subcategory: null, foundryType: null },
      ITM: { kind: "item", subcategory: null, foundryType: "Item" },
      TBL: { kind: "rollTable", subcategory: null, foundryType: "RollTable" },
      PLY: { kind: "playlist", subcategory: null, foundryType: "Playlist" },
      AUD: {
        kind: "playlistSound",
        subcategory: null,
        foundryType: "PlaylistSound",
      },
      MAC: { kind: "macro", subcategory: null, foundryType: "Macro" },
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
