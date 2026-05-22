# Task 03 — Server REST CRUD routes

## Goal

Implement the basic REST surface for Items, Projects, Folders, Tags, Subtask sub-routes, and Config. The error envelope middleware turns thrown errors into `{ error: { code, message } }`. CORS is already wired (task 01). At the end of this task, every "basic CRUD" endpoint from `api.md` §12 works against a real data dir; tests cover happy paths and validation errors. **Not in this task: depth-cap enforcement (task 09), recurrence (task 11), soft-delete (task 12), bulk (task 12), SSE (task 17).** Mutations call `app.indexer.withWriteLock` so they serialize and atomic-write to disk. The SSE broker is instantiated as a stub here (an EventEmitter with no subscribers); task 17 wires `/api/events` and broker.subscribe.

## Context files

- `docs/engineering/2026-05-18-api.md` — every endpoint signature, query params, body shape, status codes, error codes. Read sections §1 (conventions), §2 (Items — but stop at §2.5 DELETE which is task 12; §2.6/2.7 restore/permanent-delete are task 12; §2.8 duplicate stays 501 forever; §2.9 move is just PATCH parent_id for now without depth-cap; §2.10 subtask sub-routes IS in this task), §4 (Projects — but `DELETE /api/projects/:id` cascade is task 12; basic create/patch/delete-without-tasks is here), §5 (Folders — full), §6 (Tags — full), §8 (Config — full), §10 (Health — already in task 01), §11 (Validation specifics).
- `docs/engineering/2026-05-18-code-architecture.md#3-6-routes----example--items` — route shape using `app.indexer.withWriteLock`.
- `docs/engineering/2026-05-18-data-model.md` — schemas and field semantics; particularly §3.6 cross-project moves cascade `project_id` (without depth-cap check in this task — task 09 layers that on), §5.3 Tag find-or-create with `name_lower`.
- `docs/engineering/2026-05-18-architecture.md#9-error-handling-philosophy` — error envelope shape; codes per `ApiErrorCodeSchema`.
- `docs/ux/microcopy.md#28-1-form-validation-errors` — error messages must match the spec for user-facing surfaces. The server's `message` field can be terse and engineering-friendly; the frontend maps codes to user-facing copy in task-04+.
- `docs/engineering/2026-05-18-open-questions.md#6-2-quick-add-project-pre-fill-on-per-project-view` — quick-add destination context (no server impact, but referenced in §6.4 for kanban column status pre-fill which is task 15).

## Downstream dependencies

- **Task 04** (frontend shell) writes the typed `apiCall` wrapper and a `client.ts`. The error envelope shape must match `ApiErrorSchema` exactly so the frontend can `safeParse` and route errors.
- **Task 08** (list views) hits `GET /api/items?view=today` and similar. Keep the query-param parser strict (reject unknown `view` values with 400).
- **Task 09** (hierarchy) will add `canMove` checks to `POST /api/items` and `PATCH /api/items/:id { parent_id }` and `POST /api/items/:id/move`. Today, those mutations validate that `parent_id` exists and is in the same project, but do not enforce the depth cap. Comment each such validation site with `// TODO(task-09): depth-cap check` so task 09 can find them.
- **Task 11** (recurrence) layers an "if `patch.status === 'done'` and item has non-null `recurrence`, do the atomic complete-recurring op" branch onto `PATCH /api/items/:id`. The current PATCH should pass through status changes but NOT yet generate a next instance. Comment with `// TODO(task-11): recurrence next-instance branch`.
- **Task 12** (trash) layers in `DELETE /api/items/:id` (soft-delete cascade), `POST /api/items/:id/restore`, `DELETE /api/items/:id?permanent=true`, `POST /api/trash/empty`, the four `/api/bulk/*` endpoints, and the project-delete cascade. Stub `DELETE /api/items/:id` and `DELETE /api/projects/:id` here to return 501 with code `INTERNAL` and message "Trash flow not yet implemented (task-12)." Same for `POST /api/trash/empty`. **Do** implement `POST /api/projects` / `PATCH /api/projects/:id` / `DELETE /api/folders/:id` (folders have no items beneath them so their delete is straightforward).
- **Task 17** wires the SSE broker. Each mutation should already publish to the broker today (the broker has no subscribers yet, so publishes are no-ops; this saves task-17 from threading publishes through every route). Use the `BulkCompletedEventSchema` etc. type names defined in task-02.

