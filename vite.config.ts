import { resolve } from "node:path";

import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: true,
    lib: {
      entry: resolve(import.meta.dirname, "src/foundry/entry.ts"),
      formats: ["es"],
      fileName: () => "deadsuns-adaptation-vtt.js",
    },
    minify: false,
    sourcemap: true,
    target: "es2022",
  },
});
