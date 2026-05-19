import type { Item, ItemId, ProjectId } from '@tasko/types';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { canMove } from '../domain/depth-cap.js';
import { descendantsOf } from '../domain/hierarchy.js';
import { addDays, daysBetween, todayLocal } from '../domain/time.js';
import { HttpError } from '../middleware/error-envelope.js';
import { completeWithMaybeRecurrence } from './items.js';

// Relaxed id schemas for body parsing (same pattern as items.ts)
const AnyProjectId = z.string().brand<'ProjectId'>();
const AnyItemId = z.string().brand<'ItemId'>();

export function registerBulkRoutes(app: FastifyInstance): void {
  // POST /api/bulk/move-overdue-to-today
  app.post('/api/bulk/move-overdue-to-today', async (req, reply) => {
    const tabId = (req.headers['x-tasko-tab-id'] as string | undefined) ?? null;

    const result = await app.indexer.withWriteLock(async (index, ops) => {
      const today = todayLocal();
      const overdue = [...index.items.values()].filter(
        (i) => i.trashed_at === null && i.status !== 'done' && i.due_date < today,
      );

      const now = new Date().toISOString();
      const movedIds: ItemId[] = [];

      for (const item of overdue) {
        let updated: Item;
        if (item.start_date !== null && item.start_date < item.due_date) {
          // Multi-day item: shift both dates so due_date = today AND span length preserved.
          const delta = daysBetween(item.due_date, today); // positive (today > due_date)
          const newStartDate = addDays(item.start_date, delta);
          updated = { ...item, due_date: today, start_date: newStartDate, updated_at: now };
        } else {
          // Single-day item: just set due_date = today
          updated = { ...item, due_date: today, updated_at: now };
        }
        await ops.writeItem(updated);
        app.broker.publish({ type: 'item.changed', payload: { id: updated.id, item: updated }, tabId });
        movedIds.push(updated.id);
      }

      return { moved_ids: movedIds, moved_count: movedIds.length, new_due_date: today };
    });

    return reply.send(result);
  });

  // POST /api/bulk/move-to-project
  app.post('/api/bulk/move-to-project', async (req, reply) => {
    const BulkMoveToProjectSchema = z.object({
      item_ids: z.array(AnyItemId).min(1),
      new_project_id: AnyProjectId,
      new_parent_id: AnyItemId.nullable().optional(),
    });
    const body = BulkMoveToProjectSchema.parse(req.body);
    const tabId = (req.headers['x-tasko-tab-id'] as string | undefined) ?? null;

    const result = await app.indexer.withWriteLock(async (index, ops) => {
      const newProjectId = body.new_project_id as ProjectId;

      if (!index.projects.has(newProjectId)) {
        throw new HttpError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
      }

      const newParentId = body.new_parent_id ?? null;
      let newParent: Item | null = null;
      if (newParentId !== null) {
        newParent = index.items.get(newParentId as ItemId) ?? null;
        if (!newParent) {
          throw new HttpError(404, 'PARENT_NOT_FOUND', 'New parent not found.');
        }
      }

      // Validate depth-cap for all items first (transactional — reject if any fails)
      const failures: Array<{ item_id: string; reason: string }> = [];
      for (const itemId of body.item_ids) {
        const item = index.items.get(itemId as ItemId);
        if (!item) continue;
        const check = canMove({ source: item, newParent, items: index.items });
        if (!check.ok) {
          failures.push({ item_id: itemId, reason: check.reason });
        }
      }
      if (failures.length > 0) {
        throw new HttpError(409, 'DEPTH_CAP', 'One or more items would exceed the nesting depth.', failures);
      }

      const now = new Date().toISOString();
      const movedItems: Item[] = [];

      for (const itemId of body.item_ids) {
        const item = index.items.get(itemId as ItemId);
        if (!item) continue;

        // Update item and all its descendants to new project
        const descendants = descendantsOf(item.id, index.items);
        const toUpdate: Item[] = [
          { ...item, project_id: newProjectId, parent_id: newParentId as ItemId | null, updated_at: now },
          ...descendants.map((d) => ({ ...d, project_id: newProjectId, updated_at: now })),
        ];
        for (const updated of toUpdate) {
          await ops.writeItem(updated);
          app.broker.publish({ type: 'item.changed', payload: { id: updated.id, item: updated }, tabId });
        }
        const first = toUpdate[0];
        if (first) movedItems.push(first);
      }

      return { moved_count: movedItems.length, items: movedItems };
    });

    return reply.send(result);
  });

  // POST /api/bulk/delete
  app.post('/api/bulk/delete', async (req, reply) => {
    const BulkDeleteSchema = z.object({
      item_ids: z.array(AnyItemId).min(1),
    });
    const body = BulkDeleteSchema.parse(req.body);
    const tabId = (req.headers['x-tasko-tab-id'] as string | undefined) ?? null;

    const result = await app.indexer.withWriteLock(async (index, ops) => {
      const trashedAt = new Date().toISOString();
      const allTrashed: Item[] = [];

      for (const itemId of body.item_ids) {
        const id = itemId as ItemId;
        const source = index.items.get(id);
        if (!source) continue; // skip already-trashed or missing items

        const descendants = descendantsOf(id, index.items).filter((i) => i.trashed_at === null);
        const cascade: Item[] = [source, ...descendants].map((i) => ({
          ...i,
          trashed_at: trashedAt,
          trashed_with: i.id === source.id ? null : source.id,
          updated_at: trashedAt,
        }));
        for (const item of cascade) {
          await ops.moveItemToTrash(item);
        }
        const first = cascade[0];
        if (first) {
          app.broker.publish({ type: 'item.trashed', payload: { id: source.id, item: first }, tabId });
        }
        allTrashed.push(...cascade);
      }

      return { trashed_count: allTrashed.length, items: allTrashed };
    });

    return reply.send(result);
  });

  // POST /api/bulk/complete
  app.post('/api/bulk/complete', async (req, reply) => {
    const BulkCompleteSchema = z.object({
      item_ids: z.array(AnyItemId).min(1),
    });
    const body = BulkCompleteSchema.parse(req.body);
    const tabId = (req.headers['x-tasko-tab-id'] as string | undefined) ?? null;

    const result = await app.indexer.withWriteLock(async (index, ops) => {
      const now = new Date();
      const nowIso = now.toISOString();

      const completedItems: Item[] = [];
      const newInstances: Item[] = [];

      for (const itemId of body.item_ids) {
        const id = itemId as ItemId;
        const source = index.items.get(id);
        if (!source) continue;

        if (source.recurrence !== null) {
          // Recurring completion: generates a new instance
          const { completed, next } = await completeWithMaybeRecurrence(source, ops, app.broker, tabId, now);
          completedItems.push(completed);
          newInstances.push(next);
        } else {
          // Non-recurring: just mark done
          const updated: Item = {
            ...source,
            status: 'done',
            completed_at: nowIso,
            updated_at: nowIso,
          };
          await ops.writeItem(updated);
          app.broker.publish({ type: 'item.changed', payload: { id: updated.id, item: updated }, tabId });
          completedItems.push(updated);
        }
      }

      return {
        completed_count: completedItems.length,
        new_instances: newInstances,
        items: completedItems,
      };
    });

    return reply.send(result);
  });
}
