import {
  parseAdaptationConfigJson,
  taxonomyId,
  validateConfig,
} from "../domain/index.ts";
import { planImport } from "../import/plan-import.ts";
import { dac18SampleConfig } from "../config/dac-18-sample.ts";
import { importConfiguredAssets } from "./import-config.ts";
import {
  FoundryVttGateway,
  type FoundryVttRuntime,
} from "./foundry-vtt-gateway.ts";

export const MODULE_ID = "deadsuns-adaptation-vtt";

export const moduleApi = Object.freeze({
  parseAdaptationConfigJson,
  dac18SampleConfig,
  importConfiguredAssets,
  importDac18Sample: () =>
    importConfiguredAssets(
      dac18SampleConfig,
      new FoundryVttGateway(globalThis as unknown as FoundryVttRuntime),
    ),
  taxonomyId,
  validateConfig,
  planImport,
});

// Only the host surface used by this adapter; the domain has no host globals.
export interface FoundryHost {
  readonly Hooks: {
    once(event: "init" | "ready", callback: () => void): unknown;
  };
  readonly game: {
    readonly modules: {
      get(id: string): { api?: typeof moduleApi } | undefined;
    };
  };
  readonly console: Pick<Console, "info">;
}

export function registerModuleLifecycle(host: FoundryHost): void {
  host.Hooks.once("init", () => {
    const module = host.game.modules.get(MODULE_ID);
    if (!module) {
      throw new Error(`${MODULE_ID} | Module registration is missing.`);
    }
    module.api = moduleApi;
    host.console.info(`${MODULE_ID} | Initialized`);
  });

  host.Hooks.once("ready", () => {
    host.console.info(`${MODULE_ID} | Ready (DAC-18 sample import available)`);
  });
}
