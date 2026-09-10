import { describe, expect, test, vi } from "vitest";

import {
  MODULE_ID,
  moduleApi,
  registerModuleLifecycle,
  type FoundryHost,
} from "../src/foundry/lifecycle.ts";

describe("Foundry module lifecycle", () => {
  test("defers host access until init and exposes non-mutating planning", async () => {
    const callbacks = new Map<string, () => void>();
    const module: { api?: typeof moduleApi } = {};
    const get = vi.fn(() => module);
    const host: FoundryHost = {
      Hooks: { once: (event, callback) => callbacks.set(event, callback) },
      game: { modules: { get } },
      console: { info: vi.fn() },
    };
    registerModuleLifecycle(host);
    expect(get).not.toHaveBeenCalled();
    expect([...callbacks.keys()]).toEqual(["init", "ready"]);
    callbacks.get("init")?.();
    expect(get).toHaveBeenCalledWith(MODULE_ID);
    expect(module.api).toBe(moduleApi);
    const config = { campaign: "EX", title: "Example", artifacts: [] };
    expect(module.api?.validateConfig(config)).toEqual([]);
    expect(await module.api?.planImport(config, [])).toMatchObject({
      entries: [],
      counts: { create: 0, update: 0, unchanged: 0, conflict: 0 },
    });
    callbacks.get("ready")?.();
    expect(host.console.info).toHaveBeenCalledWith(
      `${MODULE_ID} | Ready (validation and planning only)`,
    );
  });
});
