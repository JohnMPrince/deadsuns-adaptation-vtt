import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import { parseAdaptationConfigJson } from "../src/domain/parse-serialized-config.ts";
import { readTaxonomyFile } from "../src/ingestion/read-taxonomy-file.ts";

const options = { campaign: "DS", title: "Workbook example" };
const workbook = fileURLToPath(
  new URL("./fixtures/taxonomy-workbook.xlsx", import.meta.url),
);
const ambiguous = fileURLToPath(
  new URL("./fixtures/ambiguous-workbook.xlsx", import.meta.url),
);
const tsv = fileURLToPath(
  new URL("./fixtures/taxonomy-ownership.tsv", import.meta.url),
);
const cli = fileURLToPath(
  new URL("../src/ingestion/taxonomy-cli.ts", import.meta.url),
);
const temporary: string[] = [];
async function directory() {
  const path = await mkdtemp(join(tmpdir(), "dac25-test-"));
  temporary.push(path);
  return path;
}
afterEach(async () => {
  for (const path of temporary.splice(0))
    await rm(path, { recursive: true, force: true });
});

describe("native taxonomy workbook adapter", () => {
  test("selects Taxonomy and preserves sparse cells, multiline values and owners", async () => {
    const result = await readTaxonomyFile(workbook, options);
    if (!result.success) throw new Error(JSON.stringify(result.issues));
    expect(result.config.artifacts).toHaveLength(4);
    expect(result.config.artifacts[1]).toMatchObject({
      kind: "journalPage",
      journal: { taxonomyId: "DS-JRN-01.01.01.00" },
      assets: [{ role: "content", path: "assets/pages/docking-bay.md" }],
    });
    expect(result.config.artifacts[3]).toMatchObject({
      kind: "playlistSound",
      playlist: { taxonomyId: "DS-PLY-01.01.03.00" },
      assets: [
        { role: "audio", path: "assets/example.ogg" },
        { role: "custom", path: "assets/second.ogg" },
      ],
      metadata: { syrinscapeSoundID: 123456, syrinscapeSoundType: "Element" },
    });
    expect(parseAdaptationConfigJson(result.json)).toEqual({
      success: true,
      config: result.config,
    });
    expect(
      await readTaxonomyFile(workbook, { ...options, sheet: "Taxonomy" }),
    ).toEqual(result);
  });
  test("requires an explicit choice for ambiguous workbooks", async () => {
    expect(await readTaxonomyFile(ambiguous, options)).toMatchObject({
      success: false,
      issues: [{ path: "sheet" }],
    });
    expect(
      (await readTaxonomyFile(ambiguous, { ...options, sheet: "Second" }))
        .success,
    ).toBe(true);
  });
  test("reports missing worksheet names", async () => {
    expect(
      await readTaxonomyFile(workbook, { ...options, sheet: "Missing" }),
    ).toMatchObject({ success: false, issues: [{ path: "sheet" }] });
  });
  test("rejects numeric cells and retains physical source row numbers", async () => {
    expect(
      await readTaxonomyFile(workbook, { ...options, sheet: "Invalid" }),
    ).toMatchObject({
      success: false,
      issues: [{ path: 'sheets["Invalid"].rows[3].columns[4]' }],
    });
  });
  test("prefixes domain errors with the worksheet", async () => {
    const result = await readTaxonomyFile(workbook, {
      ...options,
      campaign: "OTHER",
    });
    if (result.success) throw new Error("Expected campaign errors.");
    expect(result.issues.map((issue) => issue.path)).toContain(
      'sheets["Taxonomy"].rows[4].taxonomyId',
    );
  });
  test("reports corrupt, missing and unsupported files without throwing", async () => {
    const path = join(await directory(), "broken.xlsx");
    await writeFile(path, "not a workbook");
    for (const input of [
      path,
      path + ".missing",
      path.replace("broken", "missing"),
    ]) {
      expect(await readTaxonomyFile(input, options)).toMatchObject({
        success: false,
        issues: [{ path: "input" }],
      });
    }
  });
  test("reads exports and rejects worksheet selection for them", async () => {
    expect((await readTaxonomyFile(tsv, options)).success).toBe(true);
    expect(
      await readTaxonomyFile(tsv, { ...options, sheet: "Taxonomy" }),
    ).toMatchObject({ success: false, issues: [{ path: "sheet" }] });
  });
});

describe("standalone taxonomy command", () => {
  function run(args: string[]) {
    return spawnSync(
      process.execPath,
      ["--experimental-strip-types", cli, ...args],
      { encoding: "utf8" },
    );
  }
  test("writes validated workbook JSON and refuses to overwrite output", async () => {
    const output = join(await directory(), "config.json");
    const args = [
      workbook,
      output,
      "DS",
      "Audio and journal test",
      "Initial",
      "--sheet",
      "Taxonomy",
    ];
    const first = run(args);
    expect(first.status, first.stderr).toBe(0);
    const text = await readFile(output, "utf8");
    expect(parseAdaptationConfigJson(text).success).toBe(true);
    expect(run(args).status).toBe(1);
    expect(await readFile(output, "utf8")).toBe(text);
  });
  test("reports validation errors without creating JSON", async () => {
    const output = join(await directory(), "invalid.json");
    const result = run([workbook, output, "DS", "Test", "--sheet", "Invalid"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('sheets["Invalid"].rows[3].columns[4]');
    await expect(readFile(output)).rejects.toThrow();
  });
  test("does not modify the source when input and output match", async () => {
    const input = join(await directory(), "source.tsv");
    const original = await readFile(tsv);
    await writeFile(input, original);
    expect(run([input, input, "DS", "Test"]).status).toBe(1);
    expect(await readFile(input)).toEqual(original);
  });
  test.each([
    { extra: ["--sheet"] },
    { extra: ["--unknown"] },
    { extra: ["--sheet", "Taxonomy", "--sheet", "Other"] },
  ])("rejects invalid options: %j", ({ extra }) => {
    const result = run([workbook, "output.json", "DS", "Test", ...extra]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Usage:");
  });
});
