import type { ValidationIssue } from "../domain/validation-issue.ts";

/** Preserves extensible JSON metadata without executing spreadsheet text. */
export function parseMetadata(
  input: string,
  path: string,
  issues: ValidationIssue[],
): Record<string, unknown> {
  if (!input.trim()) return {};
  let entries: [string, unknown][];
  try {
    if (input.trim().startsWith("{")) {
      const value: unknown = JSON.parse(input);
      if (typeof value !== "object" || value === null || Array.isArray(value))
        throw new Error("Metadata must be a JSON object.");
      entries = Object.entries(value);
    } else {
      // Also accept the sheet's compact key: value notation without evaluating code.
      entries = splitEntries(input).map((line) => {
        const separator = line.indexOf(":");
        if (separator < 0)
          throw new Error("Expected a key: value metadata entry.");
        const key = line.slice(0, separator).trim();
        if (!key) throw new Error("Metadata keys must be nonblank.");
        const raw = line.slice(separator + 1).trim();
        // Recognizable JSON literals retain their types; unquoted prose stays text.
        let value: unknown;
        if (raw.startsWith("'")) {
          if (!raw.endsWith("'") || raw.length < 2)
            throw new Error("Unterminated quoted metadata value.");
          value = raw
            .slice(1, -1)
            .replaceAll("\\'", "'")
            .replaceAll("\\\\", "\\");
        } else if (
          raw.startsWith('"') ||
          raw.startsWith("{") ||
          raw.startsWith("[") ||
          raw === "true" ||
          raw === "false" ||
          raw === "null" ||
          /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(raw)
        ) {
          value = JSON.parse(raw) as unknown;
        } else value = raw;
        return [key, value];
      });
    }
  } catch (error) {
    issues.push({
      path,
      message:
        error instanceof Error ? error.message : "Invalid Metadata cell.",
    });
    return {};
  }
  const aliases: Readonly<Record<string, string>> = {
    "syrinscape sound id": "syrinscapeSoundID",
    "syrinscape sound type": "syrinscapeSoundType",
  };
  // Normalize legacy Syrinscape labels before detecting duplicate keys. A Map
  // also keeps arbitrary dictionary keys separate from object prototype members.
  const result = new Map<string, unknown>();
  for (const [key, value] of entries) {
    const canonical = Object.hasOwn(aliases, key) ? (aliases[key] ?? key) : key;
    if (!canonical.trim())
      issues.push({ path, message: "Metadata keys must be nonblank." });
    else if (result.has(canonical))
      issues.push({
        path,
        message: `Duplicate Metadata field "${canonical}".`,
      });
    else result.set(canonical, value);
  }
  return Object.fromEntries(result);
}

/** Separators inside quoted strings, objects and arrays belong to the value. */
function splitEntries(input: string): string[] {
  const entries: string[] = [];
  let start = 0;
  let quote = "";
  let escaped = false;
  const brackets: string[] = [];
  for (let index = 0; index < input.length; index++) {
    const char = input.charAt(index);
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    // An apostrophe within unquoted prose (A Maestro's Symphony) is not a quote.
    if (
      char === '"' ||
      (char === "'" && /(?:^|[:[{,])\s*$/.test(input.slice(start, index)))
    )
      quote = char;
    else if (char === "{" || char === "[") brackets.push(char);
    else if (char === "}" || char === "]") {
      if (brackets.pop() !== (char === "}" ? "{" : "["))
        throw new Error("Unbalanced metadata brackets.");
    } else if (
      (char === "," || char === "\r" || char === "\n") &&
      brackets.length === 0
    ) {
      const entry = input.slice(start, index).trim();
      if (entry) entries.push(entry);
      start = index + 1;
    }
  }
  if (quote || brackets.length > 0)
    throw new Error("Unterminated metadata quote or bracket.");
  const last = input.slice(start).trim();
  if (last) entries.push(last);
  return entries;
}
