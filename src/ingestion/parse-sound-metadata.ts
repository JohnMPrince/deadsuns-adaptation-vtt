import type { ValidationIssue } from "../domain/validation-issue.ts";

/** Parses supported sound metadata without executing spreadsheet text. */
export function parseSoundMetadata(
  input: string,
  path: string,
  issues: ValidationIssue[],
): Record<string, unknown> {
  if (!input.trim()) return {};
  const aliases: Readonly<Record<string, string>> = {
    syrinscapeSoundID: "syrinscapeSoundID",
    syrinscapeSoundType: "syrinscapeSoundType",
    "syrinscape sound id": "syrinscapeSoundID",
    "syrinscape sound type": "syrinscapeSoundType",
  };
  let entries: [string, unknown][];
  if (input.trim().startsWith("{")) {
    try {
      const value: unknown = JSON.parse(input);
      if (typeof value !== "object" || value === null || Array.isArray(value))
        throw new Error("Expected an object.");
      entries = Object.entries(value);
    } catch {
      issues.push({
        path,
        message:
          "Metadata must be a valid JSON object or supported key: value entries.",
      });
      return {};
    }
  } else {
    entries = [];
    for (const line of input.split(/[\r\n,]+/)) {
      if (!line.trim()) continue;
      const separator = line.indexOf(":");
      if (separator < 0) {
        issues.push({ path, message: "Expected a key: value metadata entry." });
        continue;
      }
      const key = line.slice(0, separator).trim();
      const raw = line.slice(separator + 1).trim();
      const value = raw.replace(/^(['"])(.*)\1$/, "$2");
      entries.push([
        key,
        Object.hasOwn(aliases, key) &&
        aliases[key] === "syrinscapeSoundID" &&
        /^\d+$/.test(raw)
          ? Number(raw)
          : value,
      ]);
    }
  }
  const metadata: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    const canonical = Object.hasOwn(aliases, key) ? aliases[key] : undefined;
    if (!canonical) {
      issues.push({ path, message: `Unsupported Metadata field "${key}".` });
      continue;
    }
    if (Object.hasOwn(metadata, canonical)) {
      issues.push({
        path,
        message: `Duplicate Metadata field "${canonical}".`,
      });
      continue;
    }
    metadata[canonical] = value;
  }
  return metadata;
}
