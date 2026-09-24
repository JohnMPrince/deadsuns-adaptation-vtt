export const artifactCodeDefinitions = {
  CIN: { kind: "scene", subcategory: "cinematic" },
  BAT: { kind: "scene", subcategory: "battleMap" },
  REG: { kind: "scene", subcategory: "regionalMap" },
  SOC: { kind: "scene", subcategory: "socialMap" },
  NPC: {
    kind: "actor",
    subcategory: "nonPlayerCharacter",
  },
  AA: { kind: "actor", subcategory: "alienArchive" },
  SA: { kind: "actor", subcategory: "starshipArchive" },
  JRN: { kind: "journal", subcategory: "entry" },
  JPG: {
    kind: "journalPage",
    subcategory: "page",
  },
  HND: { kind: "handout", subcategory: null },
  ITM: { kind: "item", subcategory: null },
  TBL: { kind: "rollTable", subcategory: null },
  PLY: { kind: "playlist", subcategory: null },
  AUD: {
    kind: "playlistSound",
    subcategory: null,
  },
  MAC: { kind: "macro", subcategory: null },
} as const;

export type ArtifactCode = keyof typeof artifactCodeDefinitions;
export type ArtifactKind =
  (typeof artifactCodeDefinitions)[ArtifactCode]["kind"];

export const artifactCodes = Object.freeze(
  Object.keys(artifactCodeDefinitions) as ArtifactCode[],
);

export function isArtifactCode(value: string): value is ArtifactCode {
  return Object.hasOwn(artifactCodeDefinitions, value);
}
