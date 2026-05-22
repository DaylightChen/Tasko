---
title: Tasko — Code Architecture (Interfaces & Skeletons)
date: 2026-05-18
phase: engineering
scope: project
status: draft
---

# Tasko — Code Architecture (Interfaces & Skeletons)

Concrete TypeScript interfaces, function signatures, and skeletal module exports the planner / implementer can reference when writing task briefs. This is a contract — the implementation may add private helpers but should respect these public shapes.

References: `data-model.md` for schemas; `api.md` for endpoints; `architecture.md` and `frontend-architecture.md` for the rationale.

---

## 1. Repo + workspaces

### 1.1 Root `package.json`

```jsonc
{
  "name": "tasko",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "concurrently \"pnpm --filter @tasko/server dev\" \"pnpm --filter @tasko/web dev\"",
    "build": "pnpm --filter @tasko/types build && pnpm --filter @tasko/server build && pnpm --filter @tasko/web build",
    "start": "pnpm --filter @tasko/server start",
    "test": "pnpm -r test",
    "test:e2e": "pnpm --filter @tasko/web test:e2e",
    "typecheck": "pnpm -r typecheck",
    "lint": "biome check .",
    "format": "biome format --write ."
  },
  "devDependencies": {
    "biome": "^1.9.0",
    "concurrently": "^9.0.0",
    "typescript": "^5.6.0"
  }
}
```

### 1.2 `packages/types/package.json`

```jsonc
{
  "name": "@tasko/types",
  "version": "1.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": { "zod": "^3.23.0" }
}
```

### 1.3 `apps/server/package.json`

```jsonc
{
  "name": "@tasko/server",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "main": "./dist/server.js",
  "scripts": {
    "dev": "tsx watch src/bin/tasko-server.ts",
    "build": "esbuild src/bin/tasko-server.ts --bundle --platform=node --target=node20 --format=esm --outfile=dist/server.js --external:fsevents --external:chokidar",
    "start": "node dist/server.js",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@tasko/types": "workspace:*",
    "fastify": "^5.0.0",
    "@fastify/cors": "^11.0.0",
    "@fastify/static": "^8.0.0",
    "pino": "^9.0.0",
    "pino-pretty": "^11.0.0",
    "ulid": "^3.0.0",
    "zod": "^3.23.0",
    "chokidar": "^4.0.0",
    "p-limit": "^6.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "esbuild": "^0.24.0",
    "tsx": "^4.0.0",
    "vitest": "^2.0.0"
  }
}
```

### 1.4 `apps/web/package.json`

```jsonc
{
  "name": "@tasko/web",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@tasko/types": "workspace:*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@tanstack/react-query": "^5.0.0",
    "@tanstack/react-router": "^1.0.0",
    "@tanstack/react-virtual": "^3.0.0",
    "zustand": "^4.5.0",
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^8.0.0",
    "cmdk": "^1.0.0",
    "lucide-react": "^0.450.0",
    "@floating-ui/react": "^0.27.0",
    "react-day-picker": "^9.0.0",
    "marked": "^14.0.0",
    "dompurify": "^3.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.45.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/dompurify": "^3.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "msw": "^2.0.0",
    "vite": "^5.0.0",
    "vitest": "^2.0.0",
    "jsdom": "^25.0.0"
  }
}
```

---

## 2. Shared types — `packages/types/`

### 2.1 IDs (branded)

```ts
// packages/types/src/domain/ids.ts
import { z } from 'zod';

const UlidPattern = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const UlidSchema = z.string().regex(UlidPattern);

export const ItemIdSchema = UlidSchema.brand<'ItemId'>();
export const ProjectIdSchema = UlidSchema.brand<'ProjectId'>();
export const FolderIdSchema = UlidSchema.brand<'FolderId'>();
export const TagIdSchema = UlidSchema.brand<'TagId'>();
export const SubtaskIdSchema = UlidSchema.brand<'SubtaskId'>();

export type ItemId = z.infer<typeof ItemIdSchema>;
export type ProjectId = z.infer<typeof ProjectIdSchema>;
export type FolderId = z.infer<typeof FolderIdSchema>;
export type TagId = z.infer<typeof TagIdSchema>;
export type SubtaskId = z.infer<typeof SubtaskIdSchema>;

export const INBOX_PROJECT_ID = '00000000000000000000INBOX0' as ProjectId;
```

### 2.2 Status, Priority, ItemType, dates/times

```ts
// packages/types/src/domain/status.ts
import { z } from 'zod';

export const StatusSchema = z.enum(['todo', 'in_progress', 'done']);
export type Status = z.infer<typeof StatusSchema>;

export const PrioritySchema = z.enum(['none', 'low', 'medium', 'high']);
export type Priority = z.infer<typeof PrioritySchema>;

export const ItemTypeSchema = z.enum(['epic', 'feature', 'task']);
export type ItemType = z.infer<typeof ItemTypeSchema>;

export const LocalDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export type LocalDate = z.infer<typeof LocalDateSchema>;

export const LocalTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export type LocalTime = z.infer<typeof LocalTimeSchema>;

export const IsoUtcSchema = z.string().datetime();
```