## Steps

1. **Error envelope middleware** — `apps/server/src/middleware/error-envelope.ts`:
   ```ts
   import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
   import { ZodError } from 'zod';
   import { ApiErrorCode } from '@tasko/types';

   export class HttpError extends Error {
     constructor(
       public statusCode: number,
       public code: ApiErrorCode,
       public override message: string,
       public details?: unknown,
     ) { super(message); }
   }

   export function envelope(err: unknown, _req: FastifyRequest, reply: FastifyReply) {
     if (err instanceof HttpError) {
       return reply.code(err.statusCode).send({ error: { code: err.code, message: err.message, details: err.details } });
     }
     if (err instanceof ZodError) {
       return reply.code(400).send({ error: { code: 'VALIDATION', message: 'Invalid request body.', details: err.issues } });
     }
     reply.log.error(err);
     return reply.code(500).send({ error: { code: 'INTERNAL', message: 'Server error.' } });
   }
   ```
   - Update `server.ts` `app.setErrorHandler(envelope)`.
2. **SSE broker stub** — `apps/server/src/middleware/sse-broker.ts` per `code-architecture.md` §3.7. Build an in-process pub/sub via Node's `EventEmitter`. The signature:
   ```ts
   export interface SSEEvent { type: string; payload: unknown; tabId: string | null; }
   export interface Broker { publish(event: SSEEvent): void; subscribe(handler: (e: SSEEvent) => void): () => void; }
   export function buildBroker(): Broker;
   ```
   - Decorate `app.broker = buildBroker()`. Every mutation route below calls `app.broker.publish(...)`. No subscribers exist yet (`/api/events` is task 17), so publishes are no-ops but typed.
