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

This skeleton targets Foundry generation 14 and has been smoke-tested on Foundry
14.367 with SF1E (`sfrpg`) 14.0.2. No release download or manifest URL is
advertised yet; installation is manual. The skeleton has no system-specific
document mapping or system dependency.

### Manual Foundry smoke test

1. Confirm the module appears in Manage Modules and can be enabled in
   Foundry 14.
2. Reload the world and check the browser console for one `Initialized` and one
   `Ready (DAC-18 sample import available)` message from
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

### Recorded local validation

The user supplied screenshots confirming these results in a local Foundry 14.367
world running SF1E (`sfrpg`) 14.0.2:

- Module enabled; both `Initialized` and `Ready` messages appeared.
- The API exposed `taxonomyId`, `validateConfig`, and `planImport`.
- An example playlist (`EX-PLY-08.14.01.00`) validated with no issues.
- Planning returned one create and zero updates, unchanged entries, or
  conflicts.
- Changing the configuration campaign to `OTHER` produced a campaign mismatch.
- The Playlists sidebar remained empty: planning did not create the playlist.

The initial installed bundle was stale; rebuilding resolved the missing startup
code. SF1E deprecation warnings were observed separately. This verifies the
skeleton's startup and planning API, not document import or system validation.
The optional disable-and-reload check has not been reported.

### Implemented boundary

`src/foundry/entry.ts` is the browser startup entry. Its lifecycle adapter
registers `init` and `ready` hooks and attaches the read-only API above during
`init`. `src/index.ts` remains the host-independent library entry for
developers. The manifest stays at the repository/module root; Vite builds only
the JavaScript and source map into `dist/`, with public-directory copying
disabled. Keep the manifest development version aligned with `package.json`.

DAC-18 now provides the first bounded import slice. Later stories can expand the
supported artifact types, update policy, user-facing trigger, and diagnostics
without moving Foundry concerns into the domain model.

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

## Container configuration

Each artifact's `metadata.containerPath` is the source of its logical placement:

```ts
metadata: {
  containerPath: "Dead Suns Adaptation/Chapter 1/Part 1";
}
```

Call `validateConfig(config)` before import. `resolveContainerHierarchy(config)`
returns the desired containers, including all parents, in parent-first order.
Identity is the pair `(category, path)`: Scenes at the same path share
containers, while Playlists at that path form a separate tree. Scene and Actor
subtypes share their respective categories. No container declarations or
taxonomy IDs are needed.

Paths are case-sensitive slash-separated names. A single trailing slash is
accepted and removed for resolution. Empty names, surrounding whitespace, dot
segments, backslashes, and control characters are rejected. Omit the field for
unassigned content. There is no domain depth limit. Journal pages and playlist
sounds inherit their owner's placement; an explicit path must match the owner's.

`deadSunsContainerPaths` exports suggested root, Miscellaneous, Locations,
Elements, and Chapter 1 paths beneath Dead Suns Adaptation. Only paths actually
referenced by artifacts (and their parents) become desired containers.

The future importer must create missing containers in each mapped document
category and reconcile existing ones. This resolver does not write to Foundry.
Handouts retain a separate logical category pending a concrete document mapping.
See [ADR 0004](docs/decisions/0004-container-hierarchy.md).

## DAC-18 Docking Bay sample

`dac18SampleConfig` contains the dependency-complete 16-artifact slice from Part
I through Detective Elias Mercer: three journals, four pages, one battle scene,
three actors, one playlist, and four sounds. The configuration preserves the
taxonomy IDs and container paths from the Initial dataset. It adds only the
minimum sample prose and explicit module-local media paths needed by the domain
contract.

The module API exposes `importDac18Sample()` for a deliberate manual run in a
disposable test world:

```js
const api = game.modules.get("deadsuns-adaptation-vtt").api;
await api.importDac18Sample();
```

The importer validates and plans the entire configuration before creating any
folders or documents. It creates owners before embedded journal pages and
playlist sounds, records taxonomy IDs and source fingerprints in module flags,
and treats a second run as unchanged instead of creating duplicates. DAC-18
rejects update and conflict plans; it does not overwrite existing content.

The configured image and audio paths are stable targets, but the corresponding
licensed media files are not stored in this repository. Supply those files at
the configured module paths before using the sample to verify media playback.
The three actors are created as SF1E NPC documents; token placement and actor
system statistics require later configuration because the Initial taxonomy does
not contain those values.
