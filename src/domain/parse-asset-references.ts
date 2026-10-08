import type { AssetReference } from "./model.ts";

/** Parses an optional Asset Path cell without resolving or loading its assets. */
export function parseAssetReferences(
  input: string | null | undefined,
): readonly AssetReference[] {
  if (input == null) return [];
  const assets: AssetReference[] = [];
  for (const [index, line] of input.split(/\r\n|\r|\n/).entries()) {
    if (line.trim().length === 0) continue;
    const separator = line.indexOf(":");
    const role = separator < 0 ? "" : line.slice(0, separator).trim();
    const path = separator < 0 ? "" : line.slice(separator + 1).trim();
    if (!role || !path) {
      throw new Error(
        `Invalid asset reference on line ${String(index + 1)}: expected <role>: <path>.`,
      );
    }
    assets.push({ role, path });
  }
  return assets;
}
