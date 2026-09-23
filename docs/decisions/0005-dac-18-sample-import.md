# ADR 0005: Bound the first import to the Docking Bay sample

## Status

Accepted for DAC-18.

## Decision

The first write-capable slice imports the 16 taxonomy artifacts from Part I
through Detective Elias Mercer, including the two journal owners required by the
selected miscellaneous pages. Configuration remains a domain concern; Foundry
document mapping and persistence remain in `src/foundry`.

All desired state is validated and planned before writes begin. DAC-18 supports
only creation and unchanged repeat imports. An update or conflict aborts before
containers or artifacts are written. Taxonomy identity and the imported source
fingerprint are stored as module flags on every created artifact.

The concrete adapter creates category-specific folder trees, top-level Actor,
Scene, JournalEntry, and Playlist documents, and embedded JournalEntryPage and
PlaylistSound documents. A host-independent gateway contract keeps execution
unit-testable without a running Foundry instance.

## Consequences

- Repeating the same import does not create duplicates.
- Existing imported content is not silently overwritten.
- Source media must be supplied at the configured module-local paths for a
  complete Foundry smoke test.
- The taxonomy does not provide actor statistics or scene token coordinates, so
  those are deliberately outside this slice.
- Detecting edits to an existing Foundry document beyond its stored import
  fingerprint remains follow-up work before update support is enabled.
