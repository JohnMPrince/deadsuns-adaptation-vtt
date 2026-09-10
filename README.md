# Dead Suns Adaptation Importer

A configuration-driven Foundry VTT v14 module for generating the actors, scenes,
journal entries, and related documents used by the Starfinder 1e Dead Suns
adaptation.

The implementation is split into three boundaries:

1. adaptation configuration describes the content;
2. a Foundry-independent domain model validates and relates that content; and
3. Foundry mappers and importers create or update platform documents.

The domain uses adaptation taxonomy IDs such as `DS-JPG-08.03.01.01` as the
canonical identity for generated artifacts. It validates the full supported
artifact-code catalogue and produces a non-mutating import plan before any
Foundry document is changed.

Architecture decisions are recorded in [`docs/decisions`](docs/decisions).

## Development

```sh
pnpm install
pnpm quality
pnpm build
pnpm test
```

Other useful commands include `pnpm dev` for a watch build, `pnpm lint:fix` and
`pnpm format:write` for safe automated fixes, and `pnpm test:coverage` for an
HTML and text coverage report.

Changes to `main` are made through pull requests. The repository's required
`Quality and build` check must pass before a pull request can be merged.
