# Test fixtures

`sample-adaptation-config.ts` exports `sampleAdaptationConfig` for general
import, asset mapping and gateway tests. It clones the public demo configuration
to reuse representative content without sharing object identity. Tests
specifically covering the DAC-18 demo continue to use `dac18SampleConfig`
directly; the public demo API retains its existing name.

## DAC-25 ingestion fixtures

`taxonomy-ownership.tsv` contains the journal/page subset supplied during DAC-25
design review. Its eight pages exercise exact Index ownership and the unique
two-segment Locations fallback. The sheet contains no fabricated journal prose.

`taxonomy-workbook.xlsx` is a minimal OOXML test fixture containing
Instructions, Taxonomy, and Invalid worksheets. Taxonomy has a journal, page,
playlist, and sound, a blank third row, sparse cells, and multiline asset and
Syrinscape metadata cells. Invalid has a numeric Index on physical row 3.

`ambiguous-workbook.xlsx` contains two header-only worksheets, First and Second,
to exercise explicit sheet selection. These are generated test fixtures, not the
user's saved workbook. All media paths in workbook fixtures are examples.
