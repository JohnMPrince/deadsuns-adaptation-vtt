# ADR 0009: Apply artifact metadata during Foundry import

Status: accepted for DAC-28

## Mapping boundary

The domain continues to accept arbitrary JSON metadata. A small Foundry-layer
mapper interprets only supported integration properties. Unknown keys are
ignored by mapping and remain in source JSON and fingerprints. Invalid supported
values raise errors containing the taxonomy ID and metadata path. All mappings
are checked before any writes; persistence failures use the existing error path.

Syrinscape Controller **1.1.0** was inspected in the installed Foundry data
folder (`modules/syrinscape-control/module.mjs`). Its track configuration at
lines 1439–1455 writes `flags.syrinscape-control.soundType` and `.soundId`. Its
playback getter at lines 1367–1369 reads those same flags. The importer writes
an ID string and `element` or `mood`; it never initiates playback or checks
external availability.

Playlist sounds accept `syrinscapeSoundID` / `syrinscapeSoundType`, or
`syrinscape: { soundId, soundType }`. IDs accept nonblank strings or positive
safe integers. Types accept `Element`, `Mood`, `element`, or `mood`. Either
field may be omitted for partial configuration. Matching aliases are allowed;
conflicting aliases, malformed values, and supported keys on other artifact
kinds are errors. Unknown keys inside the nested object are ignored.

## Re-imports

New imports store `importedStructureFingerprint`, hashing the source with
metadata excluded except for container placement. Metadata-only source changes
may update flags in place when that baseline matches. Content, assets, parents
and placement changes remain unsupported; duplicate identities and planner
conflicts still fail. The result adds an `updated` count. Unchanged re-imports
perform no writes.

Updates use dotted flag paths, preserving unrelated flags and native content.
`importedSyrinscapeFields` records which Controller keys this importer owns, so
removing metadata clears those keys without clearing manually supplied keys the
importer never managed. Fingerprints and mapped flags are persisted in the same
document update. After a partial failure, successful artifacts are unchanged on
retry and remaining updates resume.

Pre-DAC-28 documents have no structural baseline. Unchanged imports still work;
changed imports are rejected with an explanatory error. Recreate those artifacts
in a disposable test world to establish the baseline. No automatic migration or
manual-edit detection is introduced: the gateway still uses the recorded import
fingerprint as its document fingerprint, as in DAC-18.

Automated mapping, preflight, gateway update/removal, failure recovery and
repeat import tests cover the contract. Live Foundry import/playback has not
been tested for DAC-28.
