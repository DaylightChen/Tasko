---
title: Tasko — Data Model
date: 2026-05-18
phase: engineering
scope: project
status: draft
---

# Tasko — Data Model

The canonical engineering data model. Every entity, every field, every constraint, the file-on-disk layout, and the algorithms that mutate them.

All schemas are **zod**, both for runtime validation and for TypeScript types (via `z.infer<typeof Schema>`). They live in `packages/types/` and are imported by `apps/server` (request bodies + file parse) and `apps/web` (response types + form bodies).

Where useful, examples are inline.

---

## 1. ID strategy

- **ULID** for every entity ID (Items, Projects, Folders, Tags, Subtasks). 26 chars, base32, lexicographically sortable by timestamp.
- Brand the type to prevent cross-type mix-ups:
  ```ts
  type ItemId = string & { __brand: 'ItemId' };
  type ProjectId = string & { __brand: 'ProjectId' };
  type FolderId = string & { __brand: 'FolderId' };
  type TagId = string & { __brand: 'TagId' };
  type SubtaskId = string & { __brand: 'SubtaskId' };
  ```
- Zod schema:
  ```ts
  const UlidSchema = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  export const ItemIdSchema = UlidSchema.brand<'ItemId'>();
  // ...same for ProjectId, etc.
  ```
- **Inbox is also a Project with a fixed ULID-shaped sentinel id**: `00000000000000000000INBOX0`. (26 chars; not a real ULID but matches the regex.) The sentinel is created by `--init`. Constraint check at the route level: `inbox_id` cannot be deleted, renamed, or moved into a folder.

---

## 2. Common fields

Every entity has:

```ts
const CommonFieldsSchema = z.object({
  id: UlidSchema,              // per the type brand
  created_at: z.string().datetime(),  // ISO 8601 with offset (we always write UTC)
  updated_at: z.string().datetime(),  // ditto
  schema_version: z.literal(1),       // for forward-compat; v1 ships as 1
});
```

`schema_version` is a literal `1` in v1. v1.1+ may bump it; the indexer's parse step branches on the version and forwards-migrates the in-memory representation. Files on disk are **never automatically migrated** during a read; migration is an explicit user action (`tasko migrate`) post-v1. v1's stance is: the parser tolerates older versions if it can, otherwise it logs and skips.

---

## 3. Item (Task / Feature / Epic)

The workhorse entity. The product spec §4.3 calls these "Items"; we use the same term in code.

### 3.1 Zod schema

```ts
export const ItemTypeSchema = z.enum(['epic', 'feature', 'task']);
export type ItemType = z.infer<typeof ItemTypeSchema>;

export const StatusSchema = z.enum(['todo', 'in_progress', 'done']);
export type Status = z.infer<typeof StatusSchema>;

export const PrioritySchema = z.enum(['none', 'low', 'medium', 'high']);
export type Priority = z.infer<typeof PrioritySchema>;

// YYYY-MM-DD local date string. NOT an ISO timestamp.
export const LocalDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export type LocalDate = z.infer<typeof LocalDateSchema>;

// HH:MM in 24h. NOT timezone aware.
export const LocalTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export type LocalTime = z.infer<typeof LocalTimeSchema>;

export const ItemSchema = z.object({
  id: ItemIdSchema,
  schema_version: z.literal(1),
  type: ItemTypeSchema,
  project_id: ProjectIdSchema,
  parent_id: ItemIdSchema.nullable(),

  title: z.string().min(1).max(500),
  notes: z.string().max(50_000).default(''),   // markdown body

  due_date: LocalDateSchema,                   // required per product spec §4.3
  start_date: LocalDateSchema.nullable(),      // null = single-day; equal-to-due is also valid
  due_time: LocalTimeSchema.nullable(),

  priority: PrioritySchema.default('none'),
  status: StatusSchema.default('todo'),

  tags: z.array(TagIdSchema).default([]),
  subtasks: z.array(SubtaskSchema).default([]),  // inlined — see §4
  recurrence: RecurrenceRuleSchema.nullable(),

  completed_at: z.string().datetime().nullable(),
  trashed_at: z.string().datetime().nullable(),
  trashed_with: ItemIdSchema.nullable(),       // the parent it was trashed alongside; see §3.4

  sort_order: z.number().int(),                // user-defined, lexicographic by integer

  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})
.refine(
  v => v.start_date === null || v.start_date <= v.due_date,
  { path: ['start_date'], message: 'start_date must be on or before due_date' },
);

export type Item = z.infer<typeof ItemSchema>;
```

