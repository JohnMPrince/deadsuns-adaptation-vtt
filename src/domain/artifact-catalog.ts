export const artifactCodeDefinitions = {
  CIN: { kind: "scene", subcategory: "cinematic", foundryType: "Scene" },
  BAT: { kind: "scene", subcategory: "battleMap", foundryType: "Scene" },
  REG: { kind: "scene", subcategory: "regionalMap", foundryType: "Scene" },
  SOC: { kind: "scene", subcategory: "socialMap", foundryType: "Scene" },
  NPC: {
    kind: "actor",
    subcategory: "nonPlayerCharacter",
    foundryType: "Actor",
  },
  AA: { kind: "actor", subcategory: "alienArchive", foundryType: "Actor" },
  SA: { kind: "actor", subcategory: "starshipArchive", foundryType: "Actor" },
  JRN: { kind: "journal", subcategory: "entry", foundryType: "JournalEntry" },
  JPG: {
    kind: "journalPage",
    subcategory: "page",
    foundryType: "JournalEntryPage",
  },
  HND: { kind: "handout", subcategory: null, foundryType: null },
  ITM: { kind: "item", subcategory: null, foundryType: "Item" },
  TBL: { kind: "rollTable", subcategory: null, foundryType: "RollTable" },
  PLY: { kind: "playlist", subcategory: null, foundryType: "Playlist" },
  AUD: {
    kind: "playlistSound",
    subcategory: null,
    foundryType: "PlaylistSound",
  },
  MAC: { kind: "macro", subcategory: null, foundryType: "Macro" },
} as const;

export type ArtifactCode = keyof typeof artifactCodeDefinitions;
export type ArtifactKind =
  (typeof artifactCodeDefinitions)[ArtifactCode]["kind"];
export type FoundryDocumentType = Exclude<
  (typeof artifactCodeDefinitions)[ArtifactCode]["foundryType"],
  null
>;

export const artifactCodes = Object.freeze(
  Object.keys(artifactCodeDefinitions) as ArtifactCode[],
);

export function isArtifactCode(value: string): value is ArtifactCode {
  return Object.hasOwn(artifactCodeDefinitions, value);
}
