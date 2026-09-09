import {
  artifactCodeDefinitions,
  type ArtifactCode,
} from "./artifact-catalog.ts";
import type {
  AdaptationArtifactDefinition,
  AdaptationConfig,
  ArtifactReference,
} from "./model.ts";
import { parseTaxonomyId, type TaxonomyId } from "./taxonomy-id.ts";

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

export function validateConfig(
  config: AdaptationConfig,
): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const artifacts = new Map<string, AdaptationArtifactDefinition>();

  for (const [index, artifact] of config.artifacts.entries()) {
    const path = `artifacts[${String(index)}]`;
    let parsed;

    try {
      parsed = parseTaxonomyId(artifact.taxonomyId);
    } catch (error) {
      issues.push({ path: `${path}.taxonomyId`, message: errorMessage(error) });
      continue;
    }

    if (parsed.campaign !== config.campaign) {
      issues.push({
        path: `${path}.taxonomyId`,
        message: `Taxonomy campaign ${parsed.campaign} does not match configuration campaign ${config.campaign}.`,
      });
    }

    const expectedKind = artifactCodeDefinitions[parsed.artifactCode].kind;
    if (artifact.kind !== expectedKind) {
      issues.push({
        path: `${path}.kind`,
        message: `Artifact code ${parsed.artifactCode} requires kind ${expectedKind}, not ${artifact.kind}.`,
      });
    }

    const existing = artifacts.get(artifact.taxonomyId);
    if (existing) {
      issues.push({
        path: `${path}.taxonomyId`,
        message: `Duplicate taxonomy ID "${artifact.taxonomyId}" (already used by ${existing.kind}).`,
      });
    } else {
      artifacts.set(artifact.taxonomyId, artifact);
    }
  }

  for (const [index, artifact] of config.artifacts.entries()) {
    for (const reference of referencesFor(artifact)) {
      const target = artifacts.get(reference.taxonomyId);
      const path = `artifacts[${String(index)}].${reference.path}`;

      if (!target) {
        issues.push({
          path,
          message: `Unknown artifact reference "${reference.taxonomyId}".`,
        });
        continue;
      }

      let targetCode: ArtifactCode;
      try {
        targetCode = parseTaxonomyId(target.taxonomyId).artifactCode;
      } catch {
        continue;
      }

      if (!reference.expectedCodes.includes(targetCode)) {
        issues.push({
          path,
          message: `Reference "${reference.taxonomyId}" expects ${reference.expectedCodes.join(" or ")}, but targets ${targetCode}.`,
        });
      }
    }
  }

  return issues;
}

interface LocatedReference {
  readonly path: string;
  readonly taxonomyId: TaxonomyId;
  readonly expectedCodes: readonly ArtifactCode[];
}

function referencesFor(
  artifact: AdaptationArtifactDefinition,
): LocatedReference[] {
  switch (artifact.kind) {
    case "actor":
    case "journal":
    case "handout":
    case "item":
    case "rollTable":
    case "playlist":
    case "macro":
      return [];
    case "journalPage":
      return [locatedReference("journal", artifact.journal, ["JRN"])];
    case "playlistSound":
      return [locatedReference("playlist", artifact.playlist, ["PLY"])];
    case "scene":
      return [
        ...(artifact.actors ?? []).map((reference, index) =>
          locatedReference(`actors[${String(index)}]`, reference, [
            "NPC",
            "AA",
            "SA",
          ]),
        ),
        ...(artifact.journals ?? []).map((reference, index) =>
          locatedReference(`journals[${String(index)}]`, reference, [
            "JRN",
            "HND",
          ]),
        ),
      ];
  }
}

function locatedReference(
  path: string,
  reference: ArtifactReference,
  expectedCodes: readonly ArtifactCode[],
): LocatedReference {
  return { path, taxonomyId: reference.taxonomyId, expectedCodes };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
