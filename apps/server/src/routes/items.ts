import {
  INBOX_PROJECT_ID,
  IsoUtcSchema,
  type Item,
  type ItemId,
  ItemIdSchema,
  ItemTypeSchema,
  LocalDateSchema,
  LocalTimeSchema,
  PrioritySchema,
  type ProjectId,
  RecurrenceRuleSchema,
  StatusSchema,
  SubtaskCreateSchema,
  SubtaskIdSchema,
  SubtaskPatchSchema,
  SubtaskSchema,
  type TagId,
  TagIdSchema,
} from '@tasko/types';
import type { FastifyInstance } from 'fastify';
import { ulid } from 'ulid';
import { z } from 'zod';
import { HttpError } from '../middleware/error-envelope.js';

// Route-level schemas with relaxed project_id and parent_id to accept the Inbox sentinel
// ('00000000000000000000INBOX0' contains I and O which are outside the ULID alphabet).
// The strict ProjectIdSchema is used only for newly-generated IDs; these relaxed versions
// accept any string so the route layer can validate existence against the index map.
const AnyProjectId = z.string().brand<'ProjectId'>();
const AnyItemId = z.string().brand<'ItemId'>();
const AnyTagId = z.string().brand<'TagId'>();

const ItemCreateRouteSchema = z
  .object({
    type: ItemTypeSchema,
    project_id: AnyProjectId,
    parent_id: AnyItemId.nullable(),
    title: z.string().min(1).max(500),
    notes: z.string().max(50_000).default(''),
    due_date: LocalDateSchema,
    start_date: LocalDateSchema.nullable(),
    due_time: LocalTimeSchema.nullable(),
    priority: PrioritySchema.default('none'),
    status: StatusSchema.default('todo'),
    tags: z.array(AnyTagId).default([]),
    subtasks: z.array(SubtaskCreateSchema).optional(),
    recurrence: RecurrenceRuleSchema.nullable(),
    sort_order: z.number().int().optional(),
  })
  .refine((v) => v.start_date === null || v.due_date === null || v.start_date <= v.due_date, {
    message: 'start_date must be on or before due_date',
    path: ['start_date'],
  });

const ItemPatchRouteSchema = z
  .object({
    type: ItemTypeSchema.optional(),
    project_id: AnyProjectId.optional(),
    parent_id: AnyItemId.nullable().optional(),
    title: z.string().min(1).max(500).optional(),
    notes: z.string().max(50_000).optional(),
    due_date: LocalDateSchema.optional(),
    start_date: LocalDateSchema.nullable().optional(),
    due_time: LocalTimeSchema.nullable().optional(),
    priority: PrioritySchema.optional(),
    status: StatusSchema.optional(),
    tags: z.array(AnyTagId).optional(),
    subtasks: z.array(SubtaskSchema).optional(),
    recurrence: RecurrenceRuleSchema.nullable().optional(),
    completed_at: IsoUtcSchema.nullable().optional(),
    sort_order: z.number().int().optional(),
    updated_at: IsoUtcSchema.optional(),
  })
  .refine((v) => v.start_date == null || v.due_date == null || v.start_date <= v.due_date, {
    message: 'start_date must be on or before due_date',
    path: ['start_date'],
  });

// Inline todayLocal helper — task 11 builds the shared one in domain/time.ts
const todayLocal = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const addDaysLocal = (date: string, n: number): string => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

const ViewSchema = z.enum(['today', 'tomorrow', 'next7', 'inbox', 'all', 'completed', 'project', 'tag']);
const SortSchema = z.enum(['due_asc', 'priority_desc', 'title_asc', 'created_desc', 'completed_desc']);

const ItemListQuerySchema = z.object({
  view: ViewSchema.optional(),
  project_id: z.string().optional(),
  tag_id: z.string().optional(),
  parent_id: z.string().optional(),
  priority: z.union([z.string(), z.array(z.string())]).optional(),
  sort: SortSchema.optional(),
  include_completed: z.string().optional(),
});

const PRIORITY_ORDER: Record<string, number> = { high: 3, medium: 2, low: 1, none: 0 };

