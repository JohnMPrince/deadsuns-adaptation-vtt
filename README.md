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

## Development module installation (DAC-12)

Run `pnpm build`. Copy the root `module.json` and the entire `dist/` folder into
`<Foundry User Data>/Data/modules/deadsuns-adaptation-vtt/`. Preserve this
layout:

```text
deadsuns-adaptation-vtt/
  module.json
  dist/
    deadsuns-adaptation-vtt.js
    deadsuns-adaptation-vtt.js.map
```

The manifest loads `dist/deadsuns-adaptation-vtt.js` relative to the module
root. You can also use the built repository itself as the module folder. Do not
move the manifest into `public/` or flatten the contents of `dist/`. Restart
Foundry, open a test world, and enable **Dead Suns Adaptation Importer** in
Manage Modules.

This skeleton targets Foundry generation 14. The manifest deliberately omits
`compatibility.verified` until an actual Foundry smoke test is recorded. No
release download or manifest URL is advertised yet; installation is manual. The
skeleton has no system-specific document mapping or system dependency.

### Manual Foundry smoke test

1. Confirm the module appears in Manage Modules and can be enabled in
   Foundry 14.
2. Reload the world and check the browser console for one `Initialized` and one
   `Ready (validation and planning only)` message from
   `deadsuns-adaptation-vtt`.
3. Confirm there are no module startup errors or failed module file requests.
4. In the browser console, run:

   ```js
   const api = game.modules.get("deadsuns-adaptation-vtt").api;
   const config = { campaign: "EX", title: "Example", artifacts: [] };
   api.validateConfig(config); // []
   await api.planImport(config, []); // empty entries; all counts zero
   ```

5. Confirm loading and planning create no documents. Disable the module and
   reload; its startup messages should no longer appear.

Record the Foundry build, game system/version, and outcome when performing this
test. Automated tests use a host double and do not establish runtime
compatibility.

### Implemented boundary

`src/foundry/entry.ts` is the browser startup entry. Its lifecycle adapter
registers `init` and `ready` hooks and attaches the read-only API above during
`init`. `src/index.ts` remains the host-independent library entry for
developers. The manifest stays at the repository/module root; Vite builds only
the JavaScript and source map into `dist/`, with public-directory copying
disabled. Keep the manifest development version aligned with `package.json`.

DAC-17 adds the import trigger, DAC-18 adds sample mapping and writes, DAC-19
defines container hierarchy, and DAC-20 expands diagnostics. Those capabilities
are not implemented by this skeleton.

The manifest and lifecycle follow Foundry's
[module development guide](https://foundryvtt.com/article/module-development/)
and
[v14 init hook](https://foundryvtt.com/api/v14/functions/hookEvents.init.html).

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
