import {
  type Config,
  ConfigSchema,
  type Folder,
  type FolderId,
  FolderSchema,
  INBOX_PROJECT_ID,
  IsoUtcSchema,
  type Item,
  type ItemId,
  ItemTypeSchema,
  LocalDateSchema,
  LocalTimeSchema,
  PrioritySchema,
  type Project,
  type ProjectId,
  ProjectIdSchema,
  ProjectSchema,
  RecurrenceRuleSchema,
  StatusSchema,
  SubtaskSchema,
  type Tag,
  type TagId,
  TagSchema,
} from '@tasko/types';
import pLimit from 'p-limit';
import { ulid } from 'ulid';
import { z } from 'zod';
import { atomicWrite, deleteFile, listDir, moveFile, readJsonFile, stringify } from './fs-store.js';
import { buildMutex } from './mutex.js';
import { type Paths, buildPaths } from './paths.js';

// A relaxed ProjectSchema for disk reads: accepts any string as id so the Inbox sentinel
// ('00000000000000000000INBOX0') can be loaded even though it contains 'I' and 'O' which are
// not in the ULID base32 alphabet. The strict ProjectIdSchema (with regex) is used for
// user-supplied input validation in routes.
const ProjectDiskSchema = ProjectSchema.extend({ id: z.string().brand<'ProjectId'>() });

// A relaxed ItemSchema for disk reads: id fields accept any string so that items whose
// project_id is INBOX_PROJECT_ID can be loaded without failing the ULID regex check.
const ItemDiskSchema = z
  .object({
    id: z.string().brand<'ItemId'>(),
    schema_version: z.literal(1),
    type: ItemTypeSchema,
    project_id: z.string().brand<'ProjectId'>(),
    parent_id: z.string().brand<'ItemId'>().nullable(),

    title: z.string().min(1).max(500),
    notes: z.string().max(50_000).default(''),

    due_date: LocalDateSchema,
    start_date: LocalDateSchema.nullable(),
    due_time: LocalTimeSchema.nullable(),

    priority: PrioritySchema.default('none'),
    status: StatusSchema.default('todo'),

    tags: z.array(z.string().brand<'TagId'>()).default([]),
    subtasks: z.array(SubtaskSchema).default([]),
    recurrence: RecurrenceRuleSchema.nullable(),

    completed_at: IsoUtcSchema.nullable(),
    trashed_at: IsoUtcSchema.nullable(),
    trashed_with: z.string().brand<'ItemId'>().nullable(),

    sort_order: z.number().int(),

    created_at: IsoUtcSchema,
    updated_at: IsoUtcSchema,
  })
  .refine((v) => v.start_date === null || v.start_date <= v.due_date, {
    path: ['start_date'],
    message: 'start_date must be on or before due_date',
  });

export interface Index {
  items: Map<ItemId, Item>;
  trash: Map<ItemId, Item>;
  projects: Map<ProjectId, Project>;
  folders: Map<FolderId, Folder>;
  tags: Map<TagId, Tag>;
  tagsByLower: Map<string, TagId>;
  config: Config;
  childrenOfItem: Map<ItemId, Set<ItemId>>;
  topLevelByProject: Map<ProjectId, Set<ItemId>>;
  itemsByTag: Map<TagId, Set<ItemId>>;
}

export interface WriteOps {
  writeItem(item: Item): Promise<void>;
  moveItemToTrash(item: Item): Promise<void>;
  moveItemFromTrash(item: Item): Promise<void>;
  removeItem(id: ItemId): Promise<void>;
  removeFromTrash(id: ItemId): Promise<void>;
  writeProject(project: Project): Promise<void>;
  removeProject(id: ProjectId): Promise<void>;
  writeFolder(folder: Folder): Promise<void>;
  removeFolder(id: FolderId): Promise<void>;
  writeTag(tag: Tag): Promise<void>;
  removeTag(id: TagId): Promise<void>;
  writeConfig(config: Config): Promise<void>;
}

export interface Indexer {
  bootstrap(): Promise<{
    items: number;
    projects: number;
    folders: number;
    tags: number;
    trashed: number;
    warnings: string[];
  }>;
  getIndex(): Index;
  withWriteLock<T>(fn: (index: Index, ops: WriteOps) => Promise<T>): Promise<T>;
}

