# Dead Suns Adaptation Importer

A configuration-driven Foundry VTT v14 module for generating the actors, scenes,
journal entries, and related documents used by the Starfinder 1e Dead Suns
adaptation.

The implementation is split into three boundaries:

1. adaptation configuration describes the content;
2. a Foundry-independent domain model validates and relates that content; and
3. Foundry mappers and importers create or update platform documents.

The first increment establishes only the domain boundary. See
[`docs/decisions/0001-configuration-domain-boundary.md`](docs/decisions/0001-configuration-domain-boundary.md).

## Development

```sh
pnpm install
pnpm check
pnpm test
```
