import type {
  AdaptationConfig,
  AdaptationContentDefinition,
  ContentKind,
  ContentReference,
} from "./model.ts";

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

export function validateConfig(config: AdaptationConfig): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const definitions = new Map<string, AdaptationContentDefinition>();

  for (const [index, definition] of config.content.entries()) {
    const existing = definitions.get(definition.key);
    if (existing) {
      issues.push({
        path: `content[${index}].key`,
        message: `Duplicate content key "${definition.key}" (already used by ${existing.kind}).`,
      });
    } else {
      definitions.set(definition.key, definition);
    }
  }

  for (const [index, definition] of config.content.entries()) {
    for (const [path, reference] of referencesFor(definition)) {
      const target = definitions.get(reference.key);
      if (!target) {
        issues.push({
          path: `content[${index}].${path}`,
          message: `Unknown ${reference.kind} reference "${reference.key}".`,
        });
      } else if (target.kind !== reference.kind) {
        issues.push({
          path: `content[${index}].${path}`,
          message: `Reference "${reference.key}" expects ${reference.kind}, but targets ${target.kind}.`,
        });
      }
    }
  }

  return issues;
}

type LocatedReference = readonly [path: string, reference: ContentReference<ContentKind>];

function referencesFor(definition: AdaptationContentDefinition): LocatedReference[] {
  switch (definition.kind) {
    case "actor":
    case "journal":
      return [];
    case "scene":
      return [
        ...(definition.actors ?? []).map((reference, index) =>
          [`actors[${index}]`, reference] as const),
        ...(definition.journals ?? []).map((reference, index) =>
          [`journals[${index}]`, reference] as const),
      ];
    case "encounter":
      return [
        ["scene", definition.scene],
        ...definition.actors.map((reference, index) =>
          [`actors[${index}]`, reference] as const),
        ...(definition.journals ?? []).map((reference, index) =>
          [`journals[${index}]`, reference] as const),
      ];
  }
}
