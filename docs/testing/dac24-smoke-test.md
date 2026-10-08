# DAC-24 v14 Scene Level retest

The previous live smoke test created the artifacts but left the Scene background
empty. This fix supplies an embedded Level instead of deprecated Scene
background creation data. Install a fresh build of this branch and restart
Foundry.

Use the same disposable SF1E world and files under Data/dac24-smoke. The script
below uses fresh SMOKEV14 taxonomy IDs and the DAC24 v14 Smoke Test folder, so
it does not delete or repair previous results. It creates 15 artifacts on its
first run. The module's original sample configuration is restored after imports;
do not run another sample import concurrently.

Paste the script below into the developer console, then run:

```js
await dac24Smoke.run();
```

Expect 15 created, zero unchanged, and all verification rows passing. Open the
new Scene from the DAC24 v14 Smoke Test folder: its Initial Level background
must be populated and its image must display. The verifier must not produce a
Scene#background deprecation warning. Repeat the import, then reload, paste the
script again, and repeat: expect zero created and 15 unchanged each time.

Continue checking Actor and Item images, both audio formats, rendered Markdown,
and missing-file fallback behavior. Run await dac24Smoke.rejectChangedAsset()
after the successful import to check the creation-only rejection policy.

The previous failed Scene is intentionally left unchanged. Its source
fingerprint still matches its configuration, so a repeat import cannot repair it
automatically.

## Console script