### 2.3 Recurrence

```ts
// packages/types/src/schemas/recurrence.ts
import { z } from 'zod';

export const WeekdaySchema = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
export type Weekday = z.infer<typeof WeekdaySchema>;

export const AnchorModeSchema = z.enum(['on_schedule', 'after_completion']);
export type AnchorMode = z.infer<typeof AnchorModeSchema>;

export const RecurrenceRuleSchema = z.discriminatedUnion('frequency', [
  z.object({ frequency: z.literal('daily'), anchor_mode: AnchorModeSchema }),
  z.object({ frequency: z.literal('every_n_days'), interval: z.number().int().min(1).max(365), anchor_mode: AnchorModeSchema }),
  z.object({ frequency: z.literal('weekly'), weekdays: z.array(WeekdaySchema).min(1).max(7), anchor_mode: AnchorModeSchema }),
  z.object({ frequency: z.literal('monthly'), day_of_month: z.number().int().min(1).max(31), anchor_mode: AnchorModeSchema }),
  z.object({ frequency: z.literal('yearly'), month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(31), anchor_mode: AnchorModeSchema }),
]);
export type RecurrenceRule = z.infer<typeof RecurrenceRuleSchema>;
```

### 2.4 Subtask

```ts
// packages/types/src/schemas/subtask.ts
import { z } from 'zod';
import { IsoUtcSchema } from '../domain/status';
import { SubtaskIdSchema } from '../domain/ids';

export const SubtaskStatusSchema = z.enum(['todo', 'done']);
export type SubtaskStatus = z.infer<typeof SubtaskStatusSchema>;

export const SubtaskSchema = z.object({
  id: SubtaskIdSchema,
  title: z.string().min(1).max(200),
  status: SubtaskStatusSchema.default('todo'),
  completed_at: IsoUtcSchema.nullable().default(null),
  sort_order: z.number().int(),
  created_at: IsoUtcSchema,
  updated_at: IsoUtcSchema,
});
export type Subtask = z.infer<typeof SubtaskSchema>;

export const SubtaskCreateSchema = SubtaskSchema
  .omit({ id: true, created_at: true, updated_at: true, completed_at: true })
  .extend({ sort_order: z.number().int().optional() });
export type SubtaskCreate = z.infer<typeof SubtaskCreateSchema>;

export const SubtaskPatchSchema = SubtaskSchema
  .omit({ id: true, created_at: true })
  .partial();
export type SubtaskPatch = z.infer<typeof SubtaskPatchSchema>;
```

### 2.5 Item

```ts
// packages/types/src/schemas/item.ts
import { z } from 'zod';
import { ItemIdSchema, ProjectIdSchema, TagIdSchema } from '../domain/ids';
import { ItemTypeSchema, StatusSchema, PrioritySchema, LocalDateSchema, LocalTimeSchema, IsoUtcSchema } from '../domain/status';
import { SubtaskSchema, SubtaskCreateSchema } from './subtask';
import { RecurrenceRuleSchema } from './recurrence';

export const ItemSchema = z.object({
  id: ItemIdSchema,
  schema_version: z.literal(1),
  type: ItemTypeSchema,
  project_id: ProjectIdSchema,
  parent_id: ItemIdSchema.nullable(),

  title: z.string().min(1).max(500),
  notes: z.string().max(50_000).default(''),

  due_date: LocalDateSchema,
  start_date: LocalDateSchema.nullable(),
  due_time: LocalTimeSchema.nullable(),

  priority: PrioritySchema.default('none'),
  status: StatusSchema.default('todo'),

  tags: z.array(TagIdSchema).default([]),
  subtasks: z.array(SubtaskSchema).default([]),
  recurrence: RecurrenceRuleSchema.nullable(),

  completed_at: IsoUtcSchema.nullable(),
  trashed_at: IsoUtcSchema.nullable(),
  trashed_with: ItemIdSchema.nullable(),

  sort_order: z.number().int(),

  created_at: IsoUtcSchema,
  updated_at: IsoUtcSchema,
}).refine(
  v => v.start_date === null || v.start_date <= v.due_date,
  { path: ['start_date'], message: 'start_date must be on or before due_date' },
);
export type Item = z.infer<typeof ItemSchema>;

export const ItemCreateSchema = ItemSchema
  .omit({ id: true, created_at: true, updated_at: true, completed_at: true, trashed_at: true, trashed_with: true, schema_version: true })
  .extend({
    sort_order: z.number().int().optional(),
    subtasks: z.array(SubtaskCreateSchema).optional(),
  });
export type ItemCreate = z.infer<typeof ItemCreateSchema>;

export const ItemPatchSchema = ItemSchema
  .omit({ id: true, created_at: true, schema_version: true, trashed_at: true, trashed_with: true })
  .partial()
  .extend({ updated_at: IsoUtcSchema.optional() });
export type ItemPatch = z.infer<typeof ItemPatchSchema>;
```