3. **Items routes** — `apps/server/src/routes/items.ts`:
   - `GET /api/items` — parse query params via a zod schema (`ItemListQuerySchema` in `apps/server/src/routes/items.ts` — locally defined; not in shared types since it's server-internal). View filters per `api.md` §2.1:
     - `view=today`: `(due_date == todayLocal()) || (start_date <= today && today <= due_date) || (due_date < today)` (overdue included) AND `trashed_at == null` AND `status != 'done'`. Note: `todayLocal()` lives in `domain/time.ts` which task 11 builds; **for this task**, inline the helper here: ``const todayLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };``. Task 11 will replace it with the shared helper.
     - `view=tomorrow`: `due_date == today + 1 AND trashed_at == null AND status != 'done'`.
     - `view=next7`: `(due_date in [today, today+7) || (start_date <= today+6 && due_date >= today)) AND trashed_at == null AND status != 'done'`.
     - `view=inbox`: `project_id == INBOX_PROJECT_ID AND parent_id == null AND trashed_at == null AND status != 'done'`.
     - `view=all`: `trashed_at == null AND status != 'done'`.
     - `view=completed`: `status == 'done' AND trashed_at == null`.
     - `view=project`: `trashed_at == null` AND `project_id == query.project_id` (required); optional `parent_id` filter (`'root'` means `parent_id === null`).
     - `view=tag`: `trashed_at == null` AND `query.tag_id in item.tags`.
     - Sort per `sort` param. Default `due_asc`. `view=completed` defaults to `completed_desc`.
     - Apply `priority` repeatable filter (server only — frontend filter chips are session-only URL params).
     - Response: `{ items: Item[], count: number }`.
   - `GET /api/items/:id` — parse id via `ItemIdSchema`. Throw `HttpError(404, 'ITEM_NOT_FOUND', 'Item not found.')` if not in active items map.
   - `POST /api/items` — body via `ItemCreateSchema`. Within `withWriteLock`:
     - Validate `project_id` exists in `index.projects` → `PROJECT_NOT_FOUND` 404 if not.
     - Validate `parent_id` (if non-null): exists in `index.items` AND `parent.project_id === body.project_id` AND `parent.trashed_at == null`. Else → `PARENT_NOT_FOUND` 404 (or `VALIDATION` 400 if parent is in a different project).
     - `// TODO(task-09): depth-cap check via canMove(...)`.
     - Stamp `id` (new ULID via `ulid()`), `created_at`, `updated_at`, `schema_version: 1`, `completed_at: null`, `trashed_at: null`, `trashed_with: null`.
     - If `body.sort_order` absent: compute `(max(siblings.sort_order) || 0) + 1024` where siblings are items with the same `project_id` AND `parent_id`.
     - Validate every `body.tags` ID exists in `index.tags` → 400 `TAG_NOT_FOUND` if any missing.
     - Call `ops.writeItem(newItem)` → writes file + updates index.
     - Publish SSE: `app.broker.publish({ type: 'item.created', payload: { id: newItem.id, item: newItem }, tabId })`.
     - Return 201 with `newItem`.
   - `PATCH /api/items/:id` — body via `ItemPatchSchema`. Within `withWriteLock`:
     - Find source in `index.items`. If not found and exists in `index.trash` → 400 `VALIDATION` "Item is in trash; restore first.". Else 404.
     - Reject if `patch.trashed_at` or `patch.trashed_with` are present → 400 `VALIDATION` "Use trash endpoints to modify trash state." (per `api.md` §2.4).
     - If `patch.parent_id` is provided: validate same-project + existence as in POST. `// TODO(task-09): depth-cap`.
     - If `patch.project_id` is provided and differs from current: cascade `project_id` updates to all descendants atomically (descendants enumerated by walking `index.childrenOfItem` recursively). Each gets `project_id: patch.project_id` and is re-written. Adjacency caches update.
     - If `patch.tags` is provided: validate every tag id exists.
     - If `patch.status` is provided: if transitioning to `'done'`, stamp `completed_at = new Date().toISOString()`; if transitioning away from `'done'`, clear `completed_at = null`. `// TODO(task-11): if source.recurrence != null AND transitioning to done, run atomic complete-recurring op and return { completed, next }`.
     - Stamp `updated_at = now`.
     - `ops.writeItem(merged)`. Publish `item.changed`.
     - Return 200 with merged item.
   - `DELETE /api/items/:id` — stub: throw `HttpError(501, 'INTERNAL', 'Soft-delete not yet implemented (task-12).')`.
   - `POST /api/items/:id/restore` — stub: same 501.
   - `POST /api/items/:id/move` — simple wrapper around PATCH for now: body `{ new_parent_id?, new_project_id? }`. Apply as a PATCH with those fields. Same TODOs.
   - **Subtask sub-routes**:
     - `POST /api/items/:id/subtasks` — body via `SubtaskCreateSchema`. Within `withWriteLock`: find parent in `index.items`. Reject if parent type !== `'task'` → 422 `VALIDATION` "Subtasks attach only to Tasks.". Reject if parent is trashed. Append a new Subtask (stamp id, created_at, updated_at, status=todo, completed_at=null, sort_order=last+1024). Write the parent item. Publish `item.changed`. Respond 201 with the **parent Item** (per api.md §2.10).
     - `PATCH /api/items/:id/subtasks/:sid` — body via `SubtaskPatchSchema`. Find parent → find subtask in `parent.subtasks` → merge → update parent. If `status` transitions to `'done'`, stamp `completed_at`. Write parent. Publish `item.changed`. Return parent.
     - `DELETE /api/items/:id/subtasks/:sid` — remove subtask from array. Write parent. Publish `item.changed`. Return parent.
