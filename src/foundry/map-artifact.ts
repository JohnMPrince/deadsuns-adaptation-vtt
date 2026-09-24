import type { AdaptationArtifactDefinition } from "../domain/model.ts";
import type { ContainerCategory } from "../domain/container-hierarchy.ts";
import { parseTaxonomyId } from "../domain/taxonomy-id.ts";

export type FoundryDocumentName =
  "Actor" | "Scene" | "JournalEntry" | "Playlist";
export type FoundryEmbeddedName = "JournalEntryPage" | "PlaylistSound";

export interface MappedFoundryArtifact {
  readonly taxonomyId: string;
  readonly documentName: FoundryDocumentName | FoundryEmbeddedName;
  readonly parentTaxonomyId?: string;
  readonly containerCategory: ContainerCategory;
  readonly containerPath?: string;
  readonly data: Readonly<Record<string, unknown>>;
}

export function mapArtifactToFoundry(
  artifact: AdaptationArtifactDefinition,
  fingerprint: string,
): MappedFoundryArtifact {
  const common = {
    name: artifact.name,
    flags: {
      "deadsuns-adaptation-vtt": {
        taxonomyId: artifact.taxonomyId,
        importedFingerprint: fingerprint,
      },
    },
  };
  switch (artifact.kind) {
    case "actor":
      return mapped(
        artifact.taxonomyId,
        "Actor",
        { ...common, type: "npc", system: {} },
        undefined,
        artifact.metadata?.containerPath,
      );
    case "scene":
      return mapped(
        artifact.taxonomyId,
        "Scene",
        {
          ...common,
          ...(artifact.background
            ? { background: { src: artifact.background } }
            : {}),
        },
        undefined,
        artifact.metadata?.containerPath,
      );
    case "journal":
      return mapped(
        artifact.taxonomyId,
        "JournalEntry",
        common,
        undefined,
        artifact.metadata?.containerPath,
      );
    case "journalPage":
      return mapped(
        artifact.taxonomyId,
        "JournalEntryPage",
        {
          ...common,
          type: "text",
          text: { content: artifact.markdown, format: 1 },
        },
        artifact.journal.taxonomyId,
        artifact.metadata?.containerPath,
      );
    case "playlist":
      return mapped(
        artifact.taxonomyId,
        "Playlist",
        common,
        undefined,
        artifact.metadata?.containerPath,
      );
    case "playlistSound":
      return mapped(
        artifact.taxonomyId,
        "PlaylistSound",
        { ...common, path: artifact.source },
        artifact.playlist.taxonomyId,
        artifact.metadata?.containerPath,
      );
    default:
      throw new Error(
        `DAC-18 does not map artifact code ${parseTaxonomyId(artifact.taxonomyId).artifactCode}.`,
      );
  }
}

function mapped(
  taxonomyId: string,
  documentName: MappedFoundryArtifact["documentName"],
  data: Readonly<Record<string, unknown>>,
  parentTaxonomyId?: string,
  containerPath?: string,
): MappedFoundryArtifact {
  const containerCategory = categoryForDocument(documentName);
  return {
    taxonomyId,
    documentName,
    data,
    containerCategory,
    ...(containerPath ? { containerPath } : {}),
    ...(parentTaxonomyId ? { parentTaxonomyId } : {}),
  };
}

function categoryForDocument(
  documentName: MappedFoundryArtifact["documentName"],
): ContainerCategory {
  if (documentName === "Actor") return "actor";
  if (documentName === "Scene") return "scene";
  if (documentName === "JournalEntry" || documentName === "JournalEntryPage")
    return "journal";
  return "playlist";
}