### 2.6 Project, Folder, Tag, Config

```ts
// packages/types/src/schemas/project.ts
import { z } from 'zod';
import { ProjectIdSchema, FolderIdSchema } from '../domain/ids';
import { IsoUtcSchema } from '../domain/status';

export const ProjectSchema = z.object({
  id: ProjectIdSchema,
  schema_version: z.literal(1),
  name: z.string().min(1).max(80),
  folder_id: FolderIdSchema.nullable(),
  is_hierarchical: z.boolean().default(false),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().default(null),
  icon: z.string().max(40).nullable().default(null),
  sort_order: z.number().int(),
  is_inbox: z.boolean().default(false),
  created_at: IsoUtcSchema,
  updated_at: IsoUtcSchema,
});
export type Project = z.infer<typeof ProjectSchema>;

export const ProjectCreateSchema = ProjectSchema
  .omit({ id: true, created_at: true, updated_at: true, schema_version: true, is_inbox: true })
  .extend({ sort_order: z.number().int().optional() });
export type ProjectCreate = z.infer<typeof ProjectCreateSchema>;

export const ProjectPatchSchema = ProjectSchema
  .omit({ id: true, created_at: true, schema_version: true, is_inbox: true })
  .partial();
export type ProjectPatch = z.infer<typeof ProjectPatchSchema>;
```

```ts
// packages/types/src/schemas/folder.ts
import { z } from 'zod';
import { FolderIdSchema } from '../domain/ids';
import { IsoUtcSchema } from '../domain/status';

export const FolderSchema = z.object({
  id: FolderIdSchema,
  schema_version: z.literal(1),
  name: z.string().min(1).max(60),
  sort_order: z.number().int(),
  created_at: IsoUtcSchema,
  updated_at: IsoUtcSchema,
});
export type Folder = z.infer<typeof FolderSchema>;

export const FolderCreateSchema = FolderSchema
  .omit({ id: true, created_at: true, updated_at: true, schema_version: true })
  .extend({ sort_order: z.number().int().optional() });
export type FolderCreate = z.infer<typeof FolderCreateSchema>;

export const FolderPatchSchema = FolderSchema
  .omit({ id: true, created_at: true, schema_version: true })
  .partial();
export type FolderPatch = z.infer<typeof FolderPatchSchema>;
```

```ts
// packages/types/src/schemas/tag.ts
import { z } from 'zod';
import { TagIdSchema } from '../domain/ids';
import { IsoUtcSchema } from '../domain/status';

export const TagSchema = z.object({
  id: TagIdSchema,
  schema_version: z.literal(1),
  name: z.string().min(1).max(32),
  name_lower: z.string().min(1).max(32),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().default(null),
  created_at: IsoUtcSchema,
  updated_at: IsoUtcSchema,
});
export type Tag = z.infer<typeof TagSchema>;

export const TagCreateSchema = z.object({
  name: z.string().min(1).max(33),  // 33 to allow leading '#'
});
export type TagCreate = z.infer<typeof TagCreateSchema>;
```

```ts
// packages/types/src/schemas/config.ts
import { z } from 'zod';
import { IsoUtcSchema } from '../domain/status';

export const ThemeSchema = z.enum(['light', 'dark', 'system']);
export type Theme = z.infer<typeof ThemeSchema>;

export const WeekStartSchema = z.enum(['sun', 'mon']);
export type WeekStart = z.infer<typeof WeekStartSchema>;

export const ConfigSchema = z.object({
  schema_version: z.literal(1),
  theme: ThemeSchema.default('system'),
  week_start: WeekStartSchema.default('mon'),
  last_modified: IsoUtcSchema,
});
export type Config = z.infer<typeof ConfigSchema>;

export const ConfigPatchSchema = ConfigSchema
  .omit({ schema_version: true, last_modified: true })
  .partial();
export type ConfigPatch = z.infer<typeof ConfigPatchSchema>;
```

### 2.7 SSE event schemas

