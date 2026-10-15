import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { readTaxonomyFile } from "./read-taxonomy-file.ts";

const args = process.argv.slice(2);
const positional: string[] = [];
let sheet: string | undefined;
let invalidOption = false;
for (let index = 0; index < args.length; index++) {
  const argument = args[index];
  if (argument === "--sheet") {
    const name = args[++index];
    if (sheet !== undefined || !name || name.startsWith("--"))
      invalidOption = true;
    else sheet = name;
  } else if (argument?.startsWith("--")) invalidOption = true;
  else if (argument !== undefined) positional.push(argument);
}
const [input, output, campaign, title, dataset, ...extra] = positional;
if (
  !input ||
  !output ||
  !campaign ||
  !title ||
  extra.length > 0 ||
  invalidOption
) {
  console.error(
    'Usage: pnpm taxonomy:parse <input.xlsx|input.tsv|input.csv> <output.json> <campaign> "<title>" [dataset] [--sheet "<worksheet>"]',
  );
  process.exitCode = 1;
} else {
  try {
    if (resolve(input) === resolve(output))
      throw new Error("Output must differ from the source spreadsheet.");
    const result = await readTaxonomyFile(input, {
      campaign,
      title,
      ...(sheet !== undefined ? { sheet } : {}),
      ...(dataset !== undefined ? { dataset } : {}),
    });
    if (!result.success) {
      for (const issue of result.issues)
        console.error(`${issue.path}: ${issue.message}`);
      process.exitCode = 1;
    } else {
      // Never overwrite an existing output or write partially valid JSON.
      await writeFile(output, result.json, { encoding: "utf8", flag: "wx" });
      console.log(
        `Wrote ${String(result.config.artifacts.length)} artifacts to ${output}.`,
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