function buildEmptyIndex(config: Config): Index {
  return {
    items: new Map(),
    trash: new Map(),
    projects: new Map(),
    folders: new Map(),
    tags: new Map(),
    tagsByLower: new Map(),
    config,
    childrenOfItem: new Map(),
    topLevelByProject: new Map(),
    itemsByTag: new Map(),
  };
}

function addItemToAdjacency(index: Index, item: Item): void {
  if (item.parent_id !== null) {
    const parentId = item.parent_id;
    if (!index.childrenOfItem.has(parentId)) {
      index.childrenOfItem.set(parentId, new Set());
    }
    index.childrenOfItem.get(parentId)?.add(item.id);
  } else {
    const projectId = item.project_id;
    if (!index.topLevelByProject.has(projectId)) {
      index.topLevelByProject.set(projectId, new Set());
    }
    index.topLevelByProject.get(projectId)?.add(item.id);
  }
  for (const tagId of item.tags) {
    if (!index.itemsByTag.has(tagId)) {
      index.itemsByTag.set(tagId, new Set());
    }
    index.itemsByTag.get(tagId)?.add(item.id);
  }
}

function removeItemFromAdjacency(index: Index, item: Item): void {
  if (item.parent_id !== null) {
    index.childrenOfItem.get(item.parent_id)?.delete(item.id);
  } else {
    index.topLevelByProject.get(item.project_id)?.delete(item.id);
  }
  for (const tagId of item.tags) {
    index.itemsByTag.get(tagId)?.delete(item.id);
  }
}

function buildAdjacencyFromItems(index: Index): void {
  index.childrenOfItem.clear();
  index.topLevelByProject.clear();
  index.itemsByTag.clear();
  for (const item of index.items.values()) {
    addItemToAdjacency(index, item);
  }
}