```ts
// packages/types/src/api/sse-events.ts
import { z } from 'zod';
import { ItemSchema } from '../schemas/item';
import { ProjectSchema } from '../schemas/project';
import { FolderSchema } from '../schemas/folder';
import { TagSchema } from '../schemas/tag';
import { ConfigSchema } from '../schemas/config';
import { IsoUtcSchema } from '../domain/status';

const BaseEvent = z.object({
  source: z.enum(['self', 'other-tab']),
  timestamp: IsoUtcSchema,
});

export const ItemChangedEventSchema = BaseEvent.extend({ id: z.string(), item: ItemSchema });
export const ItemCreatedEventSchema = BaseEvent.extend({ id: z.string(), item: ItemSchema });
export const ItemTrashedEventSchema = BaseEvent.extend({ id: z.string(), item: ItemSchema });
export const ItemRestoredEventSchema = BaseEvent.extend({ id: z.string(), item: ItemSchema });
export const ItemPermanentlyDeletedEventSchema = BaseEvent.extend({ id: z.string() });
export const ProjectChangedEventSchema = BaseEvent.extend({ id: z.string(), project: ProjectSchema });
// ...same pattern for folder.*, tag.*, config.changed, trash.emptied, bulk.completed
```

### 2.8 API error envelope

```ts
// packages/types/src/api/error.ts
import { z } from 'zod';

export const ApiErrorCodeSchema = z.enum([
  'VALIDATION',
  'ITEM_NOT_FOUND',
  'PROJECT_NOT_FOUND',
  'FOLDER_NOT_FOUND',
  'TAG_NOT_FOUND',
  'PARENT_NOT_FOUND',
  'DEPTH_CAP',
  'INBOX_IMMUTABLE',
  'FS_WRITE',
  'DUPLICATE_TAG',
  'RECURRENCE_INVALID',
  'INTERNAL',
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: ApiErrorCodeSchema,
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
```

### 2.9 `packages/types/src/index.ts` — public surface

```ts
export * from './domain/ids';
export * from './domain/status';
export * from './schemas/item';
export * from './schemas/subtask';
export * from './schemas/project';
export * from './schemas/folder';
export * from './schemas/tag';
export * from './schemas/recurrence';
export * from './schemas/config';
export * from './api/sse-events';
export * from './api/error';
```

---

## 3. Server — `apps/server/src/`

### 3.1 Boot — `bin/tasko-server.ts`

```ts
#!/usr/bin/env node
import { buildServer } from '../server';
import { loadConfig } from '../config/load';

const config = loadConfig(process.argv.slice(2), process.env);
const server = await buildServer(config);
await server.listen({ port: config.port, host: config.host });
server.log.info(`Tasko listening on http://${config.host}:${config.port}`);
server.log.info(`Data directory: ${config.dataDir}`);
```

### 3.2 Config loader

```ts
// config/load.ts
export interface ServerConfig {
  dataDir: string;
  port: number;
  host: string;
  initIfMissing: boolean;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug';
}

export function loadConfig(argv: string[], env: NodeJS.ProcessEnv): ServerConfig {
  // Parse --data-dir, --port, --host, --init, --log-level
  // Fallback to env: TASKO_DATA_DIR, TASKO_PORT, TASKO_HOST, TASKO_LOG_LEVEL
  // Defaults: ~/Documents/.tasko-data, 7373, 127.0.0.1, info
  // Throws if config is invalid (e.g., port out of range, data-dir not writable)
}
```

### 3.3 Server bootstrap — `server.ts`

```ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import staticPlugin from '@fastify/static';
import { ServerConfig } from './config/load';
import { buildIndexer } from './store/indexer';
import { buildBroker } from './middleware/sse-broker';
import { registerItemRoutes } from './routes/items';
// ...other routes

export async function buildServer(config: ServerConfig) {
  const app = Fastify({ logger: { level: config.logLevel } });

  // Bootstrap data directory
  if (config.initIfMissing) {
    await initDataDir(config.dataDir);
  }

  // Build the in-memory index
  const indexer = await buildIndexer(config.dataDir);
  await indexer.bootstrap();

  // Build the SSE broker
  const broker = buildBroker();

  // Decorate so routes can grab indexer + broker via app
  app.decorate('indexer', indexer);
  app.decorate('broker', broker);
  app.decorate('config', config);

  // CORS
  await app.register(cors, {
    origin: [`http://${config.host}:${config.port}`, 'http://127.0.0.1:5173'],
    credentials: false,
  });

  // Routes
  registerItemRoutes(app);
  registerProjectRoutes(app);
  registerFolderRoutes(app);
  registerTagRoutes(app);
  registerTrashRoutes(app);
  registerBulkRoutes(app);
  registerConfigRoutes(app);
  registerEventsRoute(app);
  registerHealthRoute(app);

  // Static frontend in production
  if (process.env.NODE_ENV === 'production') {
    await app.register(staticPlugin, {
      root: resolvePath(import.meta.url, '../web/dist'),
      prefix: '/',
    });
  }

  // Error envelope
  app.setErrorHandler(errorEnvelopeHandler);

  return app;
}
```

### 3.4 Indexer

```ts
// store/indexer.ts
import { Item, Project, Folder, Tag, Config, ItemId, ProjectId, FolderId, TagId } from '@tasko/types';

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

