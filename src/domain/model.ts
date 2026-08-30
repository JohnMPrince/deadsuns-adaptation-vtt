export const contentKinds = ["actor", "scene", "journal", "encounter"] as const;

export type ContentKind = (typeof contentKinds)[number];
export type ContentKey = string & { readonly __contentKey: unique symbol };

export interface ContentReference<K extends ContentKind = ContentKind> {
  readonly kind: K;
  readonly key: ContentKey;
}

interface ContentDefinition<K extends ContentKind> {
  readonly kind: K;
  readonly key: ContentKey;
  readonly name: string;
  readonly tags?: readonly string[];
}

export interface ActorDefinition extends ContentDefinition<"actor"> {
  readonly role?: "creature" | "npc" | "starship";
}

export interface SceneDefinition extends ContentDefinition<"scene"> {
  readonly background?: string;
  readonly actors?: readonly ContentReference<"actor">[];
  readonly journals?: readonly ContentReference<"journal">[];
}

export interface JournalDefinition extends ContentDefinition<"journal"> {
  readonly pages: readonly JournalPageDefinition[];
}

export interface JournalPageDefinition {
  readonly name: string;
  readonly markdown: string;
}

export interface EncounterDefinition extends ContentDefinition<"encounter"> {
  readonly scene: ContentReference<"scene">;
  readonly actors: readonly ContentReference<"actor">[];
  readonly journals?: readonly ContentReference<"journal">[];
}

export type AdaptationContentDefinition =
  ActorDefinition | SceneDefinition | JournalDefinition | EncounterDefinition;

export interface AdaptationConfig {
  readonly id: string;
  readonly title: string;
  readonly content: readonly AdaptationContentDefinition[];
}
