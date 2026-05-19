# Task 02 — Types package + fs-store + indexer

## Goal

Fill in the shared `@tasko/types` package with every zod schema the rest of the codebase will consume, then build the server-side data layer: filesystem store (atomic writes), single-writer mutex, paths resolver, and the in-memory indexer that boots by reading every JSON file under the data directory. Also ship `--init` so the server can create a fresh data dir (with Inbox sentinel project) on first run. At the end of this task, the server has zod-typed schemas, a working store, and an `Indexer` populated on `buildServer()`. No new HTTP routes — those land in task 03. The health endpoint upgrades to report a real `item_count`.

## Context files

- `docs/engineering/2026-05-18-data-model.md` — entire document. §1 IDs, §2 Common fields, §3 Item, §4 Subtask, §5 Project/Folder/Tag, §6 RecurrenceRule, §7 Config, §8 File layout, §9 In-memory index. Schemas are written verbatim here.
- `docs/engineering/2026-05-18-code-architecture.md#2-shared-types----packages-types-` — concrete file-by-file zod schemas with the import shape. Mirror this structure.
- `docs/engineering/2026-05-18-code-architecture.md#3-4-indexer` — `Index`, `Indexer`, `WriteOps` interface contracts.
- `docs/engineering/2026-05-18-architecture.md#2-9-the-data-directory-is-just-a-directory` — on-disk layout: `config.json`, `items/`, `projects/`, `folders/`, `tags/`, `trash/`.
- `docs/engineering/2026-05-18-architecture.md#10-performance-budget` — boot indexer < 1.5s for 10k items; use `p-limit 10` for chunked reads.
- `docs/engineering/2026-05-18-architecture.md#11-engineering-risks-for-v1` (#5 atomic writes) — tmp + rename POSIX path; Windows fallback noted (out of scope for v1 implementation since v1 is desktop-only on a local FS, but document the Windows note in code comments).
- `docs/engineering/2026-05-18-open-questions.md#0-binding-resolutions-user-2026-05-18` — `INBOX_PROJECT_ID = '00000000000000000000INBOX0'`; data dir default `~/Documents/.tasko-data`.
- `docs/brainstorm/product-spec.md#4-entity-model` — semantic constraints (Inbox immutable, subtasks attach only to Tasks, every Item has due_date, etc.).

## Downstream dependencies

- **Task 03** registers REST routes that call `Indexer.withWriteLock(async (index, ops) => { ... })`. The `WriteOps` interface defined here is the contract.
- **Task 09** writes `domain/depth-cap.ts` which iterates over `index.items` (a `Map<ItemId, Item>`) and uses the `parent_id` / `type` fields on `Item`. Keep the index shape (`Map<ItemId, Item>`) stable.
- **Task 11** writes `domain/recurrence.ts` consuming `RecurrenceRule`, `LocalDate`. Keep `RecurrenceRuleSchema` as a discriminated union on `frequency`.
- **Task 12** writes `trashed_with` cascade semantics. The schema field is already here.
- **Every later task** imports schemas + types from `@tasko/types`. The public surface is `packages/types/src/index.ts`.
- The frontend (task 04+) imports the same types for response parsing.

## Steps

1. **Write `@tasko/types` schemas** — populate every file listed in `code-architecture.md` §2.1–§2.9. Copy the zod definitions verbatim, with these clarifications:
   - **IDs (`packages/types/src/domain/ids.ts`)**: branded ULID schemas + the `INBOX_PROJECT_ID` constant. The regex pattern is `/^[0-9A-HJKMNP-TV-Z]{26}$/` — note that `INBOX_PROJECT_ID = '00000000000000000000INBOX0'` matches this regex (all chars are in the base32 alphabet).
   - **Status / Priority / ItemType / dates (`domain/status.ts`)**: enums and the `LocalDateSchema` / `LocalTimeSchema` / `IsoUtcSchema`.
   - **Recurrence (`schemas/recurrence.ts`)**: discriminated union on `frequency`. Five branches — daily, every_n_days (with `interval`), weekly (with `weekdays`), monthly (with `day_of_month`), yearly (with `month` + `day`). Each branch carries an `anchor_mode`.
   - **Subtask (`schemas/subtask.ts`)**: `SubtaskSchema`, `SubtaskCreateSchema`, `SubtaskPatchSchema`. Subtask status is `'todo' | 'done'` only (no `in_progress` per §9.4 #6 of the product spec).
   - **Item (`schemas/item.ts`)**: `ItemSchema` with the `start_date <= due_date` refinement, `ItemCreateSchema`, `ItemPatchSchema`. The `subtasks` array on Item is inlined (no separate file per subtask).
   - **Project (`schemas/project.ts`)**, **Folder (`schemas/folder.ts`)**, **Tag (`schemas/tag.ts`)**: schemas + Create / Patch variants. `TagCreateSchema` accepts up to 33 chars to allow a leading `#` which the API layer strips.
   - **Config (`schemas/config.ts`)**: theme `'light' | 'dark' | 'system'`, week_start `'sun' | 'mon'`, `last_modified` ISO 8601.
   - **SSE events (`api/sse-events.ts`)**: every event payload schema listed in `api.md` §9.1. The full set: `ItemCreatedEventSchema`, `ItemChangedEventSchema`, `ItemTrashedEventSchema`, `ItemRestoredEventSchema`, `ItemPermanentlyDeletedEventSchema`, `ProjectCreatedEventSchema`, `ProjectChangedEventSchema`, `ProjectDeletedEventSchema`, `FolderCreatedEventSchema`, `FolderChangedEventSchema`, `FolderDeletedEventSchema`, `TagCreatedEventSchema`, `TagChangedEventSchema`, `ConfigChangedEventSchema`, `TrashEmptiedEventSchema`, `BulkCompletedEventSchema`. Each extends a `BaseEvent` with `source: 'self' | 'other-tab'` and `timestamp: IsoUtcSchema`.
   - **Error envelope (`api/error.ts`)**: `ApiErrorCodeSchema` enum + `ApiErrorSchema`.
   - **Index file (`packages/types/src/index.ts`)**: re-export everything per `code-architecture.md` §2.9. Add a unit test (`packages/types/src/__tests__/schemas.test.ts`) that parses a representative valid Item / Project / Folder / Tag / Config object via each schema and round-trips through JSON; also rejects an invalid Item (e.g., start_date > due_date).
2. **Server: store/paths.ts** — paths resolver:
   ```ts
   // apps/server/src/store/paths.ts
   import { join } from 'node:path';
   import { ItemId, ProjectId, FolderId, TagId } from '@tasko/types';
   export interface Paths {
     dataDir: string;
     configFile: string;
     itemsDir: string;
     trashDir: string;
     projectsDir: string;
     foldersDir: string;
     tagsDir: string;
     itemFile: (id: ItemId) => string;
     trashFile: (id: ItemId) => string;
     projectFile: (id: ProjectId) => string;
     folderFile: (id: FolderId) => string;
     tagFile: (id: TagId) => string;
   }
   export function buildPaths(dataDir: string): Paths { /* concrete construction */ }
   ```
3. **Server: store/mutex.ts** — single-writer mutex:
   ```ts
   // apps/server/src/store/mutex.ts — a hand-rolled async lock (avoids the p-queue dep here)
   export interface Mutex {
     run<T>(fn: () => Promise<T>): Promise<T>;
   }
   export function buildMutex(): Mutex {
     let chain: Promise<unknown> = Promise.resolve();
     return {
       run: <T>(fn: () => Promise<T>): Promise<T> => {
         const next = chain.then(fn, fn);
         chain = next.catch(() => undefined);
         return next as Promise<T>;
       },
     };
   }
   ```
4. **Server: store/fs-store.ts** — low-level read/write/atomic-write/list/move:
   ```ts
   // apps/server/src/store/fs-store.ts
   import { readFile, writeFile, rename, unlink, readdir, mkdir, access } from 'node:fs/promises';
   import { dirname, basename, join } from 'node:path';
   import { randomUUID } from 'node:crypto';

   export async function ensureDir(dir: string): Promise<void> { await mkdir(dir, { recursive: true }); }

   export async function atomicWrite(path: string, contents: string): Promise<void> {
     const tmp = `${path}.${randomUUID()}.tmp`;
     await writeFile(tmp, contents, 'utf8');
     await rename(tmp, path);
   }

   export async function readJsonFile<T>(path: string, parse: (raw: unknown) => T): Promise<T | null> {
     try {
       const raw = await readFile(path, 'utf8');
       return parse(JSON.parse(raw));
     } catch (err: any) {
       if (err.code === 'ENOENT') return null;
       throw err;
     }
   }

   export async function listDir(dir: string): Promise<string[]> {
     try { return await readdir(dir); }
     catch (err: any) { if (err.code === 'ENOENT') return []; throw err; }
   }

   export async function moveFile(from: string, to: string): Promise<void> { await rename(from, to); }
   export async function deleteFile(path: string): Promise<void> { await unlink(path); }

   // Helper: serialize with 2-space indent + trailing newline (git-diff friendly per architecture.md §2.9).
   export function stringify(value: unknown): string { return JSON.stringify(value, null, 2) + '\n'; }
   ```
5. **Server: store/indexer.ts** — the in-memory index + write ops + bootstrap. This is the most complex file in this task:
   - Define `Index` per `code-architecture.md` §3.4: `items: Map<ItemId, Item>`, `trash: Map<ItemId, Item>`, `projects: Map<ProjectId, Project>`, `folders: Map<FolderId, Folder>`, `tags: Map<TagId, Tag>`, `tagsByLower: Map<string, TagId>`, `config: Config`, `childrenOfItem: Map<ItemId, Set<ItemId>>`, `topLevelByProject: Map<ProjectId, Set<ItemId>>`, `itemsByTag: Map<TagId, Set<ItemId>>`.
   - `WriteOps` interface with methods: `writeItem`, `moveItemToTrash`, `moveItemFromTrash`, `removeItem`, `removeFromTrash`, `writeProject`, `removeProject`, `writeFolder`, `removeFolder`, `writeTag`, `removeTag`, `writeConfig`. Each method:
     - Performs the file operation (atomic write or rename or unlink).
     - Updates the in-memory index (the corresponding `Map` + the adjacency caches `childrenOfItem`, `topLevelByProject`, `itemsByTag`, `tagsByLower`).
     - Returns void (or throws).
   - `Indexer` interface per `code-architecture.md` §3.4: `bootstrap()`, `getIndex()`, `withWriteLock<T>(fn: (index: Index, ops: WriteOps) => Promise<T>): Promise<T>`. The `withWriteLock` is the public API — every mutation in routes (task 03+) goes through it.
   - `bootstrap()` algorithm:
     1. If config file missing → write the default Config (`{ schema_version: 1, theme: 'system', week_start: 'mon', last_modified: now }`).
     2. Parse `config.json` via `ConfigSchema`.
     3. List `items/`, `trash/`, `projects/`, `folders/`, `tags/` directories.
     4. Read each file in chunks of 10 via `p-limit(10)`. For each file:
        - `JSON.parse` + schema parse via the right schema (`ItemSchema`, etc.).
        - If parse fails: `app.log.warn` the file path + error, skip (do not delete or modify).
        - Insert into the corresponding map.
     5. Build the adjacency caches by iterating `items` once.
     6. If no project with `id === INBOX_PROJECT_ID` exists: create it via `WriteOps.writeProject` with `name: 'Inbox'`, `folder_id: null`, `is_hierarchical: false`, `is_inbox: true`, `sort_order: 0`. (This handles the `--init` case AND any re-bootstrap where Inbox was missing — defensive.)
   - The signature implementer should respect:
     ```ts
     export interface Indexer {
       bootstrap(): Promise<{ items: number; projects: number; folders: number; tags: number; trashed: number; warnings: string[] }>;
       getIndex(): Index;
       withWriteLock<T>(fn: (index: Index, ops: WriteOps) => Promise<T>): Promise<T>;
     }
     export function buildIndexer(dataDir: string, logger: { warn: (msg: string) => void }): Indexer;
     ```
6. **Wire indexer into the server** — update `apps/server/src/server.ts`:
   - On `buildServer(config)`, call `await ensureDir` for each of the data subdirectories (when `config.initIfMissing` is true). Otherwise verify the data dir exists; if it doesn't and `initIfMissing` is false, throw a clear error: `Data directory does not exist: <path>. Run with --init to create it.`
   - Instantiate the indexer: `const indexer = buildIndexer(config.dataDir, app.log)`.
   - `await indexer.bootstrap()` — log boot stats at `info`. Log every parse warning at `warn`.
   - `app.decorate('indexer', indexer)`. Update the Fastify type augmentation to add `indexer: Indexer`.
   - Update `routes/health.ts` to return real `item_count: app.indexer.getIndex().items.size`.
7. **Init flow + Inbox sentinel** — when `--init` is passed:
   - Create `dataDir` and all subdirectories if missing.
   - The indexer's bootstrap creates the Inbox sentinel if absent.
   - Log `Initialized fresh data directory at <path>. Inbox project created.` at info.
   - When `--init` is not passed and the data dir is missing, the server exits with code 1 and the error message above.
8. **Tests** — `apps/server/test/`:
   - `unit/fs-store.spec.ts`: test `atomicWrite` (write, verify file exists, content matches; kill mid-write simulation isn't testable cleanly — just verify the tmp file doesn't linger after success), `readJsonFile` (returns null for ENOENT), `moveFile`, `deleteFile`. Use `mkdtemp` for a temp dir per test.
   - `unit/indexer-bootstrap.spec.ts`: create a temp data dir, drop in a valid Item JSON + a deliberately corrupted JSON + a valid Project + Inbox project file, call `bootstrap()`, verify the good Item is indexed, the bad file is skipped + logged as warning, the Inbox sentinel is honored.
   - `unit/indexer-write-lock.spec.ts`: fire 5 concurrent `withWriteLock` calls; assert they serialize (use a shared counter + log + sleep inside each to detect interleaving).
   - `unit/indexer-creates-inbox.spec.ts`: bootstrap on a fresh empty data dir (with subdirs but no `INBOX_PROJECT_ID.json`); after bootstrap, the file exists on disk and `index.projects.get(INBOX_PROJECT_ID)` is set.
   - `integration/health-with-indexer.spec.ts`: extend the prior health test — boot the server with a temp data dir and `initIfMissing: true`; verify `/api/health` reports `item_count: 0`. Then write a fake Item JSON, restart the server, verify `item_count: 1`.

## Acceptance criteria

- [ ] `pnpm --filter @tasko/types typecheck` reports 0 errors.
- [ ] `pnpm --filter @tasko/types test` — schemas round-trip test passes; invalid Item (start_date > due_date) is rejected.
- [ ] `pnpm --filter @tasko/server test` — all unit + integration tests pass:
  - `fs-store.spec.ts` — atomicWrite leaves no stray tmp files; readJsonFile returns null for ENOENT.
  - `indexer-bootstrap.spec.ts` — corrupted file is skipped with a warn log; valid items indexed.
  - `indexer-write-lock.spec.ts` — concurrent writes serialize.
  - `indexer-creates-inbox.spec.ts` — Inbox sentinel project created if absent.
  - `health-with-indexer.spec.ts` — `/api/health` reports real `item_count`.
- [ ] `pnpm --filter @tasko/server typecheck` reports 0 errors.
- [ ] `pnpm dev` followed by `curl http://127.0.0.1:7373/api/health` returns `item_count: 0` against a fresh data dir (with `--init`). Adding a valid Item JSON file to `items/` and restarting bumps `item_count` to 1.
- [ ] Running `node apps/server/dist/server.js --data-dir /tmp/no-such-dir` (or via `pnpm start` with the env) fails with the message `Data directory does not exist: /tmp/no-such-dir. Run with --init to create it.` and exits non-zero.
- [ ] Running with `--init` against the same missing path creates the directory tree (`config.json`, `items/`, `projects/`, `folders/`, `tags/`, `trash/`) AND the Inbox sentinel project file `projects/00000000000000000000INBOX0.json`.
- [ ] `pnpm lint` is clean.

## Output files

- Created:
  - `packages/types/src/domain/ids.ts`, `packages/types/src/domain/status.ts`
  - `packages/types/src/schemas/recurrence.ts`, `packages/types/src/schemas/subtask.ts`, `packages/types/src/schemas/item.ts`, `packages/types/src/schemas/project.ts`, `packages/types/src/schemas/folder.ts`, `packages/types/src/schemas/tag.ts`, `packages/types/src/schemas/config.ts`
  - `packages/types/src/api/sse-events.ts`, `packages/types/src/api/error.ts`
  - `packages/types/src/__tests__/schemas.test.ts`
  - `apps/server/src/store/paths.ts`, `apps/server/src/store/fs-store.ts`, `apps/server/src/store/mutex.ts`, `apps/server/src/store/indexer.ts`
  - `apps/server/test/unit/fs-store.spec.ts`, `apps/server/test/unit/indexer-bootstrap.spec.ts`, `apps/server/test/unit/indexer-write-lock.spec.ts`, `apps/server/test/unit/indexer-creates-inbox.spec.ts`
  - `apps/server/test/integration/health-with-indexer.spec.ts`
- Modified:
  - `packages/types/src/index.ts` — re-export every schema.
  - `apps/server/src/server.ts` — wire indexer, ensure-dir on init, decorate `app.indexer`, update Fastify type augmentation.
  - `apps/server/src/routes/health.ts` — return `app.indexer.getIndex().items.size`.
