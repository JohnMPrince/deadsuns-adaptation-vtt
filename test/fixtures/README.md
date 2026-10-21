# DAC-25 fixtures

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
