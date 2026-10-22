import { expect, test, vi } from "vitest";
import { moduleApi } from "../src/foundry/lifecycle.ts";
import {
  executeTaxonomyJson as importTaxonomyJson,
  importTaxonomyJson as consoleImport,
} from "../src/foundry/import-taxonomy-json.ts";
import { parseTaxonomySheet } from "../src/ingestion/parse-taxonomy.ts";
import type { ExistingArtifactState } from "../src/import/plan-import.ts";
import type { MappedFoundryArtifact } from "../src/foundry/map-artifact.ts";

function gateway() {
  const existing: ExistingArtifactState[] = [];
  return {
    existing,
    listExistingArtifacts: vi.fn(() => Promise.resolve(existing)),
    ensureContainer: vi.fn(() => Promise.resolve()),
    createArtifact: vi.fn((artifact: MappedFoundryArtifact) => {
      const flags = artifact.data.flags as Record<
        string,
        Record<string, string>
      >;
      const fingerprint =
        flags["deadsuns-adaptation-vtt"]?.importedFingerprint ?? "";
      existing.push({
        taxonomyId: artifact.taxonomyId as ExistingArtifactState["taxonomyId"],
        foundryUuid: `Actor.${artifact.taxonomyId}`,
        importedFingerprint: fingerprint,
        documentFingerprint: fingerprint,
      });
      return Promise.resolve();
    }),
  };
}
const config = {
  campaign: "DS",
  title: "Example",
  artifacts: [
    { kind: "actor", taxonomyId: "DS-NPC-01.01.01.00", name: "Example" },
  ],
};

test("exposes console entry point", () => {
  expect(moduleApi.importTaxonomyJson).toBe(consoleImport);
});
test.each([
  ["{", "syntax"],
  ["{}", "structure"],
  [JSON.stringify({ ...config, campaign: "OTHER" }), "semantic"],
])("rejects invalid JSON before world access: %s", async (json, stage) => {
  const host = gateway();
  await expect(importTaxonomyJson(json, host)).rejects.toMatchObject({
    name: "TaxonomyJsonValidationError",
    stage,
    issues: expect.arrayContaining([
      expect.objectContaining({
        path: expect.any(String) as unknown,
        message: expect.any(String) as unknown,
      }) as unknown,
    ]) as unknown,
  });
  expect(host.listExistingArtifacts).not.toHaveBeenCalled();
  expect(host.ensureContainer).not.toHaveBeenCalled();
  expect(host.createArtifact).not.toHaveBeenCalled();
});
test("rejects decoded objects", async () => {
  await expect(importTaxonomyJson(config as unknown as string)).rejects.toThrow(
    "JSON string",
  );
});
test("imports DAC-25 output, skips repeats, and rejects changed content", async () => {
  const parsed = parseTaxonomySheet(
    "Taxonomy ID\tCampaign\tTaxonomy Code\tIndex\tArtifact Name\tContainer Path\nDS-NPC-01.01.01.00\tDS\tNPC\t01.01.01.00\tExample\tDead Suns/Actors",
    { campaign: "DS", title: "Example" },
  );
  if (!parsed.success) throw new Error(JSON.stringify(parsed.issues));
  const host = gateway();
  expect(await importTaxonomyJson(parsed.json, host)).toMatchObject({
    created: 1,
    unchanged: 0,
  });
  const folders = host.ensureContainer.mock.calls.length;
  expect(await importTaxonomyJson(parsed.json, host)).toMatchObject({
    created: 0,
    unchanged: 1,
  });
  expect(host.ensureContainer).toHaveBeenCalledTimes(folders);
  const changed = {
    ...parsed.config,
    artifacts: parsed.config.artifacts.map((a) => ({ ...a, name: "Changed" })),
  };
  await expect(
    importTaxonomyJson(JSON.stringify(changed), host),
  ).rejects.toThrow("only metadata updates");
  expect(host.createArtifact).toHaveBeenCalledTimes(1);
});
test("preserves runtime errors and resumes partial imports", async () => {
  const host = gateway();
  const json = JSON.stringify({
    ...config,
    artifacts: [
      ...config.artifacts,
      { ...config.artifacts[0], taxonomyId: "DS-NPC-01.01.02.00" },
    ],
  });
  const failure = new Error("Foundry creation failed");
  const create = host.createArtifact.getMockImplementation();
  if (!create) throw new Error("Missing creation implementation");
  host.createArtifact
    .mockImplementationOnce(create)
    .mockRejectedValueOnce(failure);
  await expect(importTaxonomyJson(json, host)).rejects.toBe(failure);
  expect(host.existing).toHaveLength(1);
  expect(await importTaxonomyJson(json, host)).toMatchObject({
    created: 1,
    unchanged: 1,
  });
  expect(host.existing).toHaveLength(2);
});

test("console call uses the default Foundry gateway", async () => {
  const actors: unknown[] = [];
  const create = vi.fn((data: Record<string, unknown>) => {
    const document = { id: "example", uuid: "Actor.example", ...data };
    actors.push(document);
    return Promise.resolve(document);
  });
  vi.stubGlobal("game", {
    user: { isGM: true },
    actors,
    items: [],
    scenes: [],
    journal: [],
    playlists: [],
    folders: [],
  });
  vi.stubGlobal("Actor", { create });
  try {
    expect(
      await moduleApi.importTaxonomyJson(JSON.stringify(config)),
    ).toMatchObject({ created: 1, unchanged: 0 });
    expect(
      await moduleApi.importTaxonomyJson(JSON.stringify(config)),
    ).toMatchObject({ created: 0, unchanged: 1 });
    expect(create).toHaveBeenCalledTimes(1);
  } finally {
    vi.unstubAllGlobals();
  }
});

test("conflicts reject before folder or document writes", async () => {
  const host = gateway();
  await importTaxonomyJson(JSON.stringify(config), host);
  const first = host.existing[0];
  if (!first) throw new Error("Missing imported artifact");
  host.existing.push({ ...first, foundryUuid: "Actor.duplicate" });
  host.createArtifact.mockClear();
  await expect(
    importTaxonomyJson(JSON.stringify(config), host),
  ).rejects.toThrow("initial creation");
  expect(host.ensureContainer).not.toHaveBeenCalled();
  expect(host.createArtifact).not.toHaveBeenCalled();
});

test.each([undefined, {}, { isGM: false }])(
  "denies unauthorized console callers before world access",
  async (user) => {
    const read = vi.fn(() => {
      throw new Error("Must not access actors");
    });
    vi.stubGlobal("game", {
      user,
      get actors() {
        return read();
      },
    });
    try {
      expect(await consoleImport(JSON.stringify(config))).toMatchObject({
        success: false,
        stage: "authorization",
      });
      expect(read).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  },
);

test("console failures resolve with validation and runtime details", async () => {
  vi.stubGlobal("game", { user: { isGM: true } });
  try {
    expect(await consoleImport("{")).toMatchObject({
      success: false,
      stage: "syntax",
      errors: [{ path: "configuration" }],
    });
    expect(await consoleImport({} as string)).toMatchObject({
      success: false,
      stage: "input",
    });
    expect(await consoleImport(JSON.stringify(config))).toMatchObject({
      success: false,
      stage: "import",
    });
  } finally {
    vi.unstubAllGlobals();
  }
});