export interface Indexer {
  bootstrap(): Promise<void>;
  getIndex(): Index;
  withWriteLock<T>(fn: (index: Index, ops: WriteOps) => Promise<T>): Promise<T>;
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

export function buildIndexer(dataDir: string): Indexer;
```

### 3.5 Domain — depth cap, recurrence, hierarchy

```ts
// domain/depth-cap.ts
import { Item, ItemId } from '@tasko/types';

export type CanMoveResult = { ok: true } | { ok: false; reason: string };

export function levelOf(item: Item, items: Map<ItemId, Item>): number;
export function maxDescendantDepth(item: Item, items: Map<ItemId, Item>): number;
export function canMove(opts: {
  source: Item;
  newParent: Item | null;
  items: Map<ItemId, Item>;
}): CanMoveResult;
```

```ts
// domain/recurrence.ts
import { LocalDate, RecurrenceRule } from '@tasko/types';

export function nextDueDate(opts: {
  rule: RecurrenceRule;
  previousDueDate: LocalDate;
  completedAt: LocalDate;
  previousStartDate: LocalDate | null;
}): { due_date: LocalDate; start_date: LocalDate | null };
```

```ts
// domain/hierarchy.ts
import { Item, ItemId } from '@tasko/types';

export function descendantsOf(itemId: ItemId, items: Map<ItemId, Item>): Item[];
export function topLevelOfProject(projectId: ProjectId, items: Map<ItemId, Item>): Item[];
export function rollupProgress(item: Item, items: Map<ItemId, Item>): { completed: number; total: number };
```

```ts
// domain/time.ts
import { LocalDate, LocalTime } from '@tasko/types';

export function todayLocal(): LocalDate;
export function addDays(date: LocalDate, n: number): LocalDate;
export function daysBetween(a: LocalDate, b: LocalDate): number;
export function nextScheduledWeekday(after: LocalDate, weekdays: Weekday[]): LocalDate;
export function nextMonthlyDate(anchor: LocalDate, dayOfMonth: number): LocalDate;
export function nextYearlyDate(anchor: LocalDate, month: number, day: number): LocalDate;
export function lastDayOfMonth(year: number, month: number): number;
export function formatShort(date: LocalDate): string;
```

### 3.6 Routes — example: items

```ts
// routes/items.ts
import { FastifyInstance } from 'fastify';
import { ItemSchema, ItemCreateSchema, ItemPatchSchema, ItemId, ItemIdSchema } from '@tasko/types';

export function registerItemRoutes(app: FastifyInstance) {
  app.get('/api/items', async (req, reply) => {
    // Parse query params via zod
    // Resolve view, filter, sort
    // Read from app.indexer.getIndex()
    // Return { items, count }
  });

  app.get('/api/items/:id', async (req, reply) => {
    const id = ItemIdSchema.parse(req.params.id);
    const item = app.indexer.getIndex().items.get(id);
    if (!item) return reply.code(404).send({ error: { code: 'ITEM_NOT_FOUND', message: 'Item not found.' } });
    return reply.send(item);
  });

  app.post('/api/items', async (req, reply) => {
    const body = ItemCreateSchema.parse(req.body);
    return await app.indexer.withWriteLock(async (index, ops) => {
      // Validate parent_id, depth-cap, create item, write file, update index, broadcast SSE
    });
  });

  app.patch('/api/items/:id', async (req, reply) => {
    const id = ItemIdSchema.parse(req.params.id);
    const patch = ItemPatchSchema.parse(req.body);
    return await app.indexer.withWriteLock(async (index, ops) => {
      // Detect status:done + recurrence — run atomic op
      // Else apply patch, validate, write, broadcast
    });
  });

  app.delete('/api/items/:id', async (req, reply) => {
    const id = ItemIdSchema.parse(req.params.id);
    const permanent = req.query.permanent === 'true';
    // Branch to soft-delete or permanent-delete
  });

  app.post('/api/items/:id/restore', async (req, reply) => {
    const id = ItemIdSchema.parse(req.params.id);
    // Restore cascade
  });

  app.post('/api/items/:id/move', async (req, reply) => {
    // Re-parent or move-project
  });

  // Subtask sub-routes
  app.post('/api/items/:id/subtasks', async (req, reply) => { /* ... */ });
  app.patch('/api/items/:id/subtasks/:sid', async (req, reply) => { /* ... */ });
  app.delete('/api/items/:id/subtasks/:sid', async (req, reply) => { /* ... */ });
}
```

### 3.7 SSE broker

```ts
// middleware/sse-broker.ts
import { EventEmitter } from 'node:events';

export interface SSEEvent {
  type: string;
  payload: unknown;
  tabId: string | null;  // source tab id; null if unknown
}

export interface Broker {
  publish(event: SSEEvent): void;
  subscribe(handler: (e: SSEEvent) => void): () => void;
}

export function buildBroker(): Broker;
```

```ts
// routes/events.ts — SSE endpoint
import { FastifyInstance } from 'fastify';

export function registerEventsRoute(app: FastifyInstance) {
  app.get('/api/events', async (req, reply) => {
    const tabId = (req.query as any).tab_id ?? null;
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const unsubscribe = app.broker.subscribe((event) => {
      const source = event.tabId === tabId ? 'self' : 'other-tab';
      const data = JSON.stringify({ ...event.payload, source, timestamp: new Date().toISOString() });
      reply.raw.write(`event: ${event.type}\n`);
      reply.raw.write(`data: ${data}\n\n`);
    });

    const heartbeat = setInterval(() => reply.raw.write(`: ping\n\n`), 25_000);

    req.raw.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
}
```

---

## 4. Frontend — `apps/web/src/`

### 4.1 API client

```ts
// api/client.ts
import { z, ZodSchema } from 'zod';
import { ApiErrorSchema } from '@tasko/types';

export class ApiError extends Error {
  constructor(public code: string, public details?: unknown) {
    super(code);
  }
}

let TAB_ID: string;

export function getTabId(): string {
  if (!TAB_ID) {
    TAB_ID = crypto.randomUUID();
  }
  return TAB_ID;
}

export async function apiCall<TOut>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body: unknown | undefined,
  responseSchema: ZodSchema<TOut>,
): Promise<TOut> {
  const url = new URL(path, window.location.origin);
  const res = await fetch(url.toString(), {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Tasko-Tab-Id': getTabId(),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const json = await res.json();
    const parsed = ApiErrorSchema.safeParse(json);
    if (parsed.success) {
      throw new ApiError(parsed.data.error.code, parsed.data.error.details);
    }
    throw new ApiError('INTERNAL', json);
  }
  const json = await res.json();
  return responseSchema.parse(json);
}
```

### 4.2 Items API hooks

```ts
// api/items.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Item, ItemId, ItemCreate, ItemPatch, ItemSchema } from '@tasko/types';
import { apiCall } from './client';
import { itemKeys } from './keys';

export interface ItemListFilters {
  view: 'today' | 'tomorrow' | 'next7' | 'inbox' | 'all' | 'completed' | 'project' | 'tag';
  project_id?: string;
  tag_id?: string;
  parent_id?: string | 'root';
  status?: ('todo' | 'in_progress' | 'done')[];
  priority?: ('none' | 'low' | 'medium' | 'high')[];
  sort?: 'due_asc' | 'priority_desc' | 'title_asc' | 'created_desc' | 'completed_desc';
  include_completed?: boolean;
}

export function useItems(filters: ItemListFilters) {
  return useQuery({
    queryKey: itemKeys.list(filters),
    queryFn: () => apiCall('GET', buildItemsUrl(filters), undefined, ItemListResponseSchema),
  });
}

export function useItem(id: ItemId) {
  return useQuery({
    queryKey: itemKeys.detail(id),
    queryFn: () => apiCall('GET', `/api/items/${id}`, undefined, ItemSchema),
  });
}

export function useCreateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ItemCreate) => apiCall('POST', '/api/items', body, ItemSchema),
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
      queryClient.setQueryData(itemKeys.detail(item.id), item);
    },
  });
}

