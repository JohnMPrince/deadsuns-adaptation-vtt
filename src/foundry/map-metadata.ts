import type { AdaptationArtifactDefinition } from "../domain/model.ts";

/** Syrinscape Controller 1.1.0: module.mjs track configuration and playback flags. */
export function mapSyrinscapeMetadata(
  artifact: AdaptationArtifactDefinition,
): Readonly<Record<string, string>> | undefined {
  const metadata = artifact.metadata;
  if (!metadata) return undefined;

  // Recognize the original flat keys and the nested integration object.
  // Unrelated metadata is left for other consumers to interpret.
  const nested = metadata.syrinscape;
  const hasFlat =
    metadata.syrinscapeSoundID !== undefined ||
    metadata.syrinscapeSoundType !== undefined;
  if (nested === undefined && !hasFlat) return undefined;

  const fail = (message: string): never => {
    throw new Error(`${artifact.taxonomyId} metadata.syrinscape: ${message}`);
  };

  // Integration validation belongs here, keeping the domain's JSON contract opaque.
  if (artifact.kind !== "playlistSound")
    fail("supported only on playlist sounds.");
  if (
    nested !== undefined &&
    (nested === null || typeof nested !== "object" || Array.isArray(nested))
  )
    fail("expected an object.");
  const values = nested as Readonly<Record<string, unknown>> | undefined;

  // Controller flags store string IDs; accept numeric spreadsheet IDs without
  // silently trimming authored strings or losing integer precision.
  const normalizeId = (value: unknown): string | undefined => {
    if (value === undefined) return undefined;
    if (typeof value === "number" && Number.isSafeInteger(value) && value > 0)
      return String(value);
    if (
      typeof value === "string" &&
      value.trim().length > 0 &&
      value === value.trim()
    )
      return value;
    return fail("sound ID must be a nonblank string or positive safe integer.");
  };

  // Normalize supported labels to the lowercase values used by the Controller.
  const normalizeType = (value: unknown): string | undefined => {
    if (value === undefined) return undefined;
    if (value === "Element" || value === "element") return "element";
    if (value === "Mood" || value === "mood") return "mood";
    return fail(
      "sound type must be Element or Mood (lowercase also accepted).",
    );
  };

  // Normalize both forms before comparing so equivalent aliases can coexist.
  // Conflicting values are errors rather than silently choosing one form.
  const flatId = normalizeId(metadata.syrinscapeSoundID);
  const flatType = normalizeType(metadata.syrinscapeSoundType);
  const nestedId = normalizeId(values?.soundId);
  const nestedType = normalizeType(values?.soundType);
  if (
    (flatId !== undefined && nestedId !== undefined && flatId !== nestedId) ||
    (flatType !== undefined &&
      nestedType !== undefined &&
      flatType !== nestedType)
  )
    fail("flat and nested values disagree.");

  // Omit absent fields to support partial configuration without writing undefined.
  const soundId = nestedId ?? flatId;
  const soundType = nestedType ?? flatType;
  return {
    ...(soundId === undefined ? {} : { soundId }),
    ...(soundType === undefined ? {} : { soundType }),
  };
}
