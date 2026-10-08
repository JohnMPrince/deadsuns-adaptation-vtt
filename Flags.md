# Module flags

Foundry stores custom document metadata under `flags.<scope>.<key>`. This module
uses the scope `deadsuns-adaptation-vtt` to keep its metadata separate from
other modules and systems. The nested objects represent the scope and its
key/value properties, rather than a duplicate copy of the flags.

| Key                    | Stored on                                                                                      | Purpose                                                                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `taxonomyId`           | Imported Actors, Items, Scenes, Journal Entries, Journal Pages, Playlists, and Playlist Sounds | Stable configured artifact identity used to find previously imported documents.                                                                 |
| `importedFingerprint`  | The same imported artifacts                                                                    | Fingerprint of the source configuration at creation. Used with taxonomy identity to recognize unchanged repeat imports.                         |
| `journalContentSource` | Journal Pages with a `content` asset reference                                                 | Configured Markdown source path. Recorded even when HTTP 404 causes inline content to be retained. It does not automatically reload the source. |
| `containerKey`         | Folders created by the importer                                                                | JSON-encoded pair of category and normalized logical container path, used to reuse folders.                                                     |

For example, a Journal Page may store:

```json
{
  "flags": {
    "deadsuns-adaptation-vtt": {
      "taxonomyId": "DS-JPG-01.01.01.01",
      "importedFingerprint": "<source fingerprint>",
      "journalContentSource": "assets/journals/page.md"
    }
  }
}
```

The gateway preserves other scopes and existing keys in this module's scope when
adding the journal source. The current gateway reports the stored source
fingerprint as the document fingerprint too; it does not detect manual edits to
Foundry document content. Update/conflict plans are rejected by the
creation-only importer.

## Foundry fields and importer-only fields

Actor `img` stores the portrait path. `prototypeToken.texture.src` stores the
image for the Actor's prototype token; it does not place a token into a Scene or
change existing Scene tokens.

Journal Page `text` is a Foundry document field. The existing inline fallback
uses `text.content` and `format: 1` (HTML). The configuration calls that inline
field `markdown`, but this legacy mapping does not convert it to HTML. Loaded
Markdown sources use `text.markdown` and `format: 2` (Markdown). This change
preserves the legacy mapping; it does not establish live rendering
compatibility.

The mapper's local `contentSource` variable selects the first `content` asset
path. `MappedFoundryArtifact.journalContentSource` passes that path to the
gateway's loader. It is importer metadata, not a native Foundry page property.
The gateway loads it only while creating a page, supplies the resulting text to
Foundry, and records the path in the module flag described above.

Foundry v14 references:

- [Document flags](https://foundryvtt.com/api/v14/classes/foundry.documents.BaseDocument.html)
- [Actor](https://foundryvtt.com/api/v14/classes/foundry.documents.Actor.html)
- [Journal text fields](https://foundryvtt.com/api/v14/interfaces/foundry.documents.types.JournalEntryPageTextData.html)
- [Journal formats: HTML = 1, Markdown = 2](https://foundryvtt.com/api/v14/variables/CONST.JOURNAL_ENTRY_PAGE_FORMATS.html)