```js
// Run in the Foundry desktop developer console in a disposable SF1E test world.
// Use the same files and configuration for every repeat-import test.
(async () => {
  const scope = "deadsuns-adaptation-vtt";
  const api = game.modules.get(scope)?.api;
  if (!api?.importDac18Sample)
    throw new Error("Enable the rebuilt module first.");
  const root = "DAC24 v14 Smoke Test";
  const base = "dac24-smoke"; // Folder beneath Foundry's Data directory.
  const id = (code, index = "01") => `SMOKEV14-${code}-01.01.01.${index}`;
  const asset = (role, file) => ({ role, path: `${base}/${file}` });
  const make = (kind, code, name, extra = {}, index = "01") => ({
    kind,
    taxonomyId: id(code, index),
    name,
    metadata: { containerPath: root },
    ...extra,
  });
  const config = {
    campaign: "SMOKEV14",
    title: root,
    artifacts: [
      make("journal", "JRN", "DAC24 Journal"),
      make("journalPage", "JPG", "DAC24 Loaded Markdown", {
        journal: { taxonomyId: id("JRN") },
        markdown: "INLINE FALLBACK — loaded file should replace this.",
        assets: [asset("content", "dac24-smoke.md")],
      }),
      make(
        "journalPage",
        "JPG",
        "DAC24 Missing Markdown",
        {
          journal: { taxonomyId: id("JRN") },
          markdown: "Missing-file fallback retained.",
          assets: [asset("content", "intentionally-missing.md")],
        },
        "02",
      ),
      make(
        "journalPage",
        "JPG",
        "DAC24 Inline Page",
        {
          journal: { taxonomyId: id("JRN") },
          markdown: "Legacy inline content retained.",
        },
        "03",
      ),
      make("scene", "BAT", "DAC24 Background", {
        background: `${base}/unused-legacy-background.webp`,
        assets: [asset("background", "background.webp")],
      }),
      ...["NPC", "AA", "SA"].map((code) =>
        make("actor", code, `DAC24 ${code}`, {
          assets: [
            asset("portrait", "portrait.webp"),
            asset("token", "token.webp"),
          ],
        }),
      ),
      make("actor", "NPC", "DAC24 No Assets", {}, "02"),
      make(
        "actor",
        "NPC",
        "DAC24 Missing Images",
        {
          assets: [
            asset("portrait", "intentionally-missing.webp"),
            asset("token", "intentionally-missing-token.webp"),
          ],
        },
        "03",
      ),
      make("item", "ITM", "DAC24 Item Portrait", {
        assets: [asset("portrait", "portrait.webp")],
      }),
      make("playlist", "PLY", "DAC24 Audio"),
      ...["track.ogg", "track.m4a", "intentionally-missing.ogg"].map(
        (file, i) =>
          make(
            "playlistSound",
            "AUD",
            `DAC24 ${file}`,
            {
              playlist: { taxonomyId: id("PLY") },
              source: `${base}/unused-legacy.ogg`,
              assets: [asset("audio", file)],
            },
            String(i + 1).padStart(2, "0"),
          ),
      ),
    ],
  };
  const issues = api.validateConfig(config);
  if (issues.length) {
    console.table(issues);
    throw new Error("Invalid smoke configuration.");
  }

  // The current public API exposes the production gateway only through the sample
  // import. Temporarily supply this test config to that entry point, restoring
  // the original sample in finally. No source files or installed bundle change.
  async function importConfig(selected) {
    const sample = api.dac18SampleConfig;
    const saved = {
      campaign: sample.campaign,
      title: sample.title,
      artifacts: sample.artifacts,
    };
    try {
      Object.assign(sample, selected);
      return await api.importDac18Sample();
    } finally {
      Object.assign(sample, saved);
    }
  }

  function documents() {
    return [
      ...game.actors,
      ...game.items,
      ...game.scenes,
      ...game.journal,
      ...game.playlists,
      ...[...game.journal].flatMap((doc) => [...doc.pages]),
      ...[...game.playlists].flatMap((doc) => [...doc.sounds]),
    ];
  }

  function verify() {
    const docs = documents();
    const checks = [];
    const check = (test, pass) => checks.push({ test, pass: Boolean(pass) });
    for (const artifact of config.artifacts) {
      const matches = docs.filter(
        (doc) => doc.getFlag(scope, "taxonomyId") === artifact.taxonomyId,
      );
      check(`${artifact.name}: exactly one document`, matches.length === 1);
      const doc = matches[0];
      if (!doc) continue;
      check(
        `${artifact.name}: fingerprint stored`,
        typeof doc.getFlag(scope, "importedFingerprint") === "string",
      );
      for (const reference of artifact.assets ?? []) {
        if (reference.role === "portrait")
          check(`${artifact.name}: portrait path`, doc.img === reference.path);
        if (reference.role === "token")
          check(
            `${artifact.name}: token path`,
            doc.prototypeToken.texture.src === reference.path,
          );
        if (reference.role === "background") {
          check(`${artifact.name}: exactly one Level`, doc.levels.size === 1);
          check(
            `${artifact.name}: initial Level background path`,
            doc.initialLevel?.background.src === reference.path,
          );
        }
        if (reference.role === "audio")
          check(`${artifact.name}: audio path`, doc.path === reference.path);
        if (reference.role === "content")
          check(
            `${artifact.name}: source flag`,
            doc.getFlag(scope, "journalContentSource") === reference.path,
          );
      }
      if (artifact.name === "DAC24 Loaded Markdown") {
        check("Loaded page: Markdown format", doc.text.format === 2);
        check(
          "Loaded page: file content",
          doc.text.markdown?.includes("# DAC-24 Markdown smoke test"),
        );
      }
      if (
        ["DAC24 Missing Markdown", "DAC24 Inline Page"].includes(artifact.name)
      )
        check(
          `${artifact.name}: fallback content`,
          doc.text.content === artifact.markdown,
        );
    }
    console.table(checks);
    return { passed: checks.every((row) => row.pass), checks };
  }

  globalThis.dac24Smoke = {
    config,
    verify,
    async run() {
      const result = await importConfig(config);
      console.log("DAC24 import", {
        created: result.created,
        unchanged: result.unchanged,
        counts: result.plan.counts,
      });
      return { result, verification: verify() };
    },
    async rejectChangedAsset() {
      const changed = structuredClone(config);
      changed.artifacts.find((a) => a.kind === "item").assets[0].path =
        `${base}/changed.webp`;
      try {
        await importConfig(changed);
      } catch (error) {
        if (
          !error.message.includes(
            "initial creation and unchanged repeat imports only",
          )
        )
          throw error;
        console.log(
          "PASS: changed asset rejected by the creation-only policy.",
        );
        return verify();
      }
      throw new Error("FAIL: changed asset was not rejected.");
    },
  };
  console.log(
    "Foundry",
    game.version,
    "System",
    game.system.id,
    game.system.version,
  );
  console.log(
    "Ready: await dac24Smoke.run() — creates 15 test artifacts on the first run.",
  );
})();
```