### 3.2 Variants for API I/O

```ts
export const ItemCreateSchema = ItemSchema
  .omit({ id: true, created_at: true, updated_at: true, completed_at: true, trashed_at: true, trashed_with: true, schema_version: true })
  // type = task is the default; created via tree's "+ Add Epic / Add Feature / Add Task"
  .extend({
    sort_order: z.number().int().optional(), // server picks if absent
    subtasks: z.array(SubtaskCreateSchema).optional(),
  });

export const ItemPatchSchema = ItemSchema
  .omit({ id: true, created_at: true, schema_version: true, trashed_at: true, trashed_with: true })
  .partial()
  .extend({
    updated_at: z.string().datetime().optional(), // server stamps regardless
  });
```

Mutations of `trashed_at`/`trashed_with` go through dedicated trash endpoints (POST `/api/trash` / POST `/api/trash/:id/restore`), not generic PATCH. This prevents accidentally toggling trash state via a normal update.

### 3.3 Field-by-field semantics

| Field | Notes |
|---|---|
| `id` | ULID. Immutable. |
| `schema_version` | `1` in v1. Pre-validated on parse. |
| `type` | `epic` / `feature` / `task`. Drives icon (per UX) + which checkbox the tree row renders + Kanban filter. Mutations of `type` are allowed in v1 (the user can "promote" a Task to a Feature) provided depth-cap holds. |
| `project_id` | Required. Inbox is a project too. Mutations move the item to a new project; descendants follow (see §3.6). |
| `parent_id` | Null for top-level items in a project. Items whose `type=task` may have subtasks (in `subtasks[]`, see §4). |
| `title` | 1-500 chars. Strip trailing whitespace on save. |
| `notes` | Markdown body, ≤ 50k chars. Renderer respects checklists (display-only — `- [ ]` and `- [x]` render as visually-checked but non-interactive). |
| `due_date` | **Required.** Per product spec — every active Item has a due date. |
| `start_date` | If null, single-day item; surfaces only on `due_date`. If non-null and < `due_date`, multi-day item; surfaces every day in [start_date, due_date] (per spec §4.3). |
| `due_time` | If null, all-day. If set, HH:MM in local wall-clock time, no timezone math. |
| `priority` | `none` / `low` / `medium` / `high`. Sort signal only. |
| `status` | `todo` / `in_progress` / `done`. Kanban columns bind to this. |
| `tags` | Array of TagIds. Order is irrelevant; server may sort canonically on write. |
| `subtasks` | Array of inlined Subtask objects. See §4 for why inlined. |
| `recurrence` | Embedded RecurrenceRule or null. See §6. |
| `completed_at` | ISO 8601 UTC timestamp; set on `status: 'done'`, cleared on un-check. |
| `trashed_at` | ISO 8601 UTC timestamp; set on soft-delete. |
| `trashed_with` | If this item was trashed as part of a parent's trash cascade, points to the parent's id. Otherwise null. See §3.4. |
| `sort_order` | Integer; user-defined ordering within the same parent (or within the project root if `parent_id` is null). Server-assigned on create as `(max(sibling sort_orders) || 0) + 1024`. Reordering may renumber siblings sparsely (multiples of 1024) to avoid full re-sort. |
| `created_at` / `updated_at` | Server-stamped. Client may pass `updated_at` on PATCH, but server overrides. |

### 3.4 Soft-delete semantics (cascade & restore)

When the user trashes an item `P` with descendants:

1. Server enumerates `P` + every descendant (Tasks under Features under P, etc.).
2. For each, sets `trashed_at = now` and `trashed_with = P.id` for descendants (and `null` for `P` itself).
3. Moves each file from `items/<id>.json` → `trash/<id>.json`.
4. All under a single mutex lock so the cascade is atomic.

When the user **restores** an item `P` from trash:

1. Server moves `P` back from `trash/<id>.json` → `items/<id>.json`, clears `trashed_at` and `trashed_with`.
2. Server enumerates every item `X` in trash where `X.trashed_with === P.id`. Restores each one too.
3. If a restored descendant's `parent_id` no longer exists (e.g., the user permanently deleted an intermediate ancestor while it was in Trash), the restored item is reparented to the project root and its `parent_id = null`. A snackbar surfaces this case.

