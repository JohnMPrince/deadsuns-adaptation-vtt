import { describe, expect, test } from "vitest";
import { parseAdaptationConfigJson } from "../src/domain/index.ts";
import { parseDelimitedSheet } from "../src/ingestion/parse-delimited.ts";
import {
  parseTaxonomyRows,
  parseTaxonomySheet,
} from "../src/ingestion/parse-taxonomy.ts";

const headers = [
  "Taxonomy ID",
  "Campaign",
  "Taxonomy Code",
  "Index",
  "Artifact Name",
  "Asset Path",
  "Container Path",
  "Chapter",
  "Part",
  "Metadata",
  "Dataset",
];
const options = { campaign: "DS", title: "Dead Suns Adaptation" };
function row(
  code: string,
  index: string,
  name = "Example",
  asset = "",
  metadata = "",
  dataset = "Initial",
) {
  return [
    `DS-${code}-${index}`,
    "DS",
    code,
    index,
    name,
    asset,
    "Dead Suns Adaptation/Miscellaneous",
    "Miscellaneous",
    "Locations",
    metadata,
    dataset,
  ];
}
function sheet(rows: readonly string[][], delimiter: "\t" | "," = "\t") {
  return [headers, ...rows]
    .map((cells) =>
      cells
        .map((cell) =>
          /["\r\n\t,]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell,
        )
        .join(delimiter),
    )
    .join("\r\n");
}

describe("taxonomy spreadsheet mapping", () => {
  test("maps reordered columns, metadata and multiline assets into import-ready JSON", () => {
    const cells = row(
      "NPC",
      "01.01.01.00",
      "Example actor",
      "portrait: assets/My Actor.webp\r\n\r\ntoken: assets/token.webp",
    );
    const result = parseTaxonomyRows(
      [
        { row: 1, cells: [...headers].reverse() },
        { row: 2, cells: [...cells].reverse() },
      ],
      options,
    );
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected valid sheet.");
    expect(result.config.artifacts[0]).toEqual({
      kind: "actor",
      taxonomyId: "DS-NPC-01.01.01.00",
      name: "Example actor",
      assets: [
        { role: "portrait", path: "assets/My Actor.webp" },
        { role: "token", path: "assets/token.webp" },
      ],
      metadata: {
        containerPath: "Dead Suns Adaptation/Miscellaneous",
        chapter: "Miscellaneous",
        part: "Locations",
      },
    });
    expect(parseAdaptationConfigJson(result.json)).toEqual({
      success: true,
      config: result.config,
    });
  });
  test("derives owners for both page patterns independent of row order", () => {
    const result = parseTaxonomySheet(
      sheet([
        row("JPG", "01.01.01.01"),
        row(
          "JPG",
          "08.03.02.00",
          "Absalom Station",
          "markdown: assets/journals/pages/absalom-station.md",
        ),
        row("JRN", "08.03.01.00", "Locations"),
        row("JRN", "01.01.01.00", "Part I"),
      ]),
      options,
    );
    expect(result).toMatchObject({
      success: true,
      config: {
        artifacts: [
          { journal: { taxonomyId: "DS-JRN-01.01.01.00" }, markdown: "" },
          {
            journal: { taxonomyId: "DS-JRN-08.03.01.00" },
            assets: [
              {
                role: "content",
                path: "assets/journals/pages/absalom-station.md",
              },
            ],
          },
          {},
          {},
        ],
      },
    });
  });
  test("maps audio source and playlist ownership", () => {
    expect(
      parseTaxonomySheet(
        sheet([
          row(
            "AUD",
            "08.15.01.01",
            "Approaching",
            "audio: assets/approaching.ogg",
          ),
          row("PLY", "08.15.01.00"),
        ]),
        options,
      ),
    ).toMatchObject({
      success: true,
      config: {
        artifacts: [
          {
            source: "assets/approaching.ogg",
            playlist: { taxonomyId: "DS-PLY-08.15.01.00" },
          },
          {},
        ],
      },
    });
  });
  test("rejects blank audio paths without inventing a source or returning JSON", () => {
    const result = parseTaxonomySheet(
      sheet([row("PLY", "08.15.01.00"), row("AUD", "08.15.01.01")]),
      options,
    );
    expect(result).toMatchObject({
      success: false,
      issues: [{ path: "rows[3].source" }],
    });
    expect(result).not.toHaveProperty("json");
  });
  test("rejects ambiguous owners and allows explicit overrides", () => {
    const input = sheet([
      row("JRN", "08.09.01.00"),
      row("JRN", "08.09.02.00"),
      row("JPG", "08.09.04.00"),
    ]);
    expect(parseTaxonomySheet(input, options)).toMatchObject({
      success: false,
      issues: arrayContaining([
        expect.objectContaining({
          path: "rows[4].journal",
          message: stringContaining("ambiguous"),
        }),
      ]),
    });
    expect(
      parseTaxonomySheet(input, {
        ...options,
        owners: { "DS-JPG-08.09.04.00": "DS-JRN-08.09.02.00" },
      }).success,
    ).toBe(true);
  });
  test("validates explicit owner kind and existence", () => {
    const input = sheet([row("JPG", "01.01.01.01"), row("PLY", "01.01.01.00")]);
    for (const owner of ["DS-JRN-01.01.01.00", "DS-PLY-01.01.01.00"]) {
      expect(
        parseTaxonomySheet(input, {
          ...options,
          owners: { "DS-JPG-01.01.01.01": owner },
        }),
      ).toMatchObject({
        success: false,
        issues: arrayContaining([
          expect.objectContaining({ path: "rows[2].journal" }),
        ]),
      });
    }
  });
  test("filters Dataset before domain validation without copying it into metadata", () => {
    const input = sheet([
      row("JRN", "01.01.01.00"),
      row("JPG", "01.01.01.01", "Excluded", "bad asset", "", "Later"),
    ]);
    const result = parseTaxonomySheet(input, {
      ...options,
      dataset: "Initial",
    });
    expect(result).toMatchObject({
      success: true,
      config: { artifacts: [{ kind: "journal" }] },
    });
    if (!result.success) throw new Error("Expected valid filtered sheet.");
    expect(result.config.artifacts).toHaveLength(1);
    expect(result.json).not.toContain("dataset");
  });
  test.each(["Campaign", "Taxonomy Code", "Index"])(
    "rejects inconsistent %s",
    (column) => {
      const cells = row("NPC", "01.01.01.00");
      cells[headers.indexOf(column)] = "wrong";
      expect(parseTaxonomySheet(sheet([cells]), options)).toMatchObject({
        success: false,
        issues: arrayContaining([
          expect.objectContaining({ path: `rows[2].${column}` }),
        ]),
      });
    },
  );
  test.each(["missing", "duplicate", "unknown"])(
    "rejects %s headers",
    (type) => {
      const cells =
        type === "missing"
          ? headers.slice(1)
          : [...headers, type === "duplicate" ? "Taxonomy ID" : "Mystery"];
      expect(parseTaxonomySheet(cells.join("\t"), options).success).toBe(false);
    },
  );
  test("rejects duplicate IDs and campaign mismatches using existing validation", () => {
    const input = sheet([row("NPC", "01.01.01.00"), row("NPC", "01.01.01.00")]);
    expect(parseTaxonomySheet(input, options)).toMatchObject({
      success: false,
      issues: arrayContaining([
        expect.objectContaining({ path: "rows[3].taxonomyId" }),
      ]),
    });
    expect(
      parseTaxonomySheet(sheet([row("NPC", "01.01.01.00")]), {
        ...options,
        campaign: "OTHER",
      }).success,
    ).toBe(false);
  });
  test("reports malformed assets and unsupported Metadata at source rows", () => {
    expect(
      parseTaxonomySheet(
        sheet([row("NPC", "01.01.01.00", "Bad", "portrait:")]),
        options,
      ),
    ).toMatchObject({
      success: false,
      issues: [
        {
          path: "rows[2].Asset Path",
          message: stringContaining("line 1"),
        },
      ],
    });
    expect(
      parseTaxonomySheet(
        sheet([
          row("NPC", "01.01.01.00", "Bad", "", "syrinscape sound id: TBA"),
        ]),
        options,
      ),
    ).toMatchObject({ success: false, issues: [{ path: "rows[2].Metadata" }] });
  });
  test("skips blank rows, omits empty assets, and reports malformed widths", () => {
    expect(
      parseTaxonomySheet(headers.join("\t") + "\n\nshort", options),
    ).toMatchObject({ success: false, issues: [{ path: "rows[3]" }] });
    const result = parseTaxonomySheet(
      sheet([row("NPC", "01.01.01.00")]) + "\n\n",
      options,
    );
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected valid sheet.");
    expect(result.config.artifacts[0]).not.toHaveProperty("assets");
  });
  test("supports CSV exports and UTF-8 BOM", () => {
    expect(
      parseTaxonomySheet(
        "\uFEFF" + sheet([row("NPC", "01.01.01.00", 'Actor, "Example"')], ","),
        { ...options, delimiter: "," },
      ),
    ).toMatchObject({
      success: true,
      config: { artifacts: [{ name: 'Actor, "Example"' }] },
    });
  });
});

describe("delimited spreadsheet syntax", () => {
  test.each(["\n", "\r", "\r\n"])(
    "preserves quoted multiline cells with %j",
    (newline) => {
      expect(
        parseDelimitedSheet(
          `A\tB${newline}"hello${newline}world"\t"a""b"${newline}end\t`,
          "\t",
        ),
      ).toEqual({
        success: true,
        rows: [
          { row: 1, cells: ["A", "B"] },
          { row: 2, cells: [`hello${newline}world`, 'a"b'] },
          { row: 4, cells: ["end", ""] },
        ],
      });
    },
  );
  test.each(['"unterminated', 'un"expected', '"closed"oops', '"closed""'])(
    "rejects malformed quoting: %s",
    (input) => {
      expect(parseDelimitedSheet(input, "\t")).toMatchObject({
        success: false,
        issues: [{ path: "rows[1]" }],
      });
    },
  );
});

function arrayContaining(entries: unknown[]): unknown {
  return expect.arrayContaining(entries);
}
function stringContaining(text: string): unknown {
  return expect.stringContaining(text);
}