export function usePatchItem() { /* ... optimistic + undo per frontend-architecture.md §4.4 ... */ }
export function useTrashItem() { /* ... cascade soft-delete ... */ }
export function useRestoreItem() { /* ... cascade restore ... */ }
export function usePermanentDeleteItem() { /* ... */ }
export function useMoveItem() { /* ... re-parent / project move ... */ }
```

### 4.3 Stores — examples

```ts
// store/undo.ts
import { create } from 'zustand';

export interface UndoEntry {
  id: string;
  label: string;
  apply: () => Promise<void>;
  expiresAt: number;
}

interface UndoState {
  current: UndoEntry | null;
  push: (entry: Omit<UndoEntry, 'id'>) => void;
  pop: () => void;
  clear: () => void;
}

export const useUndoStore = create<UndoState>((set, get) => ({
  current: null,
  push: (entry) => {
    // Replace prior entry, set timer to clear at expiresAt
    const id = crypto.randomUUID();
    set({ current: { ...entry, id } });
    setTimeout(() => {
      if (get().current?.id === id) set({ current: null });
    }, entry.expiresAt - Date.now());
  },
  pop: () => {
    const entry = get().current;
    if (!entry) return;
    set({ current: null });
    void entry.apply();
  },
  clear: () => set({ current: null }),
}));
```

```ts
// store/snackbar.ts
import { create } from 'zustand';

export type SnackbarVariant = 'success' | 'info' | 'restored' | 'error' | 'depth-cap';

export interface SnackbarItem {
  id: string;
  variant: SnackbarVariant;
  text: string;
  action?: { label: string; onClick: () => void };
  durationMs: number;
}

