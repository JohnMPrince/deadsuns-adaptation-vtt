import { describe, expect, test, vi } from "vitest";

import { dac18SampleConfig } from "../src/config/dac-18-sample.ts";
import {
  FoundryVttGateway,
  type FoundryVttRuntime,
  loadJournalContent,
} from "../src/foundry/foundry-vtt-gateway.ts";
import { importConfiguredAssets } from "../src/foundry/import-config.ts";
import { taxonomyId } from "../src/domain/index.ts";
import { planImport } from "../src/import/plan-import.ts";

describe("Foundry VTT gateway", () => {
  test("retains inline content and source provenance when Markdown is missing", async () => {
    const runtime = fakeRuntime();
    const loader = vi
      .fn<(path: string) => Promise<string | undefined>>()
      .mockResolvedValue(undefined);
    const config = {
      ...dac18SampleConfig,
      artifacts: dac18SampleConfig.artifacts.map((artifact) =>
        artifact.kind === "journalPage"
          ? { ...artifact, assets: [{ role: "content", path: "missing.md" }] }
          : artifact,
      ),
    };
    await importConfiguredAssets(
      config,
      new FoundryVttGateway(runtime, loader),
    );
    const page = [...([...runtime.game.journal][0]?.pages ?? [])][0];
    const original = config.artifacts.find(
      (artifact) => artifact.kind === "journalPage",
    );
    if (original?.kind !== "journalPage") throw new Error("Expected page");
    expect(page).toHaveProperty("data.text", {
      content: original.markdown,
      format: 1,
    });
    expect(page).toHaveProperty(
      "flags.deadsuns-adaptation-vtt.journalContentSource",
      "missing.md",
    );
    expect(
      (
        await importConfiguredAssets(
          config,
          new FoundryVttGateway(runtime, loader),
        )
      ).unchanged,
    ).toBe(16);
    expect(loader).toHaveBeenCalledTimes(4);
  });

  test("reports content loading failures and safely resumes a partial import", async () => {
    const runtime = fakeRuntime();
    const loader = vi
      .fn<(path: string) => Promise<string | undefined>>()
      .mockRejectedValueOnce(new Error("Unavailable"))
      .mockResolvedValue("");
    const gateway = new FoundryVttGateway(runtime, loader);
    const config = {
      ...dac18SampleConfig,
      artifacts: dac18SampleConfig.artifacts.map((artifact) =>
        artifact.kind === "journalPage"
          ? { ...artifact, assets: [{ role: "content", path: "page.md" }] }
          : artifact,
      ),
    };
    await expect(importConfiguredAssets(config, gateway)).rejects.toThrow(
      "Unable to populate",
    );
    expect([...runtime.game.journal]).toHaveLength(3);
    expect(
      [...runtime.game.journal].flatMap((document) => [
        ...(document.pages ?? []),
      ]),
    ).toHaveLength(0);
    const resumed = await importConfiguredAssets(config, gateway);
    expect(resumed).toMatchObject({ unchanged: 3, created: 13 });
    expect([...([...runtime.game.journal][0]?.pages ?? [])][0]).toHaveProperty(
      "data.text",
      { markdown: "", format: 2 },
    );
  });

  test("loads Markdown verbatim, treats HTTP 404 as missing and reports other failures", async () => {
    const request = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", request);
    try {
      request.mockResolvedValueOnce(new Response("# Source\n\nText"));
      expect(await loadJournalContent("assets/Page with spaces.md")).toBe(
        "# Source\n\nText",
      );
      expect(request).toHaveBeenCalledWith("assets/Page with spaces.md");
      request.mockResolvedValueOnce(new Response(null, { status: 404 }));
      expect(await loadJournalContent("missing.md")).toBeUndefined();
      request.mockResolvedValueOnce(new Response(null, { status: 500 }));
      await expect(loadJournalContent("broken.md")).rejects.toThrow("HTTP 500");
      request.mockRejectedValueOnce(new Error("Network failure"));
      await expect(loadJournalContent("unreachable.md")).rejects.toThrow(
        "Network failure",
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
  test("imports configured missing media and Items idempotently and refuses asset changes", async () => {
    const runtime = fakeRuntime();
    const loader = vi
      .fn<(path: string) => Promise<string | undefined>>()
      .mockResolvedValue("# Loaded Markdown");
    const gateway = new FoundryVttGateway(runtime, loader);
    const config = {
      ...dac18SampleConfig,
      artifacts: [
        ...dac18SampleConfig.artifacts.map((artifact) => ({
          ...artifact,
          assets: [
            { role: "background", path: "missing.webp" },
            { role: "portrait", path: "missing.webp" },
            { role: "token", path: "missing-token.webp" },
            { role: "content", path: "assets/page.md" },
            { role: "audio", path: "missing.ogg" },
          ],
        })),
        {
          kind: "item" as const,
          taxonomyId: taxonomyId("DS-ITM-01.01.01.00", "ITM"),
          name: "Item",
          metadata: { containerPath: "Equipment" },
          assets: [{ role: "portrait", path: "missing.webp" }],
        },
      ],
    };
    expect((await importConfiguredAssets(config, gateway)).created).toBe(17);
    expect([...runtime.game.items]).toHaveLength(1);
    expect([...runtime.game.items][0]).toHaveProperty(
      "data.img",
      "missing.webp",
    );
    expect([...runtime.game.actors][0]).toHaveProperty(
      "data.prototypeToken.texture.src",
      "missing-token.webp",
    );
    expect([...runtime.game.scenes][0]).toHaveProperty(
      "data.levels.0.background.src",
      "missing.webp",
    );
    expect([...([...runtime.game.journal][0]?.pages ?? [])][0]).toHaveProperty(
      "data.text",
      { markdown: "# Loaded Markdown", format: 2 },
    );
    expect(
      [...([...runtime.game.playlists][0]?.sounds ?? [])][0],
    ).toHaveProperty("data.path", "missing.ogg");
    const folders = [...runtime.game.folders].length;
    expect(loader).toHaveBeenCalledTimes(4);
    expect(loader).toHaveBeenCalledWith("assets/page.md");
    expect(
      (
        await importConfiguredAssets(
          config,
          new FoundryVttGateway(runtime, loader),
        )
      ).unchanged,
    ).toBe(17);
    expect([...runtime.game.folders]).toHaveLength(folders);
    expect(loader).toHaveBeenCalledTimes(4);
    const changed = {
      ...config,
      artifacts: config.artifacts.map((artifact) =>
        artifact.kind === "item"
          ? {
              ...artifact,
              assets: [{ role: "portrait", path: "changed.webp" }],
            }
          : artifact,
      ),
    };
    expect(
      (await planImport(changed, await gateway.listExistingArtifacts())).counts
        .update,
    ).toBe(1);
    await expect(importConfiguredAssets(changed, gateway)).rejects.toThrow(
      "initial creation and unchanged repeat imports only",
    );
    expect([...runtime.game.items]).toHaveLength(1);
    expect([...runtime.game.folders]).toHaveLength(folders);
  });
  test("creates folders, top-level documents and embedded documents idempotently", async () => {
    const runtime = fakeRuntime();
    const gateway = new FoundryVttGateway(runtime);

    expect(
      (await importConfiguredAssets(dac18SampleConfig, gateway)).created,
    ).toBe(16);
    expect([...runtime.game.actors]).toHaveLength(3);
    expect([...runtime.game.scenes]).toHaveLength(1);
    expect([...runtime.game.journal]).toHaveLength(3);
    expect([...runtime.game.playlists]).toHaveLength(1);
    expect([...runtime.game.folders]).toHaveLength(9);
    expect(
      [...runtime.game.journal].flatMap((document) => [
        ...(document.pages ?? []),
      ]),
    ).toHaveLength(4);
    expect(
      [...runtime.game.playlists].flatMap((document) => [
        ...(document.sounds ?? []),
      ]),
    ).toHaveLength(4);

    const repeat = await importConfiguredAssets(dac18SampleConfig, gateway);
    expect(repeat.created).toBe(0);
    expect(repeat.unchanged).toBe(16);
  });
});

interface FakeDocument {
  readonly data: Readonly<Record<string, unknown>>;
  readonly id: string;
  readonly uuid: string;
  readonly flags?: Readonly<Record<string, unknown>>;
  readonly pages?: FakeDocument[];
  readonly sounds?: FakeDocument[];
  createEmbeddedDocuments(
    embeddedName: string,
    data: readonly Readonly<Record<string, unknown>>[],
  ): Promise<readonly FakeDocument[]>;
}

function fakeRuntime(): FoundryVttRuntime {
  let nextId = 1;
  const actors: FakeDocument[] = [];
  const items: FakeDocument[] = [];
  const scenes: FakeDocument[] = [];
  const journal: FakeDocument[] = [];
  const playlists: FakeDocument[] = [];
  const folders: FakeDocument[] = [];

  const document = (
    name: string,
    data: Readonly<Record<string, unknown>>,
  ): FakeDocument => {
    const id = String(nextId++);
    const flags = data.flags as Readonly<Record<string, unknown>> | undefined;
    const result: FakeDocument = {
      data,
      id,
      uuid: `${name}.${id}`,
      ...(flags ? { flags } : {}),
      ...(name === "JournalEntry" ? { pages: [] } : {}),
      ...(name === "Playlist" ? { sounds: [] } : {}),
      createEmbeddedDocuments: (embeddedName, rows) => {
        const created = rows.map((row) => document(embeddedName, row));
        if (embeddedName === "JournalEntryPage") result.pages?.push(...created);
        if (embeddedName === "PlaylistSound") result.sounds?.push(...created);
        return Promise.resolve(created);
      },
    };
    return result;
  };

  const documentClass = (name: string, collection: FakeDocument[]) => ({
    create: (data: Readonly<Record<string, unknown>>) => {
      const created = document(name, data);
      collection.push(created);
      return Promise.resolve(created);
    },
  });

  return {
    game: { actors, items, scenes, journal, playlists, folders },
    Actor: documentClass("Actor", actors),
    Item: documentClass("Item", items),
    Scene: documentClass("Scene", scenes),
    JournalEntry: documentClass("JournalEntry", journal),
    Playlist: documentClass("Playlist", playlists),
    Folder: documentClass("Folder", folders),
  };
}
