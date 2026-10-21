import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { mapArtifactToFoundry } from "../src/foundry/map-artifact.ts";
import { parseTaxonomySheet } from "../src/ingestion/parse-taxonomy.ts";

const input = readFileSync(
  new URL("./fixtures/taxonomy-ownership.tsv", import.meta.url),
  "utf8",
);
const options = { campaign: "DS", title: "Dead Suns Adaptation" };

describe("agreed JPG ownership from the supplied taxonomy", () => {
  test("maps every supplied page pattern to an embedded Foundry page in its indexed journal", () => {
    const result = parseTaxonomySheet(input, options);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error(JSON.stringify(result.issues));
    const pages = result.config.artifacts.filter(
      (artifact) => artifact.kind === "journalPage",
    );
    expect(pages).toHaveLength(8);
    for (const page of pages) {
      const expectedParent = page.taxonomyId.startsWith("DS-JPG-08.03.")
        ? "DS-JRN-08.03.01.00"
        : page.taxonomyId.replace("-JPG-", "-JRN-").replace(/\.\d{2}$/, ".00");
      expect(page.journal.taxonomyId).toBe(expectedParent);
      expect(mapArtifactToFoundry(page, "test-fingerprint")).toMatchObject({
        documentName: "JournalEntryPage",
        parentTaxonomyId: expectedParent,
      });
    }
    const absalom = pages.find(
      (page) => page.taxonomyId === "DS-JPG-08.03.02.00",
    );
    if (!absalom) throw new Error("Missing Absalom Station page.");
    expect(
      mapArtifactToFoundry(absalom, "test-fingerprint").journalContentSource,
    ).toBe("assets/journals/pages/absalom-station.md");
  });
  test("prefers an exact three-segment journal even when the two-segment group has several journals", () => {
    const extraJournal =
      "DS-JRN-08.03.02.00\tDS\tJRN\t08.03.02.00\tAdditional journal\t\tDead Suns Adaptation/Miscellaneous\tMiscellaneous\tLocations\t\tInitial";
    const result = parseTaxonomySheet(input + "\n" + extraJournal, options);
    expect(result.success).toBe(false);
    if (result.success)
      throw new Error("Other Locations pages must now be ambiguous.");
    expect(
      result.issues.some((issue) => issue.path === "rows[3].journal"),
    ).toBe(false);
    expect(
      result.issues.some((issue) => issue.path === "rows[4].journal"),
    ).toBe(true);
  });
  test("explicit ownership mode requires owners and accepts a complete mapping", () => {
    const inferred = parseTaxonomySheet(input, options);
    if (!inferred.success) throw new Error(JSON.stringify(inferred.issues));
    const owners = Object.fromEntries<string>(
      inferred.config.artifacts.flatMap((artifact) =>
        artifact.kind === "journalPage"
          ? [[artifact.taxonomyId, artifact.journal.taxonomyId] as const]
          : [],
      ),
    );
    expect(
      parseTaxonomySheet(input, { ...options, journalOwnership: "explicit" })
        .success,
    ).toBe(false);
    expect(
      parseTaxonomySheet(input, {
        ...options,
        journalOwnership: "explicit",
        owners,
      }),
    ).toEqual(inferred);
  });
});