interface SnackbarState {
  current: SnackbarItem | null;
  queue: SnackbarItem[];
  show: (item: Omit<SnackbarItem, 'id'>) => void;
  dismiss: () => void;
}

export const useSnackbarStore = create<SnackbarState>(/* ... */);
```

```ts
// store/hotkey-registry.ts
import { create } from 'zustand';

export type HotkeyMode =
  | 'no-input' | 'input' | 'modal' | 'sheet'
  | 'calendar' | 'kanban' | 'tree'
  | 'command-palette' | 'tag-input' | 'date-picker';

interface HotkeyState {
  modeStack: HotkeyMode[];
  currentMode: HotkeyMode;
  push: (m: HotkeyMode) => void;
  pop: () => void;
}

export const useHotkeyStore = create<HotkeyState>(/* ... */);
```

```ts
// store/theme.ts
import { create } from 'zustand';
import { Theme } from '@tasko/types';

interface ThemeState {
  preference: Theme;
  resolved: 'light' | 'dark';
  setPreference: (p: Theme) => void;
  setResolvedFromMedia: (matches: boolean) => void;
}

export const useThemeStore = create<ThemeState>(/* ... */);
```

### 4.4 Hooks — examples

```ts
// hooks/useHotkey.ts
export function useHotkey(mode: HotkeyMode, key: string, handler: (e: KeyboardEvent) => void): void;
```

```ts
// hooks/useFocusedRow.ts
export function useFocusedRow<T extends { id: string }>(items: T[]): {
  focusedId: string | null;
  setFocus: (id: string) => void;
  moveFocus: (delta: number) => void;
};
```

```ts
// hooks/useOptimisticMutation.ts
import { useMutation } from '@tanstack/react-query';

export function useOptimisticMutation<TInput, TOutput, TPrior>(opts: {
  mutationFn: (input: TInput) => Promise<TOutput>;
  buildOptimistic: (queryClient: QueryClient, input: TInput) => TPrior;
  buildUndo: (input: TInput, prior: TPrior) => { label: string; apply: () => Promise<void> };
  onSuccess?: (output: TOutput, input: TInput) => void;
  onError?: (input: TInput, prior: TPrior) => void;
  invalidate?: (queryClient: QueryClient, input: TInput) => void;
}): UseMutationResult<TOutput, ApiError, TInput, { prior: TPrior }>;
```

### 4.5 Routing

```tsx
// routes/__root.tsx
import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Sidebar } from '@/components/sidebar';

export const Route = createRootRoute({
  component: () => (
    <div className="root">
      <Sidebar />
      <main id="main">
        <Outlet />
      </main>
    </div>
  ),
});

// routes/today.tsx
import { createFileRoute } from '@tanstack/react-router';
import { TodayView } from '@/views/today-view';
import { z } from 'zod';

export const Route = createFileRoute('/today')({
  validateSearch: z.object({
    sort: z.enum(['due_asc', 'priority_desc', 'title_asc', 'created_desc']).default('due_asc'),
  }),
  component: TodayView,
});
```

### 4.6 Component skeleton — TaskListRow

```tsx
// components/task-list-row/index.tsx
import { Item } from '@tasko/types';
import styles from './styles.module.css';

export interface TaskListRowProps {
  item: Item;
  isFocused?: boolean;
  isSelected?: boolean;
  isMultiSelected?: boolean;
  showProjectBreadcrumb?: boolean;
  onClick?: () => void;
  onToggleCheckbox?: () => void;
  onClickTitle?: () => void;       // inline edit
  onClickDate?: () => void;        // open date popover
  onClickPriority?: () => void;    // open priority menu
  onClickTag?: (tagId: TagId) => void;
  onOpenMenu?: () => void;
  onOpenModal?: () => void;
}

export function TaskListRow(props: TaskListRowProps) {
  // Render priority dot, checkbox, title, multi-day chip, date chip, tag chips, subtask chip, hover affordances
  return <div className={styles.root} data-state={...}> ... </div>;
}
```

### 4.7 dnd-kit wiring example

```tsx
// views/project-view/tree-view.tsx (excerpt)
import { DndContext, closestCenter } from '@dnd-kit/core';
import { canMoveClient } from '@/lib/depth-cap-client';

export function TreeView() {
  const moveItem = useMoveItem();
  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={(event) => {
        const sourceId = event.active.id as ItemId;
        const targetId = event.over?.id as ItemId | undefined;
        const result = canMoveClient({ sourceId, targetId, items });
        if (!result.ok) {
          snackbar.show({ variant: 'depth-cap', text: result.reason });
          return;
        }
        moveItem.mutate({ id: sourceId, new_parent_id: targetId ?? null });
      }}
    >
      {/* ...tree rows... */}
    </DndContext>
  );
}
```

### 4.8 Markdown render

```ts
// lib/markdown.ts
import { marked, Renderer } from 'marked';
import DOMPurify from 'dompurify';

