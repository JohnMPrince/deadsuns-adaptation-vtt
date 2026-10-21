# ADR 0008: Keep artifact metadata opaque in the domain

Status: accepted for DAC-27

## Decision

Every artifact supports an optional metadata object with arbitrary keys and
recursive JSON values. The domain preserves these values without interpreting
placement, dataset, or integration-specific properties. This supersedes the
metadata-specific typing and validation decisions in ADRs 0001, 0004 and 0007.

Structural boundaries reject non-object metadata, non-finite numbers, undefined
values, functions, non-JSON object types and circular references. Construction
retains the input; JSON serialization preserves accepted JSON values.

Container validation and resolution live in src/import/container-hierarchy.ts.
The import planner validates placement before planning work. The domain's
validateConfig and JSON parser no longer validate container semantics. Callers
of the former domain container exports must import from the import layer.

Existing Foundry mapping and spreadsheet key normalization remain consumer
concerns. DAC-27 adds no integration-specific validation or import mappings;
Syrinscape business rules belong to DAC-28 or subsequent stories. The
spreadsheet Dataset column still filters source rows, while an explicitly
authored metadata key named dataset is ordinary JSON data.
