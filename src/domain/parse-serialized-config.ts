import type { AdaptationConfig } from "./model.ts";
import { parseAdaptationConfig } from "./parse-config.ts";
import { validateConfig } from "./validate-config.ts";
import type { ValidationIssue } from "./validation-issue.ts";

export type AdaptationConfigJsonParseResult =
  | { readonly success: true; readonly config: AdaptationConfig }
  | {
      readonly success: false;
      readonly stage: "syntax" | "structure" | "semantic";
      readonly issues: readonly ValidationIssue[];
    };

/** Parses serialized JSON and returns only fully validated domain configuration. */
export function parseAdaptationConfigJson(
  input: string,
): AdaptationConfigJsonParseResult {
  let decoded: unknown;
  try {
    decoded = JSON.parse(input) as unknown;
  } catch {
    return {
      success: false,
      stage: "syntax",
      issues: [
        { path: "configuration", message: "Configuration is not valid JSON." },
      ],
    };
  }

  const structural = parseAdaptationConfig(decoded);
  if (!structural.success) {
    return { success: false, stage: "structure", issues: structural.issues };
  }

  const semanticIssues = validateConfig(structural.config);
  if (semanticIssues.length > 0) {
    return { success: false, stage: "semantic", issues: semanticIssues };
  }

  return { success: true, config: structural.config };
}