const renderer = new Renderer();
renderer.checkbox = (checked) =>
  `<span class="md-checkbox" data-checked="${checked}" aria-hidden="true">${checked ? '☑' : '☐'}</span>`;
renderer.link = (href, _title, text) =>
  `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${text}</a>`;

export function renderMarkdown(source: string): string {
  const raw = marked.parse(source, { renderer, breaks: true, async: false }) as string;
  return DOMPurify.sanitize(raw);
}
```

### 4.9 Textarea keybindings

```ts
// lib/textarea-ops.ts
export function wrapSelection(ta: HTMLTextAreaElement, prefix: string, suffix: string): void;
export function insertAtCursor(ta: HTMLTextAreaElement, text: string): void;
export function continueListItem(ta: HTMLTextAreaElement): boolean;
export function insertLinkPrompt(ta: HTMLTextAreaElement): void;
```

---

## 5. Test patterns

### 5.1 Server unit test (recurrence)

```ts
// apps/server/test/unit/recurrence.spec.ts
import { describe, it, expect } from 'vitest';
import { nextDueDate } from '../../src/domain/recurrence';

describe('recurrence.nextDueDate', () => {
  describe('daily', () => {
    it('on_schedule: next is prev + 1', () => {
      const result = nextDueDate({
        rule: { frequency: 'daily', anchor_mode: 'on_schedule' },
        previousDueDate: '2026-05-18',
        completedAt: '2026-05-19',
        previousStartDate: null,
      });
      expect(result.due_date).toBe('2026-05-19');
    });
    // ...80 more cases per data-model.md §6.4
  });
});
```

### 5.2 Server integration test (Items POST)

```ts
// apps/server/test/integration/items-create.spec.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildServer } from '../../src/server';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('POST /api/items', () => {
  let dataDir: string;
  let server: any;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'tasko-test-'));
    server = await buildServer({ dataDir, port: 0, host: '127.0.0.1', initIfMissing: true, logLevel: 'fatal' });
  });
  afterEach(async () => {
    await server.close();
    await rm(dataDir, { recursive: true });
  });

  it('creates a task with required fields', async () => {
    const res = await server.inject({
      method: 'POST', url: '/api/items',
      payload: { type: 'task', project_id: '00000000000000000000INBOX0', parent_id: null, title: 'Buy charger', due_date: '2026-05-18', start_date: null, due_time: null, priority: 'none', status: 'todo', tags: [], subtasks: [], recurrence: null },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.title).toBe('Buy charger');
    expect(body.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });
});
```

### 5.3 Frontend component test (Checkbox)

```tsx
// apps/web/src/components/checkbox/__tests__/Checkbox.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Checkbox } from '../index';

describe('Checkbox', () => {
  it('toggles on Space', async () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange} aria-label="Mark complete" />);
    const checkbox = screen.getByRole('checkbox');
    checkbox.focus();
    await userEvent.keyboard(' ');
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
```

### 5.4 Playwright E2E (Today flow)

```ts
// apps/web/test/e2e/today-overdue.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Today: overdue and bulk move', () => {
  test('Move all overdue moves them to today', async ({ page, request }) => {
    // Seed: create 3 overdue items via the API
    for (const title of ['A', 'B', 'C']) {
      await request.post('http://127.0.0.1:7373/api/items', {
        data: { type: 'task', project_id: '00000000000000000000INBOX0', parent_id: null, title, due_date: '2026-05-14', start_date: null, due_time: null, priority: 'none', status: 'todo', tags: [], subtasks: [], recurrence: null },
      });
    }
    await page.goto('http://127.0.0.1:7373/today');
    await expect(page.getByText('Overdue (3)')).toBeVisible();
    await page.getByRole('button', { name: /Move all overdue to today/ }).click();
    await page.getByRole('button', { name: /Move all/ }).click();
    await expect(page.getByText('Overdue')).not.toBeVisible();
    await expect(page.getByText('A')).toBeVisible();
    await expect(page.getByText('B')).toBeVisible();
    await expect(page.getByText('C')).toBeVisible();
  });
});
```

---

## 6. Conventions

- **One default export per file?** No. We prefer named exports for tree-shaking and clarity.
- **File naming**: `kebab-case` for files. `PascalCase` for component names. `camelCase` for functions and variables.
- **Imports**: workspace imports use `@tasko/types`; intra-app imports use `@/...` alias.
- **No `any`**. If a value is truly unknown, use `unknown` and narrow with zod.
- **Async**: prefer `async/await`. No raw Promise chains except where async/await would be awkward.
- **Errors**: throw typed errors; the route layer's error handler envelopes them.
- **Side effects in components**: only via hooks (`useEffect`, `useQuery`, `useMutation`). No imperative side effects in render paths.

---

This is the contract. Implementation may extend with internal helpers; the public exports above are stable.