4. **Projects routes** — `apps/server/src/routes/projects.ts`:
   - `GET /api/projects` — return all projects sorted: Inbox first, then by `(folder_id, sort_order ASC)` per `api.md` §4.1.
   - `GET /api/projects/:id`.
   - `POST /api/projects` — body via `ProjectCreateSchema`. Reject `is_inbox: true` in body (server only sets this on the sentinel). Stamp id/created_at/updated_at/schema_version/is_inbox=false. Default `sort_order` to `(max existing + 1024)`. Validate `folder_id` exists if non-null. Write. Publish `project.created`. 201.
   - `PATCH /api/projects/:id` — body via `ProjectPatchSchema`. Reject any change to Inbox (`id === INBOX_PROJECT_ID`) → 409 `INBOX_IMMUTABLE` "Inbox cannot be modified.". Validate new `folder_id` exists. Merge, stamp `updated_at`. Write. Publish `project.changed`.
   - `DELETE /api/projects/:id` — stub: 501 "Project deletion (cascade) is task-12.". Per the open-questions binding resolution §4.7, Project Restore is deferred to v1.1 — but the delete-cascade itself ships in task-12.
5. **Folders routes** — `apps/server/src/routes/folders.ts`:
   - `GET /api/folders`, `GET /api/folders/:id`.
   - `POST /api/folders` — body via `FolderCreateSchema`. Stamp id/timestamps/schema_version. Default sort_order. Write. Publish `folder.created`. 201.
   - `PATCH /api/folders/:id` — `FolderPatchSchema`. Write. Publish `folder.changed`.
   - `DELETE /api/folders/:id` — per `api.md` §5.5, cascade: find every project with `folder_id == id`, set `folder_id: null` on each (cascade write), delete the folder file. All inside `withWriteLock`. Publish `folder.deleted` plus `project.changed` for each moved project. Return `{ deleted_folder_id, projects_moved }`.
6. **Tags routes** — `apps/server/src/routes/tags.ts`:
   - `GET /api/tags` — query `prefix?: string`, `include_orphans?: boolean` (default false). Filter tags by `name_lower.startsWith(prefix?.toLowerCase())` if prefix present. If `include_orphans=false`, filter out tags whose id is not in `index.itemsByTag` (i.e., tags with at least one active item). Cap at 50 for the prefix query (per api.md §6.1). Return `{ tags, count }`.
   - `GET /api/tags/:id`.
   - `POST /api/tags` — body `{ name: string }`. Strip leading `#` if present. Compute `name_lower = name.toLowerCase().trim()`. Validate length 1-32 after stripping. **Find-or-create**: if `index.tagsByLower.get(name_lower)` returns an existing id, return that tag with status 200 (NOT 201). Else create a new tag (preserving user-typed casing in `name`), stamp id/created_at/updated_at/schema_version. Write. Publish `tag.created`. Return 201 with new tag.
   - `GET /api/tags/autocomplete?q=<prefix>` — convenience alias for `GET /api/tags?prefix=...`.
   - `DELETE /api/tags/:id` — 501 `INTERNAL` "Tag deletion is post-v1.".
7. **Config routes** — `apps/server/src/routes/config.ts`:
   - `GET /api/config` — return `app.indexer.getIndex().config`.
   - `PATCH /api/config` — body via `ConfigPatchSchema`. Within withWriteLock, merge with existing config, stamp `last_modified: now`. Call `ops.writeConfig(merged)`. Publish `config.changed`. Return updated config.
