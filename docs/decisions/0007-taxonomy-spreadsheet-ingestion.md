# ADR 0007: Taxonomy spreadsheet ingestion

Status: accepted for DAC-25

## Context

Taxonomy spreadsheets identify artifacts and their placement, but the importer
accepts validated adaptation JSON. Spreadsheet details and file reading belong
outside the Foundry-independent domain model and the Foundry runtime.

## Decision

Use one row mapper for UTF-8 CSV/TSV and native `.xlsx` input. The Node adapter
uses `read-excel-file` 9.3.12; it is not imported by the Foundry browser entry.
Require explicit worksheet selection for multi-sheet workbooks unless one sheet
is named `Taxonomy`. Preserve text cells and reject non-text taxonomy values
instead of coercing numbers that may have lost leading zeros. Formula values are
cached workbook values; ingestion does not recalculate formulas.

Validate the redundant Campaign, Taxonomy Code, and Index columns against the
canonical Taxonomy ID. Derive artifact kinds from the existing catalogue, and
map placement columns into existing metadata. Apply optional Dataset filtering
before domain validation; Dataset never becomes artifact metadata.

Reuse `parseAssetReferences` for multiline Asset Path cells. Translate journal
page role `markdown` into the importer role `content`, preserving the path.
Blank inline page content is the fallback for file-loaded Markdown. Audio assets
also supply the domain's required legacy `source`; absent audio paths remain
errors even when Syrinscape identifiers are present.

Resolve journal pages and sounds against all selected rows, independent of
source order. Match the same campaign and first three Index segments, with the
owner's final segment set to `00`. Journal pages without that exact owner may
use a unique journal sharing their first two Index segments, as agreed for the
Locations pages. Ambiguous and missing owners are errors. Library callers can
supply explicit owners or require explicit journal ownership.

Treat artifact metadata as an extensible dictionary of JSON-compatible values.
Preserve unknown keys on all artifact types, including nested objects and arrays
for future scene geometry. Keep typed known fields and their existing
validation; new fields can acquire stronger validation as their domain meaning
is defined. Reject conflicting placement values between Metadata and dedicated
columns. Dataset remains a reserved ingestion field. Custom values participate
in fingerprints but are not automatically mapped to Foundry geometry or flags.

Support `syrinscapeSoundID` as a positive safe integer and `syrinscapeSoundType`
as exactly `Element` or `Mood` on playlist sound metadata. The sheet accepts
JSON objects or comma/newline-separated key/value entries, including the
original spaced labels. Duplicate key/value entries and invalid known fields are
errors. Preserve these values in JSON, fingerprints, and module flags. Playback
integration is outside DAC-25.

Run all mapped output through the existing structural and semantic JSON parser.
Return errors with physical row locations and workbook sheet names. The CLI
writes JSON only on success, refuses existing outputs, and never imports into
Foundry itself.

## Consequences

- Existing adaptation configurations remain valid.
- Import validation and relationship rules have a single implementation.
- Missing assets and malformed Metadata require source corrections; ingestion
  does not manufacture values or silently discard custom metadata.
- Automated fixtures establish workbook handling and mapped import contracts.
  Validation against the user's complete saved workbook remains a separate
  acceptance step once that file is provided.
