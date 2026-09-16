# ADR 0004: Derive category-scoped containers from artifact paths

Status: proposed for DAC-19 review; replaces the initial explicit-ID proposal

## Decision

Artifact taxonomy metadata `containerPath` defines logical placement. The pair
of artifact category and canonical path identifies a container. Categories use
existing domain kinds, independent of Foundry classes. Scene subtypes share one
scene hierarchy; Actor subtypes share one actor hierarchy. Scenes and Playlists
at the same path remain separate. Handouts remain their own category until a
concrete Foundry mapping is decided.

Paths contain arbitrary slash-separated names. Resolution accepts a single
trailing slash, preserves case and Unicode, and rejects empty segments, leading
slashes, surrounding name whitespace, dot segments, backslashes, and control
characters. No domain depth limit or filesystem semantics apply. Omitted paths
mean unassigned placement. Validation runs through `validateConfig` before the
existing import planner can proceed.

`resolveContainerHierarchy` derives every ancestor and deduplicates by category
and path. Output is deterministic for the same input, parent-first, with
unrelated branches ordered by first reference. Each result supplies category,
canonical path, name, and an optional parentPath in the same category. It
neither mutates configuration nor creates Foundry documents. Callers must use
`validateConfig` for full artifact identity and relationship validation; the
resolver validates container paths and embedded placement only.

Journal pages and playlist sounds inherit placement from their owning documents.
An explicit child path is accepted only if it matches the owner's canonical
path; it cannot create an independent folder hierarchy. Missing owner references
are handled by existing artifact reference validation.

## Configuration and compatibility

The five initial Dead Suns paths are authoring constants in
`deadSunsContainerPaths`: the campaign root and its Miscellaneous, Locations,
Elements, and Chapter 1 children. They are suggestions, not a required global
tree for every category. Only referenced paths and ancestors are resolved.

The unreleased explicit `containerId`, `ContainerDefinition`, and `containers`
configuration introduced in the first DAC-19 commit are removed. Existing
`metadata.containerPath` is now the authoritative, validated field, rather than
a legacy fallback. Containers do not need taxonomy IDs.

Artifact fingerprints continue to include the authored metadata. A path change
participates in the existing three-way update/conflict checks. Spelling changes
such as adding a trailing slash can change an artifact fingerprint even though
container resolution is equivalent; fingerprint semantics are unchanged here.

## Future importer responsibilities

The resolved hierarchy describes desired containers, including absent parents. A
future importer must map categories to Foundry document types, look up existing
containers by category and path, and create missing containers parent-first.
Foundry depth limits, folder state/provenance, rename/move reconciliation, and
handout mapping remain adapter concerns. No persistence or folder reconciliation
is claimed by this domain-only change.

## Acceptance coverage

Tests cover roots, arbitrary nesting, automatic parents, duplicate references,
shared subtype trees, category isolation, invalid names/paths, embedded
placement, configuration immutability, and artifact import updates when paths
change.