8. **Wire routes in `server.ts`** — `registerItemRoutes(app); registerProjectRoutes(app); registerFolderRoutes(app); registerTagRoutes(app); registerConfigRoutes(app);` — health already registered in task 01. Set `app.setErrorHandler(envelope)`. Set NotFound handler to return `{ error: { code: 'INTERNAL', message: 'Route not found.' } }` with 404.
9. **Tests** — `apps/server/test/integration/`:
   - `items-crud.spec.ts`: full CRUD lifecycle. POST → GET by id → PATCH (title, priority) → list (`view=all`) → check it's there. Test validation errors: missing title → 400; bad date format → 400; parent in different project → 400; parent_id pointing at trashed item → 404 (we treat trashed items as not-active for parent purposes).
   - `items-list-views.spec.ts`: seed a fixture set of items (overdue, today, tomorrow, day-after, multi-day, completed, in-project, in-tag). Hit each `view=` param. Assert correct filtering.
   - `items-subtasks.spec.ts`: POST a Task → add 3 subtasks → reorder via PATCH (sort_order) → mark one done → assert parent's `subtasks[].completed_at` is set. Attempt to add subtask to a Feature → 422.
   - `items-cross-project-move.spec.ts`: create Epic→Feature→Task in Project A. PATCH the Epic's `project_id` to Project B. Assert Feature and Task also moved (their `project_id == B`).
   - `projects-crud.spec.ts`: POST → PATCH → reject Inbox PATCH → reject Inbox in POST is_inbox true → DELETE returns 501.
   - `folders-crud.spec.ts`: POST a folder → POST 2 projects with `folder_id` → DELETE the folder → assert both projects have `folder_id: null`.
   - `tags-find-or-create.spec.ts`: POST `{ name: 'urgent' }` → 201, new tag. POST `{ name: '#URGENT' }` → 200, same tag (case-insensitive dedup, leading-# stripped). GET `/api/tags?prefix=urg` returns the tag.
   - `config.spec.ts`: GET default → PATCH theme to 'dark' → GET → assert theme: 'dark', last_modified updated.
   - `error-envelope.spec.ts`: PATCH a non-existent item → 404 with `{ error: { code: 'ITEM_NOT_FOUND', message } }`. POST item with bad date → 400 `VALIDATION` with `details` containing zod issues.

## Acceptance criteria

- [ ] `pnpm --filter @tasko/server typecheck` reports 0 errors.
- [ ] `pnpm --filter @tasko/server test` — every spec listed in step 9 passes.
- [ ] Manually verifiable via `curl`:
  - `curl -X POST http://127.0.0.1:7373/api/items -H 'Content-Type: application/json' -d '{"type":"task","project_id":"00000000000000000000INBOX0","parent_id":null,"title":"Test","notes":"","due_date":"2026-05-18","start_date":null,"due_time":null,"priority":"none","status":"todo","tags":[],"subtasks":[],"recurrence":null}'` returns 201 with the item.
  - `curl http://127.0.0.1:7373/api/items?view=today` returns `{items: [...], count: N}`.
  - `curl -X POST http://127.0.0.1:7373/api/projects -H 'Content-Type: application/json' -d '{"name":"Q3 Launch","folder_id":null,"is_hierarchical":true,"color":null,"icon":null}'` returns 201.
  - `curl -X PATCH http://127.0.0.1:7373/api/projects/00000000000000000000INBOX0 -H 'Content-Type: application/json' -d '{"name":"x"}'` returns 409 `INBOX_IMMUTABLE`.
  - `curl -X POST http://127.0.0.1:7373/api/tags -H 'Content-Type: application/json' -d '{"name":"urgent"}'` returns 201; same call again returns 200 (same tag).
  - `curl -X PATCH http://127.0.0.1:7373/api/items/<id> -H 'Content-Type: application/json' -d '{"trashed_at":"2026-01-01T00:00:00Z"}'` returns 400 `VALIDATION`.
- [ ] After server restart, the disk files under `items/`, `projects/`, `folders/`, `tags/`, `config.json` are valid JSON and re-parse cleanly into the indexer.
- [ ] Every mutation route inside `withWriteLock` publishes an SSE event via `app.broker.publish` (no subscribers yet — task 17 wires the route).
- [ ] `pnpm lint` is clean.

## Output files

- Created:
  - `apps/server/src/middleware/error-envelope.ts`, `apps/server/src/middleware/sse-broker.ts`
  - `apps/server/src/routes/items.ts`, `apps/server/src/routes/projects.ts`, `apps/server/src/routes/folders.ts`, `apps/server/src/routes/tags.ts`, `apps/server/src/routes/config.ts`
  - `apps/server/test/integration/items-crud.spec.ts`, `items-list-views.spec.ts`, `items-subtasks.spec.ts`, `items-cross-project-move.spec.ts`
  - `apps/server/test/integration/projects-crud.spec.ts`, `folders-crud.spec.ts`, `tags-find-or-create.spec.ts`, `config.spec.ts`, `error-envelope.spec.ts`
- Modified:
  - `apps/server/src/server.ts` — register all new routes, set the envelope error handler + 404 handler, decorate `app.broker = buildBroker()`. Augment Fastify types to add `broker: Broker`.
