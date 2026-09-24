import type {
  ContainerCategory,
  ResolvedContainer,
} from "../domain/container-hierarchy.ts";
import type { TaxonomyId } from "../domain/taxonomy-id.ts";
import type { ExistingArtifactState } from "../import/plan-import.ts";
import type { FoundryImportGateway } from "./import-config.ts";
import type {
  FoundryDocumentName,
  MappedFoundryArtifact,
} from "./map-artifact.ts";

const scope = "deadsuns-adaptation-vtt";

interface FoundryDocument {
  readonly id: string;
  readonly uuid: string;
  readonly flags?: Readonly<Record<string, unknown>>;
  readonly pages?: Iterable<FoundryDocument>;
  readonly sounds?: Iterable<FoundryDocument>;
  createEmbeddedDocuments(
    embeddedName: string,
    data: readonly Readonly<Record<string, unknown>>[],
  ): Promise<readonly FoundryDocument[]>;
}

interface FoundryDocumentClass {
  create(
    data: Readonly<Record<string, unknown>>,
  ): Promise<FoundryDocument | readonly FoundryDocument[] | undefined>;
}

export interface FoundryVttRuntime {
  readonly game: {
    readonly actors: Iterable<FoundryDocument>;
    readonly scenes: Iterable<FoundryDocument>;
    readonly journal: Iterable<FoundryDocument>;
    readonly playlists: Iterable<FoundryDocument>;
    readonly folders: Iterable<FoundryDocument>;
  };
  readonly Actor: FoundryDocumentClass;
  readonly Scene: FoundryDocumentClass;
  readonly JournalEntry: FoundryDocumentClass;
  readonly Playlist: FoundryDocumentClass;
  readonly Folder: FoundryDocumentClass;
}

/** Foundry-dependent persistence adapter. Keep this dependency outside domain code. */
export class FoundryVttGateway implements FoundryImportGateway {
  private readonly artifacts = new Map<string, FoundryDocument>();
  private readonly folders = new Map<string, FoundryDocument>();

  public constructor(private readonly runtime: FoundryVttRuntime) {}

  public listExistingArtifacts(): Promise<readonly ExistingArtifactState[]> {
    this.artifacts.clear();
    this.folders.clear();
    const states: ExistingArtifactState[] = [];
    for (const folder of this.runtime.game.folders) {
      const flags = moduleFlags(folder);
      if (typeof flags?.containerKey === "string")
        this.folders.set(flags.containerKey, folder);
    }
    for (const collection of this.topLevelCollections()) {
      for (const document of collection) {
        this.record(document, states);
        for (const page of document.pages ?? []) this.record(page, states);
        for (const sound of document.sounds ?? []) this.record(sound, states);
      }
    }
    return Promise.resolve(states);
  }

  public async ensureContainer(container: ResolvedContainer): Promise<void> {
    const key = containerKey(container.category, container.path);
    if (this.folders.has(key)) return;
    const parent = container.parentPath
      ? this.folders.get(containerKey(container.category, container.parentPath))
      : undefined;
    if (container.parentPath && !parent)
      throw new Error(`Missing parent container ${container.parentPath}.`);
    const folder = await createOne(this.runtime.Folder, {
      name: container.name,
      type: documentNameForCategory(container.category),
      ...(parent ? { folder: parent.id } : {}),
      flags: { [scope]: { containerKey: key } },
    });
    this.folders.set(key, folder);
  }

  public async createArtifact(artifact: MappedFoundryArtifact): Promise<void> {
    let document: FoundryDocument;
    if (artifact.parentTaxonomyId) {
      const parent = this.artifacts.get(artifact.parentTaxonomyId);
      if (!parent)
        throw new Error(
          `Missing embedded parent ${artifact.parentTaxonomyId}.`,
        );
      const [created] = await parent.createEmbeddedDocuments(
        artifact.documentName,
        [artifact.data],
      );
      if (!created)
        throw new Error(`Foundry did not create ${artifact.taxonomyId}.`);
      document = created;
    } else {
      const folder = artifact.containerPath
        ? this.folders.get(
            containerKey(artifact.containerCategory, artifact.containerPath),
          )
        : undefined;
      if (artifact.containerPath && !folder)
        throw new Error(`Missing container ${artifact.containerPath}.`);
      document = await createOne(this.documentClass(artifact.documentName), {
        ...artifact.data,
        ...(folder ? { folder: folder.id } : {}),
      });
    }
    this.artifacts.set(artifact.taxonomyId, document);
  }

  private record(
    document: FoundryDocument,
    states: ExistingArtifactState[],
  ): void {
    const flags = moduleFlags(document);
    if (
      typeof flags?.taxonomyId !== "string" ||
      typeof flags.importedFingerprint !== "string"
    )
      return;
    const taxonomyId = flags.taxonomyId as TaxonomyId;
    this.artifacts.set(taxonomyId, document);
    states.push({
      taxonomyId,
      foundryUuid: document.uuid,
      importedFingerprint: flags.importedFingerprint,
      // DAC-18 only distinguishes new and previously imported sample content.
      documentFingerprint: flags.importedFingerprint,
    });
  }

  private topLevelCollections(): readonly Iterable<FoundryDocument>[] {
    const { game } = this.runtime;
    return [game.actors, game.scenes, game.journal, game.playlists];
  }

  private documentClass(
    name: MappedFoundryArtifact["documentName"],
  ): FoundryDocumentClass {
    if (name === "Actor") return this.runtime.Actor;
    if (name === "Scene") return this.runtime.Scene;
    if (name === "JournalEntry") return this.runtime.JournalEntry;
    if (name === "Playlist") return this.runtime.Playlist;
    throw new Error(`${name} must be created through its parent document.`);
  }
}

function moduleFlags(
  document: FoundryDocument,
): Readonly<Record<string, unknown>> | undefined {
  const value = document.flags?.[scope];
  return typeof value === "object" && value !== null
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;
}

async function createOne(
  documentClass: FoundryDocumentClass,
  data: Readonly<Record<string, unknown>>,
): Promise<FoundryDocument> {
  const created = await documentClass.create(data);
  if (!created || Array.isArray(created))
    throw new Error("Foundry did not create the requested document.");
  return created as FoundryDocument;
}

function containerKey(category: ContainerCategory, path: string): string {
  return JSON.stringify([category, path]);
}

function documentNameForCategory(
  category: ContainerCategory,
): FoundryDocumentName {
  if (category === "actor") return "Actor";
  if (category === "scene") return "Scene";
  if (category === "journal") return "JournalEntry";
  if (category === "playlist") return "Playlist";
  throw new Error(`DAC-18 does not map ${category} containers.`);
}