function sortItems(items: Item[], sort: z.infer<typeof SortSchema>): Item[] {
  const copy = [...items];
  switch (sort) {
    case 'due_asc':
      return copy.sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0));
    case 'priority_desc':
      return copy.sort((a, b) => (PRIORITY_ORDER[b.priority] ?? 0) - (PRIORITY_ORDER[a.priority] ?? 0));
    case 'title_asc':
      return copy.sort((a, b) => a.title.localeCompare(b.title));
    case 'created_desc':
      return copy.sort((a, b) => (a.created_at > b.created_at ? -1 : a.created_at < b.created_at ? 1 : 0));
    case 'completed_desc':
      return copy.sort((a, b) => {
        const ac = a.completed_at ?? '';
        const bc = b.completed_at ?? '';
        return ac > bc ? -1 : ac < bc ? 1 : 0;
      });
  }
}

export function registerItemRoutes(app: FastifyInstance): void {
  // GET /api/items
  app.get('/api/items', async (req, reply) => {
    const rawQuery = req.query as Record<string, unknown>;
    const qParsed = ItemListQuerySchema.safeParse(rawQuery);
    if (!qParsed.success) {
      throw new HttpError(400, 'VALIDATION', 'Invalid query parameters.', qParsed.error.issues);
    }
    const q = qParsed.data;

    const index = app.indexer.getIndex();
    const today = todayLocal();
    const tomorrow = addDaysLocal(today, 1);
    const today7 = addDaysLocal(today, 7);

    let items = [...index.items.values()];

    const view = q.view ?? 'all';

    switch (view) {
      case 'today':
        items = items.filter(
          (item) =>
            item.trashed_at === null &&
            item.status !== 'done' &&
            (item.due_date === today ||
              (item.start_date !== null && item.start_date <= today && today <= item.due_date) ||
              item.due_date < today),
        );
        break;
      case 'tomorrow':
        items = items.filter(
          (item) => item.trashed_at === null && item.status !== 'done' && item.due_date === tomorrow,
        );
        break;
      case 'next7':
        items = items.filter(
          (item) =>
            item.trashed_at === null &&
            item.status !== 'done' &&
            ((item.due_date >= today && item.due_date < today7) ||
              (item.start_date !== null &&
                item.start_date <= addDaysLocal(today, 6) &&
                item.due_date >= today)),
        );
        break;
      case 'inbox':
        items = items.filter(
          (item) =>
            item.trashed_at === null &&
            item.status !== 'done' &&
            item.project_id === INBOX_PROJECT_ID &&
            item.parent_id === null,
        );
        break;
      case 'all':
        items = items.filter((item) => item.trashed_at === null && item.status !== 'done');
        break;
      case 'completed':
        items = items.filter((item) => item.status === 'done' && item.trashed_at === null);
        break;
      case 'project': {
        if (!q.project_id) {
          throw new HttpError(400, 'VALIDATION', 'project_id is required for view=project.');
        }
        const projectId = AnyProjectId.safeParse(q.project_id);
        if (!projectId.success) {
          throw new HttpError(400, 'VALIDATION', 'Invalid project_id.');
        }
        const includeCompleted = q.include_completed === 'true';
        items = items.filter(
          (item) =>
            item.trashed_at === null &&
            item.project_id === projectId.data &&
            (includeCompleted || item.status !== 'done'),
        );
        if (q.parent_id !== undefined) {
          if (q.parent_id === 'root') {
            items = items.filter((item) => item.parent_id === null);
          } else {
            const parentId = ItemIdSchema.safeParse(q.parent_id);
            if (!parentId.success) {
              throw new HttpError(400, 'VALIDATION', 'Invalid parent_id.');
            }
            items = items.filter((item) => item.parent_id === parentId.data);
          }
        }
        break;
      }
      case 'tag': {
        if (!q.tag_id) {
          throw new HttpError(400, 'VALIDATION', 'tag_id is required for view=tag.');
        }
        const tagId = TagIdSchema.safeParse(q.tag_id);
        if (!tagId.success) {
          throw new HttpError(400, 'VALIDATION', 'Invalid tag_id.');
        }
        items = items.filter((item) => item.trashed_at === null && item.tags.includes(tagId.data));
        break;
      }
    }

    // Apply priority filter
    if (q.priority !== undefined) {
      const priorities = Array.isArray(q.priority) ? q.priority : [q.priority];
      items = items.filter((item) => priorities.includes(item.priority));
    }

    // Sort
    const sort = q.sort ?? (view === 'completed' ? 'completed_desc' : 'due_asc');
    items = sortItems(items, sort);

    return reply.send({ items, count: items.length });
  });

  // GET /api/items/:id
  app.get('/api/items/:id', async (req, reply) => {
    const params = req.params as Record<string, unknown>;
    const idParsed = ItemIdSchema.safeParse(params.id);
    if (!idParsed.success) {
      throw new HttpError(400, 'VALIDATION', 'Invalid item id.');
    }
    const id = idParsed.data;
    const index = app.indexer.getIndex();
    const item = index.items.get(id);
    if (!item) {
      throw new HttpError(404, 'ITEM_NOT_FOUND', 'Item not found.');
    }
    return reply.send(item);
  });

  // POST /api/items
  app.post('/api/items', async (req, reply) => {
    const body = ItemCreateRouteSchema.parse(req.body);

    if (body.type === ('subtask' as string)) {
      throw new HttpError(400, 'VALIDATION', 'Use POST /api/items/:id/subtasks to add subtasks.');
    }

    const tabId = (req.headers['x-tasko-tab-id'] as string | undefined) ?? null;

    const newItem = await app.indexer.withWriteLock(async (index, ops) => {
      // Validate project_id exists
      if (!index.projects.has(body.project_id as ProjectId)) {
        throw new HttpError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
      }

      // Validate parent_id
      if (body.parent_id !== null && body.parent_id !== undefined) {
        const parent = index.items.get(body.parent_id as ItemId);
        if (!parent || parent.trashed_at !== null) {
          throw new HttpError(404, 'PARENT_NOT_FOUND', 'Parent item not found.');
        }
        if (parent.project_id !== body.project_id) {
          throw new HttpError(400, 'VALIDATION', 'Parent item is in a different project.');
        }
        // TODO(task-09): depth-cap check via canMove(...)
      }

      // Validate tags exist
      for (const tagId of body.tags ?? []) {
        if (!index.tags.has(tagId as TagId)) {
          throw new HttpError(400, 'TAG_NOT_FOUND', `Tag not found: ${tagId}`);
        }
      }

      // Compute sort_order if not provided
      let sortOrder = body.sort_order;
      if (sortOrder === undefined) {
        const siblings = [...index.items.values()].filter(
          (i) =>
            i.project_id === body.project_id &&
            i.parent_id === (body.parent_id ?? null) &&
            i.trashed_at === null,
        );
        const maxOrder = siblings.reduce((max, i) => Math.max(max, i.sort_order), 0);
        sortOrder = maxOrder + 1024;
      }

      const now = new Date().toISOString();
      const item: Item = {
        id: ItemIdSchema.parse(ulid()),
        schema_version: 1,
        type: body.type,
        project_id: body.project_id,
        parent_id: body.parent_id ?? null,
        title: body.title.trimEnd(),
        notes: body.notes ?? '',
        due_date: body.due_date,
        start_date: body.start_date ?? null,
        due_time: body.due_time ?? null,
        priority: body.priority ?? 'none',
        status: body.status ?? 'todo',
        tags: body.tags ?? [],
        subtasks: (body.subtasks ?? []).map((st, idx) => {
          const stStatus: 'todo' | 'done' = st.status ?? 'todo';
          const stOrder: number = st.sort_order ?? (idx + 1) * 1024;
          return {
            id: SubtaskIdSchema.parse(ulid()),
            title: st.title,
            status: stStatus,
            completed_at: null,
            sort_order: stOrder,
            created_at: now,
            updated_at: now,
          };
        }),
        recurrence: body.recurrence ?? null,
        completed_at: null,
        trashed_at: null,
        trashed_with: null,
        sort_order: sortOrder,
        created_at: now,
        updated_at: now,
      };

      await ops.writeItem(item);

      app.broker.publish({ type: 'item.created', payload: { id: item.id, item }, tabId });

      return item;
    });

    return reply.code(201).send(newItem);
  });

  // PATCH /api/items/:id
  app.patch('/api/items/:id', async (req, reply) => {
    const params = req.params as Record<string, unknown>;
    const idParsed = ItemIdSchema.safeParse(params.id);
    if (!idParsed.success) {
      throw new HttpError(400, 'VALIDATION', 'Invalid item id.');
    }
    const id = idParsed.data;
    const patch = ItemPatchRouteSchema.parse(req.body);

    // Reject trashed_at / trashed_with modifications
    const rawBody = req.body as Record<string, unknown>;
    if ('trashed_at' in rawBody || 'trashed_with' in rawBody) {
      throw new HttpError(400, 'VALIDATION', 'Use trash endpoints to modify trash state.');
    }

    const tabId = (req.headers['x-tasko-tab-id'] as string | undefined) ?? null;

    const merged = await app.indexer.withWriteLock(async (index, ops) => {
      const source = index.items.get(id);
      if (!source) {
        if (index.trash.has(id)) {
          throw new HttpError(400, 'VALIDATION', 'Item is in trash; restore first.');
        }
        throw new HttpError(404, 'ITEM_NOT_FOUND', 'Item not found.');
      }

      // Validate parent_id change
      if (patch.parent_id !== undefined) {
        if (patch.parent_id !== null) {
          const parent = index.items.get(patch.parent_id as ItemId);
          if (!parent || parent.trashed_at !== null) {
            throw new HttpError(404, 'PARENT_NOT_FOUND', 'Parent item not found.');
          }
          const effectiveProjectId = (patch.project_id ?? source.project_id) as ProjectId;
          if (parent.project_id !== effectiveProjectId) {
            throw new HttpError(400, 'VALIDATION', 'Parent item is in a different project.');
          }
          // TODO(task-09): depth-cap check via canMove(...)
        }
      }

      // Validate tags
      if (patch.tags !== undefined) {
        for (const tagId of patch.tags) {
          if (!index.tags.has(tagId as TagId)) {
            throw new HttpError(400, 'TAG_NOT_FOUND', `Tag not found: ${tagId}`);
          }
        }
      }

      const now = new Date().toISOString();

      // Handle completed_at stamping
      let completedAt = source.completed_at;
      if (patch.status !== undefined) {
        if (patch.status === 'done' && source.status !== 'done') {
          completedAt = now;
          // TODO(task-11): if source.recurrence != null AND transitioning to done, run atomic complete-recurring op and return { completed, next }
        } else if (patch.status !== 'done' && source.status === 'done') {
          completedAt = null;
        }
      }

      const item: Item = {
        id: source.id,
        schema_version: source.schema_version,
        type: patch.type ?? source.type,
        project_id: patch.project_id ?? source.project_id,
        parent_id: patch.parent_id !== undefined ? patch.parent_id : source.parent_id,
        title: patch.title ?? source.title,
        notes: patch.notes ?? source.notes,
        due_date: patch.due_date ?? source.due_date,
        start_date: patch.start_date !== undefined ? patch.start_date : source.start_date,
        due_time: patch.due_time !== undefined ? patch.due_time : source.due_time,
        priority: patch.priority ?? source.priority,
        status: patch.status ?? source.status,
        tags: patch.tags ?? source.tags,
        subtasks: patch.subtasks ?? source.subtasks,
        recurrence: patch.recurrence !== undefined ? patch.recurrence : source.recurrence,
        completed_at: completedAt,
        trashed_at: source.trashed_at,
        trashed_with: source.trashed_with,
        sort_order: patch.sort_order ?? source.sort_order,
        created_at: source.created_at,
        updated_at: now,
      };

      // Handle cross-project move cascade
      if (patch.project_id !== undefined && patch.project_id !== source.project_id) {
        const newProjectId = patch.project_id as ProjectId;

        // Validate new project exists
        if (!index.projects.has(newProjectId)) {
          throw new HttpError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
        }

        // Recursively cascade project_id to descendants
        const toUpdate: Item[] = [item];
        const queue: ItemId[] = [source.id];
        while (queue.length > 0) {
          const parentId = queue.shift();
          if (parentId === undefined) break;
          const children = index.childrenOfItem.get(parentId);
          if (children) {
            for (const childId of children) {
              const child = index.items.get(childId);
              if (child) {
                const updatedChild: Item = { ...child, project_id: newProjectId, updated_at: now };
                toUpdate.push(updatedChild);
                queue.push(childId);
              }
            }
          }
        }

        for (const updatedItem of toUpdate) {
          await ops.writeItem(updatedItem);
        }

        app.broker.publish({ type: 'item.changed', payload: { id: item.id, item }, tabId });
        return item;
      }

      await ops.writeItem(item);
      app.broker.publish({ type: 'item.changed', payload: { id: item.id, item }, tabId });

      return item;
    });

    return reply.send(merged);
  });

  // DELETE /api/items/:id — stub (task-12)
  app.delete('/api/items/:id', async (_req, _reply) => {
    throw new HttpError(501, 'INTERNAL', 'Soft-delete not yet implemented (task-12).');
  });

  // POST /api/items/:id/restore — stub (task-12)
  app.post('/api/items/:id/restore', async (_req, _reply) => {
    throw new HttpError(501, 'INTERNAL', 'Restore not yet implemented (task-12).');
  });

  // POST /api/trash/empty — stub (task-12)
  app.post('/api/trash/empty', async (_req, _reply) => {
    throw new HttpError(501, 'INTERNAL', 'Trash flow not yet implemented (task-12).');
  });

  // POST /api/items/:id/move
  app.post('/api/items/:id/move', async (req, reply) => {
    const params = req.params as Record<string, unknown>;
    const idParsed = ItemIdSchema.safeParse(params.id);
    if (!idParsed.success) {
      throw new HttpError(400, 'VALIDATION', 'Invalid item id.');
    }
    const id = idParsed.data;

    const MoveBodySchema = z.object({
      new_parent_id: AnyItemId.nullable().optional(),
      new_project_id: AnyProjectId.nullable().optional(),
    });
    const moveBody = MoveBodySchema.parse(req.body);

    const patch: z.infer<typeof ItemPatchRouteSchema> = {};
    if (moveBody.new_parent_id !== undefined) {
      patch.parent_id = moveBody.new_parent_id;
    }
    if (moveBody.new_project_id !== undefined) {
      patch.project_id = moveBody.new_project_id ?? undefined;
    }

    const tabId = (req.headers['x-tasko-tab-id'] as string | undefined) ?? null;

    const merged = await app.indexer.withWriteLock(async (index, ops) => {
      const source = index.items.get(id);
      if (!source) {
        if (index.trash.has(id)) {
          throw new HttpError(400, 'VALIDATION', 'Item is in trash; restore first.');
        }
        throw new HttpError(404, 'ITEM_NOT_FOUND', 'Item not found.');
      }

      // Validate parent_id change
      if (patch.parent_id !== undefined && patch.parent_id !== null) {
        const parent = index.items.get(patch.parent_id as ItemId);
        if (!parent || parent.trashed_at !== null) {
          throw new HttpError(404, 'PARENT_NOT_FOUND', 'Parent item not found.');
        }
        const effectiveProjectId = (patch.project_id ?? source.project_id) as ProjectId;
        if (parent.project_id !== effectiveProjectId) {
          throw new HttpError(400, 'VALIDATION', 'Parent item is in a different project.');
        }
        // TODO(task-09): depth-cap check via canMove(...)
      }

      const now = new Date().toISOString();

      const item: Item = {
        id: source.id,
        schema_version: source.schema_version,
        type: patch.type ?? source.type,
        project_id: patch.project_id ?? source.project_id,
        parent_id: patch.parent_id !== undefined ? patch.parent_id : source.parent_id,
        title: patch.title ?? source.title,
        notes: patch.notes ?? source.notes,
        due_date: patch.due_date ?? source.due_date,
        start_date: patch.start_date !== undefined ? patch.start_date : source.start_date,
        due_time: patch.due_time !== undefined ? patch.due_time : source.due_time,
        priority: patch.priority ?? source.priority,
        status: patch.status ?? source.status,
        tags: patch.tags ?? source.tags,
        subtasks: patch.subtasks ?? source.subtasks,
        recurrence: patch.recurrence !== undefined ? patch.recurrence : source.recurrence,
        completed_at: source.completed_at,
        trashed_at: source.trashed_at,
        trashed_with: source.trashed_with,
        sort_order: patch.sort_order ?? source.sort_order,
        created_at: source.created_at,
        updated_at: now,
      };

      // Handle cross-project move cascade
      if (patch.project_id !== undefined && patch.project_id !== source.project_id) {
        const newProjectId = patch.project_id as ProjectId;
        if (!index.projects.has(newProjectId)) {
          throw new HttpError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
        }

        const toUpdate: Item[] = [item];
        const queue: ItemId[] = [source.id];
        while (queue.length > 0) {
          const parentId = queue.shift();
          if (parentId === undefined) break;
          const children = index.childrenOfItem.get(parentId);
          if (children) {
            for (const childId of children) {
              const child = index.items.get(childId);
              if (child) {
                const updatedChild: Item = { ...child, project_id: newProjectId, updated_at: now };
                toUpdate.push(updatedChild);
                queue.push(childId);
              }
            }
          }
        }

        for (const updatedItem of toUpdate) {
          await ops.writeItem(updatedItem);
        }

        app.broker.publish({ type: 'item.changed', payload: { id: item.id, item }, tabId });
        return item;
      }

      await ops.writeItem(item);
      app.broker.publish({ type: 'item.changed', payload: { id: item.id, item }, tabId });
      return item;
    });

    return reply.send(merged);
  });

  // POST /api/items/:id/subtasks
  app.post('/api/items/:id/subtasks', async (req, reply) => {
    const params = req.params as Record<string, unknown>;
    const idParsed = ItemIdSchema.safeParse(params.id);
    if (!idParsed.success) {
      throw new HttpError(400, 'VALIDATION', 'Invalid item id.');
    }
    const id = idParsed.data;
    const body = SubtaskCreateSchema.parse(req.body);

    const tabId = (req.headers['x-tasko-tab-id'] as string | undefined) ?? null;

    const parent = await app.indexer.withWriteLock(async (index, ops) => {
      const source = index.items.get(id);
      if (!source) {
        throw new HttpError(404, 'ITEM_NOT_FOUND', 'Item not found.');
      }
      if (source.type !== 'task') {
        throw new HttpError(422, 'VALIDATION', 'Subtasks attach only to Tasks.');
      }
      if (source.trashed_at !== null) {
        throw new HttpError(400, 'VALIDATION', 'Item is in trash.');
      }

      const now = new Date().toISOString();
      const maxOrder = source.subtasks.reduce((max, st) => Math.max(max, st.sort_order), 0);
      const sortOrder = body.sort_order ?? maxOrder + 1024;

      const newSubtask = {
        id: SubtaskIdSchema.parse(ulid()),
        title: body.title,
        status: body.status ?? ('todo' as const),
        completed_at: null,
        sort_order: sortOrder,
        created_at: now,
        updated_at: now,
      };

      const updatedItem: Item = {
        id: source.id,
        schema_version: source.schema_version,
        type: source.type,
        project_id: source.project_id,
        parent_id: source.parent_id,
        title: source.title,
        notes: source.notes,
        due_date: source.due_date,
        start_date: source.start_date,
        due_time: source.due_time,
        priority: source.priority,
        status: source.status,
        tags: source.tags,
        subtasks: [...source.subtasks, newSubtask],
        recurrence: source.recurrence,
        completed_at: source.completed_at,
        trashed_at: source.trashed_at,
        trashed_with: source.trashed_with,
        sort_order: source.sort_order,
        created_at: source.created_at,
        updated_at: now,
      };

      await ops.writeItem(updatedItem);
      app.broker.publish({ type: 'item.changed', payload: { id: updatedItem.id, item: updatedItem }, tabId });

      return updatedItem;
    });

    return reply.code(201).send(parent);
  });

  // PATCH /api/items/:id/subtasks/:sid
  app.patch('/api/items/:id/subtasks/:sid', async (req, reply) => {
    const params = req.params as Record<string, unknown>;
    const idParsed = ItemIdSchema.safeParse(params.id);
    const sidParsed = SubtaskIdSchema.safeParse(params.sid);
    if (!idParsed.success) {
      throw new HttpError(400, 'VALIDATION', 'Invalid item id.');
    }
    if (!sidParsed.success) {
      throw new HttpError(400, 'VALIDATION', 'Invalid subtask id.');
    }
    const id = idParsed.data;
    const sid = sidParsed.data;
    const patch = SubtaskPatchSchema.parse(req.body);

    const tabId = (req.headers['x-tasko-tab-id'] as string | undefined) ?? null;

    const parent = await app.indexer.withWriteLock(async (index, ops) => {
      const source = index.items.get(id);
      if (!source) {
        throw new HttpError(404, 'ITEM_NOT_FOUND', 'Item not found.');
      }

      const stIdx = source.subtasks.findIndex((st) => st.id === sid);
      if (stIdx === -1) {
        throw new HttpError(404, 'ITEM_NOT_FOUND', 'Subtask not found.');
      }

      const now = new Date().toISOString();
      const existing = source.subtasks[stIdx];
      if (!existing) {
        throw new HttpError(404, 'ITEM_NOT_FOUND', 'Subtask not found.');
      }

      let completedAt = existing.completed_at;
      if (patch.status !== undefined) {
        if (patch.status === 'done' && existing.status !== 'done') {
          completedAt = now;
        } else if (patch.status !== 'done' && existing.status === 'done') {
          completedAt = null;
        }
      }

      const stStatus: 'todo' | 'done' = patch.status ?? existing.status;
      const updatedSubtask = {
        id: existing.id,
        title: patch.title ?? existing.title,
        status: stStatus,
        completed_at: completedAt,
        sort_order: patch.sort_order ?? existing.sort_order,
        created_at: existing.created_at,
        updated_at: now,
      };

      const updatedItem: Item = {
        id: source.id,
        schema_version: source.schema_version,
        type: source.type,
        project_id: source.project_id,
        parent_id: source.parent_id,
        title: source.title,
        notes: source.notes,
        due_date: source.due_date,
        start_date: source.start_date,
        due_time: source.due_time,
        priority: source.priority,
        status: source.status,
        tags: source.tags,
        subtasks: [...source.subtasks.slice(0, stIdx), updatedSubtask, ...source.subtasks.slice(stIdx + 1)],
        recurrence: source.recurrence,
        completed_at: source.completed_at,
        trashed_at: source.trashed_at,
        trashed_with: source.trashed_with,
        sort_order: source.sort_order,
        created_at: source.created_at,
        updated_at: now,
      };

      await ops.writeItem(updatedItem);
      app.broker.publish({ type: 'item.changed', payload: { id: updatedItem.id, item: updatedItem }, tabId });

      return updatedItem;
    });

    return reply.send(parent);
  });

  // DELETE /api/items/:id/subtasks/:sid
  app.delete('/api/items/:id/subtasks/:sid', async (req, reply) => {
    const params = req.params as Record<string, unknown>;
    const idParsed = ItemIdSchema.safeParse(params.id);
    const sidParsed = SubtaskIdSchema.safeParse(params.sid);
    if (!idParsed.success) {
      throw new HttpError(400, 'VALIDATION', 'Invalid item id.');
    }
    if (!sidParsed.success) {
      throw new HttpError(400, 'VALIDATION', 'Invalid subtask id.');
    }
    const id = idParsed.data;
    const sid = sidParsed.data;

    const tabId = (req.headers['x-tasko-tab-id'] as string | undefined) ?? null;

    const parent = await app.indexer.withWriteLock(async (index, ops) => {
      const source = index.items.get(id);
      if (!source) {
        throw new HttpError(404, 'ITEM_NOT_FOUND', 'Item not found.');
      }

      const stIdx = source.subtasks.findIndex((st) => st.id === sid);
      if (stIdx === -1) {
        throw new HttpError(404, 'ITEM_NOT_FOUND', 'Subtask not found.');
      }

      const now = new Date().toISOString();
      const updatedItem: Item = {
        id: source.id,
        schema_version: source.schema_version,
        type: source.type,
        project_id: source.project_id,
        parent_id: source.parent_id,
        title: source.title,
        notes: source.notes,
        due_date: source.due_date,
        start_date: source.start_date,
        due_time: source.due_time,
        priority: source.priority,
        status: source.status,
        tags: source.tags,
        subtasks: source.subtasks.filter((st) => st.id !== sid),
        recurrence: source.recurrence,
        completed_at: source.completed_at,
        trashed_at: source.trashed_at,
        trashed_with: source.trashed_with,
        sort_order: source.sort_order,
        created_at: source.created_at,
        updated_at: now,
      };

      await ops.writeItem(updatedItem);
      app.broker.publish({ type: 'item.changed', payload: { id: updatedItem.id, item: updatedItem }, tabId });

      return updatedItem;
    });

    return reply.send(parent);
  });
}
