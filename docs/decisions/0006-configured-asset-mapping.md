# ADR 0006: Configured asset mapping (DAC-24)

Status: Accepted

DAC-23 supplies ordered, nullable asset references with open role strings. The
Foundry boundary selects the first exact, case-sensitive match for each
supported slot. Unknown roles remain valid configuration and are ignored by this
mapper. Duplicates retain their domain order; the mapper does not mutate
configuration.

| Artifact                         | Role         | Foundry field                          |
| -------------------------------- | ------------ | -------------------------------------- |
| Scene                            | `background` | `background.src`                       |
| Actor                            | `portrait`   | `img`                                  |
| Actor                            | `token`      | `prototypeToken.texture.src`           |
| Item                             | `portrait`   | `img`                                  |
| Journal Page                     | `content`    | Markdown source for content population |
| Playlist Track (`playlistSound`) | `audio`      | `path`                                 |

Configured references override legacy scene backgrounds and sound sources.
Omitted, null, empty, or unrecognized references preserve legacy mappings.
Journal pages remain text pages. A `content` reference identifies the `.md`
source that the gateway loads when creating the page. Loaded source becomes
`text.markdown` with Foundry's Markdown format (`2`); pages without a content
reference retain their existing inline text mapping. `image` has no special
meaning for Items or Journal Pages in this scope.

Items become top-level SF1E `equipment` documents with Item folders. The domain
has no Item subtype or system statistics yet. This is a minimal import
placeholder, analogous to the existing Actor mapping, rather than a complete
equipment model. The gateway includes Items in provenance discovery so repeated
imports do not duplicate them, including after restarting the gateway.

Image and audio paths are supplied to Foundry verbatim: no module prefix,
normalization, fetch, or existence check. Absent media files do not prevent
document creation. Foundry remains responsible for loading media.

Markdown content paths are also passed unchanged to an injectable gateway
loader, whose default uses browser `fetch`. HTTP 404 preserves inline content,
and the configured source is stored in module provenance flags as
`journalContentSource`. Other HTTP and network failures stop page creation with
an error naming the page and source. Successfully created documents can be
retained and the import resumed. Empty loaded files are valid content. The
loader runs only for new pages, never for unchanged imports. A missing file
supplied later does not repopulate an already imported page; that requires a
future explicit update policy.

References continue to participate in source fingerprints; changes are planned
as updates and rejected by the existing creation-only importer before writes. No
update/migration policy is added.

References:

- [Foundry v14 JournalEntryPage schema](https://foundryvtt.com/api/classes/foundry.documents.JournalEntryPage.html)
- [Foundry v14 Markdown format](https://foundryvtt.com/api/v14/variables/CONST.JOURNAL_ENTRY_PAGE_FORMATS.html)
- [SF1E manifest and equipment document type](https://github.com/foundryvtt-starfinder/foundryvtt-starfinder/blob/development/static/system.json)

Validation uses mapper tests and a Foundry runtime double. A live Foundry v14 /
SF1E smoke test is still required to establish runtime compatibility.
