import { registerModuleLifecycle, type FoundryHost } from "./lifecycle.ts";

// This entry is loaded by Foundry, which supplies Hooks and game at runtime.
registerModuleLifecycle(globalThis as unknown as FoundryHost);
