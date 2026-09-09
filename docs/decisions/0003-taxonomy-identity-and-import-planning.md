# ADR 0003: Use taxonomy identity and three-way import planning

Status: accepted for the third implementation increment

## Context

The adaptation maintains a taxonomy manifest whose identifiers describe the
campaign, artifact code, and hierarchical index. Future features need to locate
the same generated elements reliably. Imports must also avoid overwriting work
that a user has changed inside Foundry since the prior import.

## Decision

Taxonomy IDs such as `DS-JPG-08.03.01.01` are the canonical identity for
adaptation artifacts and replace the provisional lowercase content key.

The built-in catalogue supports scene codes `CIN`, `BAT`, `REG`, and `SOC`;
actor codes `NPC`, `AA`, and `SA`; journal codes `JRN` and `JPG`; and `HND`,
`ITM`, `TBL`, `PLY`, `AUD`, and `MAC`. Handouts remain an adaptation concept
with no fixed Foundry document mapping. Journal pages and playlist sounds are
explicit child artifacts with typed parent references.

Before writing to Foundry, the importer produces a plan. Each desired artifact
is fingerprinted deterministically and compared with both the fingerprint saved
at its last import and a fingerprint of the current mapped Foundry data:

- absent documents are created;
- unchanged source and document data are left unchanged;
- changed source with an unchanged document is updated; and
- changed Foundry data, missing provenance, or duplicate IDs are conflicts.

## Consequences

- Configuration, future features, and Foundry flags can share one identity.
- Embedded Foundry documents retain their own taxonomy IDs.
- Import planning is deterministic and testable without Foundry.
- A later Foundry mapper must define which document fields participate in the
  current-document fingerprint.
