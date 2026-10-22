import type { AdaptationArtifactDefinition } from "../domain/model.ts";
import type { ContainerCategory } from "../import/container-hierarchy.ts";
import { parseTaxonomyId } from "../domain/taxonomy-id.ts";
import { mapSyrinscapeMetadata } from "./map-metadata.ts";

export type FoundryDocumentName =
  "Actor" | "Item" | "Scene" | "JournalEntry" | "Playlist";
export type FoundryEmbeddedName = "JournalEntryPage" | "PlaylistSound";

export interface MappedFoundryArtifact {
  readonly taxonomyId: string;
  readonly documentName: FoundryDocumentName | FoundryEmbeddedName;
  readonly parentTaxonomyId?: string;
  readonly containerCategory: ContainerCategory;
  readonly containerPath?: string;
  /** Markdown source for the gateway's journal content population mechanism. */
  readonly journalContentSource?: string;
  readonly data: Readonly<Record<string, unknown>>;
}

export function mapArtifactToFoundry(
  artifact: AdaptationArtifactDefinition,
  fingerprint: string,
): MappedFoundryArtifact {
  const syrinscape = mapSyrinscapeMetadata(artifact);
  // DAC-23 preserves order and open roles; each supported slot uses its first match.
  const asset = (role: string) =>
    artifact.assets?.find((reference) => reference.role === role)?.path;
  const containerPath =
    typeof artifact.metadata?.containerPath === "string"
      ? artifact.metadata.containerPath
      : undefined;
  const portrait = asset("portrait");
  const token = asset("token");
  const background = asset("background");
  const common = {
    name: artifact.name,
    flags: {
      ...(syrinscape ? { "syrinscape-control": syrinscape } : {}),
      "deadsuns-adaptation-vtt": {
        taxonomyId: artifact.taxonomyId,
        importedFingerprint: fingerprint,
        ...(artifact.kind === "playlistSound" &&
        artifact.metadata?.syrinscapeSoundID !== undefined
          ? { syrinscapeSoundID: artifact.metadata.syrinscapeSoundID }
          : {}),
        ...(artifact.kind === "playlistSound" &&
        artifact.metadata?.syrinscapeSoundType !== undefined
          ? { syrinscapeSoundType: artifact.metadata.syrinscapeSoundType }
          : {}),
      },
    },
  };
  switch (artifact.kind) {
    case "actor":
      return mapped(
        artifact.taxonomyId,
        "Actor",
        {
          ...common,
          type: "npc2",
          system: {},
          // Portrait and prototype-token image are separate Foundry Actor fields.
          ...(portrait ? { img: portrait } : {}),
          ...(token ? { prototypeToken: { texture: { src: token } } } : {}),
        },
        undefined,
        containerPath,
      );
    case "scene":
      return mapped(
        artifact.taxonomyId,
        "Scene",
        {
          ...common,
          ...((background ?? artifact.background)
            ? {
                // v14 stores images on Levels; the first is the initial Level.
                levels: [
                  {
                    name: "Background",
                    background: { src: background ?? artifact.background },
                  },
                ],
              }
            : {}),
        },
        undefined,
        containerPath,
      );
    case "journal":
      return mapped(
        artifact.taxonomyId,
        "JournalEntry",
        common,
        undefined,
        containerPath,
      );
    case "journalPage": {
      // Importer-only source path; the gateway loads it before page creation.
      const contentSource = asset("content");
      return {
        ...mapped(
          artifact.taxonomyId,
          "JournalEntryPage",
          {
            ...common,
            type: "text",
            // Preserve the legacy inline fallback (Foundry HTML format = 1).
            text: { content: artifact.markdown, format: 1 },
          },
          artifact.journal.taxonomyId,
          containerPath,
        ),
        ...(contentSource ? { journalContentSource: contentSource } : {}),
      };
    }
    case "playlist":
      return mapped(
        artifact.taxonomyId,
        "Playlist",
        common,
        undefined,
        containerPath,
      );
    case "playlistSound":
      return mapped(
        artifact.taxonomyId,
        "PlaylistSound",
        { ...common, path: asset("audio") ?? artifact.source },
        artifact.playlist.taxonomyId,
        containerPath,
      );
    case "item":
      return mapped(
        artifact.taxonomyId,
        "Item",
        {
          ...common,
          type: "equipment",
          system: {},
          ...(portrait ? { img: portrait } : {}),
        },
        undefined,
        containerPath,
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
  if (documentName === "Item") return "item";
  if (documentName === "Scene") return "scene";
  if (documentName === "JournalEntry" || documentName === "JournalEntryPage")
    return "journal";
  return "playlist";
}