When the user trashes an item `X` **independently** (not as a parent's cascade), and `X` later has its parent trashed:

- `X.trashed_with` was `null` (independent trash). The cascade now trashing the parent does NOT touch `X` (it's already in trash with `trashed_with = null`).
- If the parent is later restored, `X` stays in Trash because `X.trashed_with !== parent.id`.

**This is the locked rule** (resolves product spec §9.1 #6): a restored parent restores only the descendants that were trashed in the same cascade as that parent. Items trashed independently remain in trash.

### 3.5 Active vs Completed vs Trashed (state matrix)

| State | `trashed_at` | `completed_at` | Visible in |
|---|---|---|---|
| Active todo | null | null | Today / Tomorrow / Next 7 / Inbox / All / per-project / per-tag / Calendar / Kanban "To Do" |
| Active in_progress | null | null | Same as above, Kanban "In Progress" column |
| Active completed | null | set | Completed view, Kanban "Done" column |
| Trashed | set | (any) | Trash view |

On `status → done`: `completed_at = now`.
On `status → todo` (un-check from Completed): `completed_at = null`, item returns to its prior visibility (which may now be Overdue if the due_date is in the past).

### 3.6 Cross-project moves

When the user moves an item `X` from project `A` to project `B`:

- `X.project_id = B`.
- All descendants of `X` (Features/Tasks under an Epic, etc.) recursively update their `project_id = B` too.
- `parent_id` is preserved (the family tree stays intact in the new project).
- This is an atomic operation (single mutex).
- Depth-cap check: since the same family is moving wholesale, the cap is unaffected.

### 3.7 Hierarchy & depth-cap

**The cap: 4 levels total**, counted from the project root down.

```
Level 1: project root → Item (top-level in project)
Level 2:                  → child Item
Level 3:                     → grandchild Item
Level 4:                        → subtask (only allowed under a Level 3 Item that is type=task)
```

Subtasks count as Level 4 and **must** sit under a Task. (Subtasks attach only to `type=task` items — schema-enforced.)

A "loose" Task at project root: Level 1 = Task. Then Level 2 = subtask. Two levels total. Fine.
A "loose" Feature at project root: Level 1 = Feature, Level 2 = Task, Level 3 = subtask. Three levels total. Fine.
An Epic with deep children: Level 1 = Epic, Level 2 = Feature, Level 3 = Task, Level 4 = subtask. Exact cap.

**Algorithm** (`domain/depth-cap.ts`):

```ts
function levelOf(item: Item, items: Map<ItemId, Item>): number {
  let level = 1;
  let cursor = item.parent_id ? items.get(item.parent_id) : null;
  while (cursor) {
    level++;
    cursor = cursor.parent_id ? items.get(cursor.parent_id) : null;
  }
  return level;
}

function maxDescendantDepth(item: Item, items: Map<ItemId, Item>): number {
  // Returns the deepest nesting under `item`, where item itself is depth 0.
  const children = [...items.values()].filter(i => i.parent_id === item.id && !i.trashed_at);
  if (children.length === 0) {
    // Subtasks are inlined on Tasks. A task's own subtasks add 1 to depth.
    if (item.type === 'task' && (item.subtasks ?? []).length > 0) return 1;
    return 0;
  }
  return 1 + Math.max(...children.map(c => maxDescendantDepth(c, items)));
}

function canMove({
  source,          // Item to move
  newParent,       // null = project root; or Item
  items,           // current in-memory index
}: {
  source: Item,
  newParent: Item | null,
  items: Map<ItemId, Item>,
}): { ok: true } | { ok: false; reason: string } {
  // Subtask attachment rule:
  if (source.type !== 'task' && newParent && newParent.type === 'task') {
    return { ok: false, reason: 'Only subtasks may attach to a Task.' };
  }
  // Compute the new level of source if placed under newParent:
  const newSourceLevel = newParent === null ? 1 : levelOf(newParent, items) + 1;
  // Compute the deepest descendant under source. Then total = newSourceLevel + maxDescendantDepth(source).
  const dDepth = maxDescendantDepth(source, items);
  if (newSourceLevel + dDepth > 4) {
    return { ok: false, reason: `Would exceed nesting depth (level ${newSourceLevel + dDepth}, cap is 4).` };
  }
  // Cycle check:
  if (newParent) {
    let cursor: Item | null = newParent;
    while (cursor) {
      if (cursor.id === source.id) return { ok: false, reason: 'Cannot place under own descendant.' };
      cursor = cursor.parent_id ? items.get(cursor.parent_id) ?? null : null;
    }
  }
  return { ok: true };
}
```

This `canMove` is the single source of truth. Every mutation that changes `parent_id` calls it; every drag-and-drop calls it (frontend mirror in `lib/depth-cap-client.ts`); the move-to picker disables candidates where `canMove` returns `ok: false`.

### 3.8 File layout for Items

```
items/01HM5T9N3X9KP4Y7HVZ2QWE4N6.json
```

File contents = JSON-stringified `Item` object with 2-space indentation (for git diff legibility). Atomic write: write to `items/01H...N6.json.tmp`, then `fs.rename` to `items/01H...N6.json`.

Trashed:

```
trash/01HM5T9N3X9KP4Y7HVZ2QWE4N6.json
```

The file is **moved**, not copied. Restoring is the reverse.

---

## 4. Subtask

### 4.1 Why inlined

Subtasks live **inside their parent Task's JSON file** as an array on the Item, not in their own directory. Three reasons:

1. The product spec is explicit (§4.4): subtasks have no independent existence beyond their parent. They share lifecycle (deleting the parent deletes the subtasks; restoring brings them back).
2. Subtask churn is bounded (a user has 3-10 subtasks per task; not 500). Inlining them doesn't bloat the parent file meaningfully.
3. Avoiding a separate `subtasks/` directory keeps the file count manageable on disk and reduces git-merge surface for a single Task change.

### 4.2 Zod schema

```ts
export const SubtaskStatusSchema = z.enum(['todo', 'done']);  // no in_progress — locked by spec §9.4 #6

export const SubtaskSchema = z.object({
  id: SubtaskIdSchema,
  title: z.string().min(1).max(200),
  status: SubtaskStatusSchema.default('todo'),
  completed_at: z.string().datetime().nullable().default(null),
  sort_order: z.number().int(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const SubtaskCreateSchema = SubtaskSchema
  .omit({ id: true, created_at: true, updated_at: true, completed_at: true })
  .extend({
    sort_order: z.number().int().optional(),
  });

export type Subtask = z.infer<typeof SubtaskSchema>;
```

Subtasks have no:
- `due_date`, `start_date`, `due_time`
- `priority`
- `notes`
- `tags`
- `recurrence`
- `project_id` (inherited from parent)
- `parent_id` (parent is the containing Task)
- `type` (always implicitly subtask)

### 4.3 Mutations of subtasks go through the parent

API:
- `PATCH /api/items/:id { subtasks: [...] }` — full replacement of the array.
- Or convenience endpoints: `POST /api/items/:id/subtasks`, `PATCH /api/items/:id/subtasks/:sid`, `DELETE /api/items/:id/subtasks/:sid`.

We expose both. Whole-array PATCH for the editor view (modal save), per-subtask PATCH for the inline check-off in the modal's subtask list.

### 4.4 Subtask completion does NOT affect parent

Per product spec §4.4. The parent's `status` is independent of its subtasks. The progress chip `2/5` is a display-only computed value (count of subtasks with `status: 'done'`). On parent-completion, the prompt asks "complete all children & continue?" — if confirmed, the server sets `status: 'done'` on the parent and on every subtask atomically.

---

## 5. Project, Folder, Tag

### 5.1 Project

```ts
export const ProjectSchema = z.object({
  id: ProjectIdSchema,
  schema_version: z.literal(1),
  name: z.string().min(1).max(80),
  folder_id: FolderIdSchema.nullable(),
  is_hierarchical: z.boolean().default(false),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().default(null), // optional, post-v1 may surface
  icon: z.string().max(40).nullable().default(null), // Lucide name; optional, post-v1 may surface
  sort_order: z.number().int(),
  is_inbox: z.boolean().default(false),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const ProjectCreateSchema = ProjectSchema
  .omit({ id: true, created_at: true, updated_at: true, schema_version: true, is_inbox: true })
  .extend({
    sort_order: z.number().int().optional(),
  });

export const ProjectPatchSchema = ProjectSchema
  .omit({ id: true, created_at: true, schema_version: true, is_inbox: true })
  .partial();

export type Project = z.infer<typeof ProjectSchema>;
```

Server validates on `Project` writes:
- If `is_inbox === true`, rejects rename, folder move, deletion. Only the bootstrapped Inbox carries `is_inbox: true`.
- `folder_id` may be null (no folder), or an existing FolderId (cross-check on PATCH).

File: `projects/<id>.json`.

### 5.2 Folder

```ts
export const FolderSchema = z.object({
  id: FolderIdSchema,
  schema_version: z.literal(1),
  name: z.string().min(1).max(60),
  sort_order: z.number().int(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Folder = z.infer<typeof FolderSchema>;
```

File: `folders/<id>.json`.

On folder delete: per product spec + UX `microcopy.md` §6.8 — Projects inside move to `folder_id: null`. The cascade is atomic: list children projects, set their `folder_id: null`, write each, delete the folder file.

### 5.3 Tag

```ts
export const TagSchema = z.object({
  id: TagIdSchema,
  schema_version: z.literal(1),
  name: z.string().min(1).max(32),
  name_lower: z.string().min(1).max(32),  // computed: lowercased name, used for autocomplete
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().default(null),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Tag = z.infer<typeof TagSchema>;
```

Naming rules (server-enforced):
- `name` is stored as the user typed it (preserving casing) per UX `flows.md` §13.
- `name_lower` is the canonical form. Two tags with the same `name_lower` cannot coexist.
- When the user creates a tag via the input, the server checks if `name_lower` already exists; if yes, returns the existing tag (no duplicate); if no, creates.
- The `#` prefix is stripped by the API layer before storage; both `urgent` and `#urgent` resolve to `name_lower: 'urgent'`.

File: `tags/<id>.json`.

Tag management (rename, delete, merge) is **post-v1** per product spec. The server endpoints for tag deletion exist for completeness (a future UI may surface them) but the v1 UI does not call them. Orphaned tags (no items reference them) are not deleted automatically — they linger in the file system but don't appear in the sidebar (per spec §4.5).

---

## 6. RecurrenceRule and next-instance algorithm

### 6.1 Zod schema

```ts
export const FrequencySchema = z.enum(['daily', 'every_n_days', 'weekly', 'monthly', 'yearly']);

export const WeekdaySchema = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);

export const AnchorModeSchema = z.enum(['on_schedule', 'after_completion']);

export const RecurrenceRuleSchema = z.discriminatedUnion('frequency', [
  z.object({
    frequency: z.literal('daily'),
    anchor_mode: AnchorModeSchema,
  }),
  z.object({
    frequency: z.literal('every_n_days'),
    interval: z.number().int().min(1).max(365),
    anchor_mode: AnchorModeSchema,
  }),
  z.object({
    frequency: z.literal('weekly'),
    weekdays: z.array(WeekdaySchema).min(1).max(7), // set-like; server canonicalizes
    anchor_mode: AnchorModeSchema,
  }),
  z.object({
    frequency: z.literal('monthly'),
    day_of_month: z.number().int().min(1).max(31),
    anchor_mode: AnchorModeSchema,
  }),
  z.object({
    frequency: z.literal('yearly'),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
    anchor_mode: AnchorModeSchema,
  }),
]);

export type RecurrenceRule = z.infer<typeof RecurrenceRuleSchema>;
```

Rule is stored embedded in the Item; not its own file.

### 6.2 Anchor mode (`on_schedule` vs `after_completion`)

Per product spec §4.6 / §7.5:

- `on_schedule`: next due_date is computed from the **previous instance's due_date**, regardless of when the user actually completed.
- `after_completion`: next due_date is computed from the **completion timestamp** (today, when the user checked).

### 6.3 Next-instance generation: pure function

```ts
// In domain/recurrence.ts
// Returns the next instance's due_date and start_date (if multi-day).
function nextDueDate(opts: {
  rule: RecurrenceRule;
  previousDueDate: LocalDate;
  completedAt: LocalDate;      // local date of completion (server's local clock)
  previousStartDate: LocalDate | null;
}): { due_date: LocalDate; start_date: LocalDate | null } {
  const { rule, previousDueDate, completedAt, previousStartDate } = opts;

  // Anchor source date:
  const anchor: LocalDate = rule.anchor_mode === 'on_schedule' ? previousDueDate : completedAt;

  let nextDue: LocalDate;
  switch (rule.frequency) {
    case 'daily':
      nextDue = addDays(anchor, 1);
      break;

    case 'every_n_days':
      nextDue = addDays(anchor, rule.interval);
      break;

    case 'weekly':
      // Find the next weekday in rule.weekdays AFTER anchor.
      // For on_schedule: anchor is the previous due_date; we want the next weekday after it.
      // For after_completion: anchor is completion date; we want the next scheduled weekday after it.
      nextDue = nextScheduledWeekday(anchor, rule.weekdays);
      break;

    case 'monthly':
      // anchor month + 1; clamp day to last day of new month if rule.day_of_month exceeds it.
      nextDue = nextMonthlyDate(anchor, rule.day_of_month);
      break;

    case 'yearly':
      // anchor year + 1; same {month, day}; Feb 29 → Feb 28 in non-leap.
      nextDue = nextYearlyDate(anchor, rule.month, rule.day);
      break;
  }

  // Multi-day span preservation:
  let nextStart: LocalDate | null = null;
  if (previousStartDate !== null) {
    const delta = daysBetween(previousStartDate, previousDueDate);  // non-negative
    nextStart = addDays(nextDue, -delta);
  }

  return { due_date: nextDue, start_date: nextStart };
}
```

Helpers (`time.ts`):
- `addDays(date, n)`: pure local-date arithmetic. Implementation note: parse `YYYY-MM-DD` into a Date with `new Date(y, m-1, d)` (constructs in local TZ at midnight); add days; format back. We do NOT use Date.UTC because the calendar is intentionally local-only per product spec.
- `daysBetween(a, b)`: pure integer days, ignoring time.
- `nextScheduledWeekday(anchor, weekdays)`: iterate `anchor + 1 → anchor + 7`, return the first match. Always finds one because `weekdays.length >= 1`.
- `nextMonthlyDate(anchor, day_of_month)`:
  ```
  let y = anchor.year; let m = anchor.month + 1;
  if (m > 12) { y++; m = 1; }
  const last = lastDayOfMonth(y, m);
  const d = Math.min(day_of_month, last);
  return LocalDate(y, m, d);
  ```
- `nextYearlyDate(anchor, month, day)`:
  ```
  const y = anchor.year + 1;
  const last = lastDayOfMonth(y, month);
  const d = Math.min(day, last);
  return LocalDate(y, month, d);
  ```

### 6.4 Test cases (must-have, in `apps/server/test/unit/recurrence.spec.ts`)

A short list; the actual suite expands each into multiple assertions.

| Case | Rule | Prev due | Completed | Expected next |
|---|---|---|---|---|
| Daily on-schedule | daily, on_schedule | 2026-05-18 | 2026-05-19 (late) | 2026-05-19 |
| Daily on-schedule completed early | daily, on_schedule | 2026-05-18 | 2026-05-17 | 2026-05-19 |
| Daily after-completion | daily, after_completion | 2026-05-18 | 2026-05-19 | 2026-05-20 |
| Every 3 days on-schedule | every_n_days, n=3, on_schedule | 2026-05-18 | 2026-05-20 | 2026-05-21 |
| Every 3 days after-completion | every_n_days, n=3, after_completion | 2026-05-18 | 2026-05-20 | 2026-05-23 |
| Weekly Mon/Wed/Fri, complete on Mon | weekly, {mon,wed,fri}, on_schedule | 2026-05-18 (Mon) | 2026-05-18 | 2026-05-20 (Wed) |
| Weekly Mon/Wed/Fri, complete late after Wed | weekly, {mon,wed,fri}, on_schedule | 2026-05-18 (Mon) | 2026-05-22 (Fri) | 2026-05-20 (Wed) — next sched after prev due, regardless of completion |
| Monthly day 31 → Feb | monthly, day_of_month=31, on_schedule | 2026-01-31 | 2026-01-31 | 2026-02-28 |
| Monthly day 31 → April | monthly, day_of_month=31, on_schedule | 2026-03-31 | 2026-03-31 | 2026-04-30 |
| Monthly day 31 → Feb leap | monthly, day_of_month=31, on_schedule | 2028-01-31 | 2028-01-31 | 2028-02-29 |
| Yearly Feb 29 | yearly, month=2, day=29, on_schedule | 2028-02-29 | 2028-02-29 | 2029-02-28 |
| Multi-day with weekly recurrence | weekly, {sun}, on_schedule | due 2026-05-14 (Thu), start 2026-05-11 (Mon) | completed 2026-05-14 | due 2026-05-17 (Sun), start = next due - 3 = 2026-05-14 (Thu) |
| Overdue completion, on_schedule | weekly, {mon}, on_schedule | 2026-05-10 (Mon-prev) | 2026-05-14 (Thu, late) | 2026-05-17 (Mon, next) |
| Overdue completion, after_completion | weekly, {mon}, after_completion | 2026-05-10 | 2026-05-14 (Thu) | next Mon after 2026-05-14 = 2026-05-18 (but the rule is "Mondays" so the after_completion implementation looks for the next scheduled day after completion: 2026-05-18) |

The "after_completion + weekly" semantics: when anchor is `after_completion`, weekly rules still respect the weekday set; we find the next allowed weekday strictly AFTER `completedAt`. (If `completedAt` is itself a Monday, the next instance is the next allowed weekday, which may be Wed or next Mon depending on the rule.)

### 6.5 Recurring completion as an atomic op

The endpoint `POST /api/items/:id/complete-recurring` (or the generic PATCH with status: 'done' on a recurring item — server detects it) does:

```
Within a single mutex.acquire():
  1. Read source item from index.
  2. Snapshot its recurrence rule (now part of the completed instance's history).
  3. Compute next-instance fields via nextDueDate().
  4. Build new Item:
     - id: ULID
     - same project_id, parent_id, type, title, notes (latest), priority, tags, status=todo,
     - new due_date, new start_date (preserving multi-day span),
     - recurrence: <SAME RULE>,
     - sort_order: parent's child max + 1024
  5. Mutate source item:
     - status: 'done', completed_at: now(),
     - keep recurrence rule for history (so the Completed view shows it's a recurring instance).
  6. Atomic-write source file (already in items/, stays).
  7. Atomic-write new file (new entry in items/).
  8. Update in-memory index for both.
  9. Emit SSE 'item.changed' for source, 'item.created' for new.
Return { completed: <updated source>, next: <new item> }.
```

If step 7 fails (disk write), step 6 is reverted in memory and on disk by re-reading the source file. The user sees a snackbar; nothing in the index is half-updated.

### 6.6 Un-checking a completed recurring instance

Per product spec §9.4 #5: un-check reopens **only that instance**. The next instance is NOT deleted. The user manually deletes the duplicate from the project view if they no longer want it.

Implementation: PATCH that source item's status to 'todo', clear `completed_at`. Do not touch the next instance.

---

## 7. Config

```ts
export const ThemeSchema = z.enum(['light', 'dark', 'system']);
export const WeekStartSchema = z.enum(['sun', 'mon']);

export const ConfigSchema = z.object({
  schema_version: z.literal(1),
  theme: ThemeSchema.default('system'),
  week_start: WeekStartSchema.default('mon'),
  last_modified: z.string().datetime(),
});

export type Config = z.infer<typeof ConfigSchema>;

export const ConfigPatchSchema = ConfigSchema
  .omit({ schema_version: true, last_modified: true })
  .partial();
```

File: `config.json` at the root of the data directory.

There is no `default_project` field (locked decision §9.4 #8).

---

## 8. File layout on disk

```
<data-dir>/
  config.json
  folders/
    01HM3Z...json
    01HM5K...json
  projects/
    00000000000000000000INBOX0.json    # The sentinel Inbox
    01HM4A...json                       # User-created project
    ...
  items/
    01HM5T...json                       # All active items (Epics, Features, Tasks)
    ...                                  # Subtasks are NOT here — inlined in their parent Item
  tags/
    01HM2P...json
    ...
  trash/
    01HM5T...json                       # Items moved here on soft-delete
    ...
```

Notes:
- All directories created on `--init`.
- Each entity gets exactly one file. No nested directories within `items/` for v1. (We may shard `items/` by ULID prefix in v1.1 if directory listing grows unwieldy. The flat layout works up to ~5k items per directory on macOS/Linux without ergonomic issues; Windows starts grumbling around 10k.)
- File contents are JSON, 2-space indented, newline-terminated. The 2-space indent matters for git-diff readability.

### 8.1 Backup story

The data directory is git-friendly. The user backs up Tasko by `git push`-ing their data repo to GitHub (private) or to a remote of their choice. Out of scope for Tasko itself.

### 8.2 Migration strategy (none in v1)

Each entity has `schema_version: 1`. The indexer's parse step:
1. Parse the JSON.
2. If `schema_version` is missing → assume v1 (compat for any pre-release file the user has).
3. If `schema_version` is 1 → validate via the v1 zod schema.
4. If `schema_version` > 1 → log a warning, skip the file. (Forward-compat: a future-version file shouldn't crash the server.)

v1.1+ migrations:
- A `tasko migrate` CLI command reads every file, applies version-N → version-(N+1) transforms, atomically writes the result.
- We commit to forward-only migrations: an old client cannot read a new file unless the new file's schema_version is also 1 (= back-compat). The migration step is intentionally explicit; we never silently mutate files during a normal read.

---

## 9. In-memory index

The server maintains:

```ts
type Index = {
  items: Map<ItemId, Item>;          // active items only (those in items/, not trash/)
  trash: Map<ItemId, Item>;          // items in trash/
  projects: Map<ProjectId, Project>;
  folders: Map<FolderId, Folder>;
  tags: Map<TagId, Tag>;
  tagsByLower: Map<string, TagId>;   // for autocomplete + duplicate detection
  config: Config;
  childrenOf: Map<ItemId | ProjectId, ItemId[]>;  // adjacency cache, rebuilt on mutation
  itemsByProject: Map<ProjectId, ItemId[]>;       // grouped cache
  itemsByTag: Map<TagId, ItemId[]>;
};
```

Rebuilt on boot by reading every file in `items/`, `trash/`, `projects/`, `folders/`, `tags/`, and `config.json`. Time budget: < 1.5s for 10k items. Mutation-time updates keep the adjacency caches consistent.

Mutex (`p-queue` size 1 keyed on the global "writer"): every write goes through it. Two writes never race; SSE events are emitted from inside the locked region after the disk-write completes successfully.

---

## 10. Counter-examples — what we do NOT store

To clarify the boundary:

| Not stored | Reason |
|---|---|
| Username, account info | No accounts. |
| Sync credentials, PATs | No sync. |
| Server-side undo journals | Frontend in-memory only. |
| Per-occurrence titles for recurring tasks | Per spec §7.17 — the rule lives on the current instance, edits propagate to the next instance. |
| Activity log / audit trail | Post-v1 (per spec §5.2). |
| Search index | Post-v1. |
| Tag-to-item join table | Items hold a tags array. We don't need a separate join file. |
| Computed roll-up progress | Display-only; computed on the frontend from the children count. |
| Saved filters | Filters are session-only per spec §5.1, derived from URL search params. |

---

## 11. Quick reference: end-to-end mutation flow

User clicks checkbox on a Task in the Today view:

```
Frontend                              Server                              Disk
--------                              ------                              ----
useOptimisticMutation                                    
  onMutate:
    queryClient.setQueryData(         
      itemKeys.detail(id),
      { ...prior, status: 'done', completed_at: now }
    )
    undoStore.push({ ... })
                                      
  → PATCH /api/items/:id              
    Body: { status: 'done' }          
                                      Fastify route handler
                                      → zod-validate body (ItemPatchSchema)
                                      → mutex.acquire()
                                      → Read source from index
                                      → Detect recurrence:
                                        - if recurrence != null:
                                          - compute next-instance
                                          - mutate source
                                          - build new instance
                                          - atomic-write source → items/<id>.json
                                          - atomic-write new → items/<newid>.json
                                          - update index
                                          - broker.publish('item.changed', source)
                                          - broker.publish('item.created', new)
                                        - else:
                                          - mutate source
                                          - atomic-write source
                                          - update index
                                          - broker.publish('item.changed', source)
                                      → mutex.release()
                                      ← 200 { completed: source, next?: new }
                                      
  onSuccess:                          
    replace cache with server data    
    if `next` present:                
      add to cache; show snackbar     
      "Task completed. Next: <date>." 
    else:                             
      show snackbar                   
      "Task completed. Undo."         
                                      
                                      
Other tabs (if any):                  
  EventSource onmessage(              
    {type: 'item.changed', source: 'other-tab'}
  )                                   
  → invalidate(itemKeys.detail(id))   
  → invalidate(itemKeys.lists())      
                                      
  EventSource onmessage(              
    {type: 'item.created', source: 'other-tab'}
  )                                   
  → invalidate(itemKeys.lists())      
```

Net: optimistic, atomic, multi-tab safe, recurrence-aware, undoable within 5s.
