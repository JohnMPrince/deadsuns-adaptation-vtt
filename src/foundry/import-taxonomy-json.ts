import { parseAdaptationConfigJson } from "../domain/parse-serialized-config.ts";
import type { ValidationIssue } from "../domain/validation-issue.ts";
import {
  FoundryVttGateway,
  type FoundryVttRuntime,
} from "./foundry-vtt-gateway.ts";
import {
  importConfiguredAssets,
  type FoundryImportGateway,
  type ImportExecutionResult,
} from "./import-config.ts";

export class TaxonomyJsonValidationError extends Error {
  public constructor(
    public readonly stage: "syntax" | "structure" | "semantic",
    public readonly issues: readonly ValidationIssue[],
  ) {
    super(
      `Taxonomy JSON ${stage} validation failed:\n${issues
        .map(({ path, message }) => `${path}: ${message}`)
        .join("\n")}`,
    );
    this.name = "TaxonomyJsonValidationError";
  }
}

/** Import taxonomy parser JSON using the existing validation and bounded import engine. */
export async function executeTaxonomyJson(
  json: string,
  gateway?: FoundryImportGateway,
): Promise<ImportExecutionResult> {
  if (typeof json !== "string") {
    throw new TypeError("Taxonomy JSON must be supplied as a JSON string.");
  }
  const parsed = parseAdaptationConfigJson(json);
  if (!parsed.success) {
    throw new TaxonomyJsonValidationError(parsed.stage, parsed.issues);
  }
  return importConfiguredAssets(
    parsed.config,
    gateway ??
      new FoundryVttGateway(globalThis as unknown as FoundryVttRuntime),
  );
}

export type TaxonomyImportResult =
  | (ImportExecutionResult & {
      readonly success: true;
      readonly errors: readonly [];
    })
  | {
      readonly success: false;
      readonly stage:
        | "authorization"
        | "input"
        | "syntax"
        | "structure"
        | "semantic"
        | "import";
      readonly errors: readonly ValidationIssue[];
    };

/** Console boundary: authorized calls always resolve to an explicit outcome. */
export async function importTaxonomyJson(
  json: string,
): Promise<TaxonomyImportResult> {
  try {
    const host = globalThis as unknown as {
      game?: { user?: { isGM?: boolean } };
    };
    if (host.game?.user?.isGM !== true) {
      return {
        success: false,
        stage: "authorization",
        errors: [
          {
            path: "user",
            message:
              "Taxonomy import requires the current Foundry user to be a GM.",
          },
        ],
      };
    }
    const result = await executeTaxonomyJson(json);
    return { success: true, ...result, errors: [] };
  } catch (error) {
    if (error instanceof TaxonomyJsonValidationError) {
      return { success: false, stage: error.stage, errors: error.issues };
    }
    return {
      success: false,
      stage: typeof json === "string" ? "import" : "input",
      errors: [
        {
          path: "import",
          message: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }
}
