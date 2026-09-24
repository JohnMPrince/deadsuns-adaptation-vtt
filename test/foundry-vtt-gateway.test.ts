import { describe, expect, test } from "vitest";

import { dac18SampleConfig } from "../src/config/dac-18-sample.ts";
import {
  FoundryVttGateway,
  type FoundryVttRuntime,
} from "../src/foundry/foundry-vtt-gateway.ts";
import { importConfiguredAssets } from "../src/foundry/import-config.ts";

describe("Foundry VTT gateway", () => {
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
    game: { actors, scenes, journal, playlists, folders },
    Actor: documentClass("Actor", actors),
    Scene: documentClass("Scene", scenes),
    JournalEntry: documentClass("JournalEntry", journal),
    Playlist: documentClass("Playlist", playlists),
    Folder: documentClass("Folder", folders),
  };
}
