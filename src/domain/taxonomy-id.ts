import { isArtifactCode, type ArtifactCode } from "./artifact-catalog.ts";

declare const taxonomyIdBrand: unique symbol;

export type TaxonomyId<C extends ArtifactCode = ArtifactCode> = string & {
  readonly [taxonomyIdBrand]: C;
};

export type TaxonomyIndex = readonly [string, string, string, string];

export interface ParsedTaxonomyId<C extends ArtifactCode = ArtifactCode> {
  readonly value: TaxonomyId<C>;
  readonly campaign: string;
  readonly artifactCode: C;
  readonly index: TaxonomyIndex;
}

const TAXONOMY_ID_PATTERN =
  /^(?<campaign>[A-Z][A-Z0-9]{1,7})-(?<artifactCode>[A-Z]{2,3})-(?<index>\d{2}\.\d{2}\.\d{2}\.\d{2})$/;

export function taxonomyId<C extends ArtifactCode>(
  value: string,
  expectedCode: C,
): TaxonomyId<C>;
export function taxonomyId(value: string): TaxonomyId;
export function taxonomyId<C extends ArtifactCode>(
  value: string,
  expectedCode?: C,
): TaxonomyId<C> | TaxonomyId {
  return expectedCode === undefined
    ? parseTaxonomyId(value).value
    : parseTaxonomyId(value, expectedCode).value;
}

export function parseTaxonomyId<C extends ArtifactCode>(
  value: string,
  expectedCode: C,
): ParsedTaxonomyId<C>;
export function parseTaxonomyId(value: string): ParsedTaxonomyId;
export function parseTaxonomyId<C extends ArtifactCode>(
  value: string,
  expectedCode?: C,
): ParsedTaxonomyId<C> | ParsedTaxonomyId {
  const match = TAXONOMY_ID_PATTERN.exec(value);
  const campaign = match?.groups?.campaign;
  const artifactCode = match?.groups?.artifactCode;
  const index = match?.groups?.index;

  if (!campaign || !artifactCode || !index) {
    throw new Error(
      `Invalid taxonomy ID "${value}". Expected CAMPAIGN-CODE-00.00.00.00.`,
    );
  }

  if (!isArtifactCode(artifactCode)) {
    throw new Error(
      `Unsupported artifact code "${artifactCode}" in taxonomy ID "${value}".`,
    );
  }

  if (expectedCode !== undefined && artifactCode !== expectedCode) {
    throw new Error(
      `Taxonomy ID "${value}" uses ${artifactCode}; expected ${expectedCode}.`,
    );
  }

  return {
    value: value as TaxonomyId<C>,
    campaign,
    artifactCode: artifactCode as C,
    index: index.split(".") as unknown as TaxonomyIndex,
  };
}
