import type { ArtifactCode, ArtifactKind } from "./artifact-catalog.ts";
import type { TaxonomyId } from "./taxonomy-id.ts";

export type SceneArtifactCode = "CIN" | "BAT" | "REG" | "SOC";
export type ActorArtifactCode = "NPC" | "AA" | "SA";

export interface ArtifactReference<C extends ArtifactCode = ArtifactCode> {
  readonly taxonomyId: TaxonomyId<C>;
}

export interface ArtifactMetadata {
  readonly containerPath?: string;
  readonly chapter?: string;
  readonly part?: string;
  readonly dataset?: string;
}

interface ArtifactDefinition<K extends ArtifactKind, C extends ArtifactCode> {
  readonly kind: K;
  readonly taxonomyId: TaxonomyId<C>;
  readonly name: string;
  readonly metadata?: ArtifactMetadata;
  readonly tags?: readonly string[];
}

export type ActorDefinition = ArtifactDefinition<"actor", ActorArtifactCode>;

export interface SceneDefinition extends ArtifactDefinition<
  "scene",
  SceneArtifactCode
> {
  readonly background?: string;
  readonly actors?: readonly ArtifactReference<ActorArtifactCode>[];
  readonly journals?: readonly ArtifactReference<"JRN" | "HND">[];
}

export type JournalDefinition = ArtifactDefinition<"journal", "JRN">;

export interface JournalPageDefinition extends ArtifactDefinition<
  "journalPage",
  "JPG"
> {
  readonly journal: ArtifactReference<"JRN">;
  readonly markdown: string;
}

export type HandoutDefinition = ArtifactDefinition<"handout", "HND">;
export type ItemDefinition = ArtifactDefinition<"item", "ITM">;
export type RollTableDefinition = ArtifactDefinition<"rollTable", "TBL">;
export type PlaylistDefinition = ArtifactDefinition<"playlist", "PLY">;

export interface PlaylistSoundDefinition extends ArtifactDefinition<
  "playlistSound",
  "AUD"
> {
  readonly playlist: ArtifactReference<"PLY">;
  readonly source: string;
}

export type MacroDefinition = ArtifactDefinition<"macro", "MAC">;

export type AdaptationArtifactDefinition =
  | ActorDefinition
  | SceneDefinition
  | JournalDefinition
  | JournalPageDefinition
  | HandoutDefinition
  | ItemDefinition
  | RollTableDefinition
  | PlaylistDefinition
  | PlaylistSoundDefinition
  | MacroDefinition;

export interface AdaptationConfig {
  readonly campaign: string;
  readonly title: string;
  readonly artifacts: readonly AdaptationArtifactDefinition[];
}
