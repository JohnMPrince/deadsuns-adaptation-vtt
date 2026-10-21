# Developer console JSON import smoke test

User-run local Foundry smoke test, confirmed in the review conversation. The
tested change sets the module manifest version to 0.4.0; the running module,
Foundry build, and system version were not independently captured in this run.

## Confirmed results

- JSON containing a journal, journal page, scene, playlist, and playlist sound
  imported successfully: 5 created, 0 unchanged, no errors.
- An unchanged repeat returned 0 created, 5 unchanged, no errors.
- The journal page loaded `dac24-smoke/page.md` and rendered Markdown headings,
  bold, italic, and lists correctly.
- The scene was created without a background, matching its configuration.
- The playlist sound used `dac24-smoke/track.ogg`; playback was confirmed.
- Malformed JSON returned `success: false`, stage `syntax`.
- An empty object returned `success: false`, stage `structure`.
- Changing the journal name returned `success: false`, stage `import`; the
  journal retained its original name, Part III, and content.
- A non-GM invocation returned `success: false`, stage `authorization`.

The initial Markdown request returned HTTP 404 because the physical filename was
different. Renaming it to `page.md` and recreating the disposable test artifacts
verified content loading. Unchanged repeat imports do not reload previously
missing content.

This confirms the console workflow for the five tested artifact kinds and
existing mappings. Actor and Item creation, scene backgrounds, partial-failure
recovery, and new artifact-specific metadata mappings were not part of this live
test. Automated coverage remains separate from these user-run results.
