# ADR 0001: Separate adaptation content from Foundry documents

Status: accepted as the initial architectural direction; identity details
superseded by ADR 0003

## Context

The adaptation will contain many related actors, scenes, journals, encounter
content, and assets. Foundry document schemas are persistence and UI concerns;
using those schemas as authoring configuration would couple the content to
Foundry v14 and make validation, migration, and testing unnecessarily difficult.

## Decision

Configuration is the source of truth for adaptation metadata. It is interpreted
through a Foundry-independent domain model before any Foundry documents are
created or updated.

Every content definition has a stable, human-readable key. Relationships use
these keys rather than Foundry UUIDs. The import layer will resolve keys to
Foundry documents and store the key in module-owned flags to support idempotent
create/update behaviour.

The dependency direction is:

```text
adaptation configuration -> domain model <- Foundry mapping/import layer
```

Domain definitions must not import Foundry types. Foundry-specific fields belong
in later mapping policy unless they express an actual adaptation concept.

## Initial scope

The first domain slice models actors, scenes, journals, journal pages, and their
typed relationships. Encounters are authored within journal pages and composed
from referenced taxonomy artifacts such as scenes, actors, playlists, and
playlist sounds; they are not a standalone artifact kind. Additional content
kinds should be added when a concrete import use case requires them.

Spreadsheet dataset labels are source-ingestion filters, not artifact metadata.
Dataset provenance should enter the domain only if a concrete requirement needs
the model to track which dataset supplied an artifact.

## Consequences

- Content can be validated before Foundry starts.
- Foundry version changes are isolated in mapping and import code.
- Stable keys make repeated imports deterministic.
- The domain model requires deliberate mappings instead of passing configuration
  directly to Foundry document constructors.