export function buildIndexer(dataDir: string, logger: { warn: (msg: string) => void }): Indexer {
  const paths: Paths = buildPaths(dataDir);
  const mutex = buildMutex();

  // Default config, used until config.json is read.
  let index: Index = buildEmptyIndex({
    schema_version: 1,
    theme: 'system',
    week_start: 'mon',
    last_modified: new Date().toISOString(),
  });

  function buildWriteOps(): WriteOps {
    return {
      async writeItem(item: Item): Promise<void> {
        await atomicWrite(paths.itemFile(item.id), stringify(item));
        // Update map + adjacency (remove old adjacency for existing item, add new)
        const existing = index.items.get(item.id);
        if (existing !== undefined) {
          removeItemFromAdjacency(index, existing);
        }
        index.items.set(item.id, item);
        addItemToAdjacency(index, item);
      },

      async moveItemToTrash(item: Item): Promise<void> {
        await moveFile(paths.itemFile(item.id), paths.trashFile(item.id));
        const existing = index.items.get(item.id);
        if (existing !== undefined) {
          removeItemFromAdjacency(index, existing);
        }
        index.items.delete(item.id);
        index.trash.set(item.id, item);
      },

      async moveItemFromTrash(item: Item): Promise<void> {
        await moveFile(paths.trashFile(item.id), paths.itemFile(item.id));
        index.trash.delete(item.id);
        index.items.set(item.id, item);
        addItemToAdjacency(index, item);
      },

      async removeItem(id: ItemId): Promise<void> {
        await deleteFile(paths.itemFile(id));
        const existing = index.items.get(id);
        if (existing !== undefined) {
          removeItemFromAdjacency(index, existing);
        }
        index.items.delete(id);
      },

      async removeFromTrash(id: ItemId): Promise<void> {
        await deleteFile(paths.trashFile(id));
        index.trash.delete(id);
      },

      async writeProject(project: Project): Promise<void> {
        await atomicWrite(paths.projectFile(project.id), stringify(project));
        index.projects.set(project.id, project);
      },

      async removeProject(id: ProjectId): Promise<void> {
        await deleteFile(paths.projectFile(id));
        index.projects.delete(id);
      },

      async writeFolder(folder: Folder): Promise<void> {
        await atomicWrite(paths.folderFile(folder.id), stringify(folder));
        index.folders.set(folder.id, folder);
      },

      async removeFolder(id: FolderId): Promise<void> {
        await deleteFile(paths.folderFile(id));
        index.folders.delete(id);
      },

      async writeTag(tag: Tag): Promise<void> {
        await atomicWrite(paths.tagFile(tag.id), stringify(tag));
        index.tags.set(tag.id, tag);
        index.tagsByLower.set(tag.name_lower, tag.id);
      },

      async removeTag(id: TagId): Promise<void> {
        const existing = index.tags.get(id);
        await deleteFile(paths.tagFile(id));
        index.tags.delete(id);
        if (existing !== undefined) {
          index.tagsByLower.delete(existing.name_lower);
        }
      },

      async writeConfig(config: Config): Promise<void> {
        await atomicWrite(paths.configFile, stringify(config));
        index.config = config;
      },
    };
  }

  return {
    async bootstrap() {
      const warnings: string[] = [];
      const limit = pLimit(10);

      // 1. Ensure config exists; write default if missing.
      const existingConfig = await readJsonFile(paths.configFile, (raw) => ConfigSchema.parse(raw));
      const config: Config = existingConfig ?? {
        schema_version: 1,
        theme: 'system',
        week_start: 'mon',
        last_modified: new Date().toISOString(),
      };
      if (existingConfig === null) {
        await atomicWrite(paths.configFile, stringify(config));
      }

      index = buildEmptyIndex(config);
      const ops = buildWriteOps();

      // 2. Read each entity directory.
      async function loadDir<T>(
        dir: string,
        schema: { parse: (raw: unknown) => T },
        onLoaded: (entity: T) => void,
      ): Promise<number> {
        const files = (await listDir(dir)).filter((f) => f.endsWith('.json'));
        let count = 0;
        await Promise.all(
          files.map((file) =>
            limit(async () => {
              const filePath = `${dir}/${file}`;
              try {
                const parsed = await readJsonFile(filePath, (raw) => schema.parse(raw));
                if (parsed === null) {
                  // File disappeared between listDir and readJsonFile (ENOENT)
                  logger.warn(`File disappeared mid-load: ${filePath}`);
                  return;
                }
                onLoaded(parsed);
                count++;
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                const warning = `Failed to parse ${filePath}: ${msg}`;
                warnings.push(warning);
                logger.warn(warning);
              }
            }),
          ),
        );
        return count;
      }

      await loadDir(paths.itemsDir, ItemDiskSchema, (item) => {
        index.items.set(item.id, item);
      });

      await loadDir(paths.trashDir, ItemDiskSchema, (item) => {
        index.trash.set(item.id, item);
      });

      await loadDir(paths.projectsDir, ProjectDiskSchema, (project) => {
        index.projects.set(project.id, project);
      });

      await loadDir(paths.foldersDir, FolderSchema, (folder) => {
        index.folders.set(folder.id, folder);
      });

      await loadDir(paths.tagsDir, TagSchema, (tag) => {
        index.tags.set(tag.id, tag);
        index.tagsByLower.set(tag.name_lower, tag.id);
      });

      // 3. Build adjacency caches from loaded items.
      buildAdjacencyFromItems(index);

      // 4. Ensure Inbox sentinel project exists (handles --init AND re-bootstrap).
      // NOTE: ProjectDiskSchema (not ProjectSchema) is used because INBOX_PROJECT_ID
      // ('00000000000000000000INBOX0') contains 'I' and 'O' which are excluded from the
      // ULID base32 alphabet used by the strict ProjectIdSchema. The constant is valid per
      // the binding spec (open-questions.md §0) and is written as a typed cast.
      if (!index.projects.has(INBOX_PROJECT_ID)) {
        const now = new Date().toISOString();
        const inbox: Project = ProjectDiskSchema.parse({
          id: INBOX_PROJECT_ID,
          schema_version: 1,
          name: 'Inbox',
          folder_id: null,
          is_hierarchical: false,
          color: null,
          icon: null,
          sort_order: 0,
          is_inbox: true,
          created_at: now,
          updated_at: now,
        });
        await ops.writeProject(inbox);
      }

      return {
        items: index.items.size,
        projects: index.projects.size,
        folders: index.folders.size,
        tags: index.tags.size,
        trashed: index.trash.size,
        warnings,
      };
    },

    getIndex(): Index {
      return index;
    },

    withWriteLock<T>(fn: (index: Index, ops: WriteOps) => Promise<T>): Promise<T> {
      return mutex.run(() => fn(index, buildWriteOps()));
    },
  };
}

// Exported helper to generate a new ULID-based ProjectId (used in tests and routes).
export function newProjectId(): ProjectId {
  return ProjectIdSchema.parse(ulid());
}
