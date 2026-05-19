import { ItemIdSchema, ItemSchema } from '@tasko/types';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { HttpError } from '../middleware/error-envelope.js';

const TrashListQuerySchema = z.object({
  sort: z.enum(['trashed_desc', 'title_asc']).optional(),
  flat: z.string().optional(),
});

const TrashListResponseSchema = z.object({
  items: z.array(ItemSchema),
  count: z.number(),
});

export function registerTrashRoutes(app: FastifyInstance): void {
  // GET /api/trash — list trashed items
  app.get('/api/trash', async (req, reply) => {
    const qParsed = TrashListQuerySchema.safeParse(req.query as Record<string, unknown>);
    if (!qParsed.success) {
      throw new HttpError(400, 'VALIDATION', 'Invalid query parameters.', qParsed.error.issues);
    }
    const q = qParsed.data;
    const flat = q.flat === 'true';

    const index = app.indexer.getIndex();
    let items = [...index.trash.values()];

    // Default: only top-level trashed items (trashed_with === null). With ?flat=true, return all.
    if (!flat) {
      items = items.filter((i) => i.trashed_with === null);
    }

    const sort = q.sort ?? 'trashed_desc';
    switch (sort) {
      case 'trashed_desc':
        items.sort((a, b) => {
          const at = a.trashed_at ?? '';
          const bt = b.trashed_at ?? '';
          return bt > at ? 1 : bt < at ? -1 : 0;
        });
        break;
      case 'title_asc':
        items.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }

    const validated = TrashListResponseSchema.parse({ items, count: items.length });
    return reply.send(validated);
  });

  // GET /api/trash/:id — get one trashed item
  app.get('/api/trash/:id', async (req, reply) => {
    const params = req.params as Record<string, unknown>;
    const idParsed = ItemIdSchema.safeParse(params.id);
    if (!idParsed.success) {
      throw new HttpError(400, 'VALIDATION', 'Invalid item id.');
    }
    const id = idParsed.data;
    const index = app.indexer.getIndex();
    const item = index.trash.get(id);
    if (!item) {
      throw new HttpError(404, 'ITEM_NOT_FOUND', 'Item not found in trash.');
    }
    return reply.send(item);
  });

  // POST /api/trash/empty — permanently delete everything in trash
  app.post('/api/trash/empty', async (req, reply) => {
    const tabId = (req.headers['x-tasko-tab-id'] as string | undefined) ?? null;

    const result = await app.indexer.withWriteLock(async (index, ops) => {
      const allTrashed = [...index.trash.values()];
      const deletedCount = allTrashed.length;
      for (const item of allTrashed) {
        await ops.removeFromTrash(item.id);
      }
      app.broker.publish({ type: 'trash.emptied', payload: { count: deletedCount }, tabId });
      return { deleted_count: deletedCount };
    });

    return reply.send(result);
  });
}
