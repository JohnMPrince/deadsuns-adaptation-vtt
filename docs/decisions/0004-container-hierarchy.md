# ADR 0004: Explicit logical container hierarchy

Status: proposed for DAC-19 review

## Decision

Configuration may declare a forest of `containers`, each with a stable lowercase
kebab-case `id`, a nonblank display `name`, and an optional `parentId`.
Top-level artifacts select a container with `containerId`. IDs are unique across
the configuration and remain independent of artifact taxonomy IDs and display
names. Roots, depth, and names are configuration choices; no chapter or part
structure is inferred from taxonomy indices. Duplicate display names are
allowed.

`validateConfig` rejects duplicate or invalid IDs, missing parents, cycles,
unknown placements, and ambiguous use of both `containerId` and legacy
`metadata.containerPath`. Journal pages and playlist sounds inherit placement
from their owning artifact and cannot set `containerId`.

`resolveContainerHierarchy` validates the hierarchy and returns containers in
parent-first order, preserving declaration traversal order for unrelated nodes.
Each result includes an ancestry of IDs and an array of display-name segments.
It does not mutate configuration or create Foundry documents. Invalid hierarchy
input is rejected; full artifact validation remains `validateConfig`'s job.

## Compatibility and boundaries

Containers are optional. Existing configurations and legacy free-text paths
continue to validate, but legacy paths are not converted into container IDs. An
artifact's explicit placement participates in its existing fingerprint, so
moving it produces an update or conflict through the existing three-way planner.
Renaming or reparenting a container does not alter artifact identity or artifact
fingerprints. Folder reconciliation needs its own future state and provenance.

Logical containers do not encode Foundry document types, folder depth limits,
UUIDs, or persistence. A later mapper must project this hierarchy into the
appropriate document-specific folders, reconcile container changes, and resolve
embedded document placement through their owners. This change does not claim to
plan or execute folder creation.

## Scope evidence

The referenced DAC-19 conversation supplies the task title but no detailed
acceptance criteria. This proposal follows ADR 0001 and ADR 0003;
campaign-specific container names and any mandatory level constraints remain to
be confirmed.

The user subsequently supplied the initial hierarchy: Dead Suns Adaptation with
Miscellaneous, Locations, Elements, and Chapter 1 as direct children. It is
provided as `deadSunsContainers` in the configuration layer, with no
domain-level special cases or implied extra levels.
