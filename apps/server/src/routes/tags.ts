import { type Tag, TagCreateSchema, TagIdSchema } from '@tasko/types';
import type { FastifyInstance } from 'fastify';
import { ulid } from 'ulid';
import { z } from 'zod';
import { HttpError } from '../middleware/error-envelope.js';

const TagListQuerySchema = z.object({
  prefix: z.string().optional(),
  include_orphans: z.string().optional(),
});

export function registerTagRoutes(app: FastifyInstance): void {
  // GET /api/tags/autocomplete — must be registered before GET /api/tags/:id
  app.get('/api/tags/autocomplete', async (req, reply) => {
    const rawQuery = req.query as Record<string, unknown>;
    const q = z.object({ q: z.string().optional() }).parse(rawQuery);

    const index = app.indexer.getIndex();
    let tags = [...index.tags.values()];

    if (q.q) {
      const prefix = q.q.toLowerCase();
      tags = tags.filter((t) => t.name_lower.startsWith(prefix));
      tags = tags.slice(0, 50);
    }

    return reply.send({ tags, count: tags.length });
  });

  // GET /api/tags
  app.get('/api/tags', async (req, reply) => {
    const rawQuery = req.query as Record<string, unknown>;
    const qParsed = TagListQuerySchema.safeParse(rawQuery);
    if (!qParsed.success) {
      throw new HttpError(400, 'VALIDATION', 'Invalid query parameters.', qParsed.error.issues);
    }
    const q = qParsed.data;

    const index = app.indexer.getIndex();
    let tags = [...index.tags.values()];

    const includeOrphans = q.include_orphans === 'true';

    if (!includeOrphans) {
      tags = tags.filter((t) => {
        const itemSet = index.itemsByTag.get(t.id);
        return itemSet !== undefined && itemSet.size > 0;
      });
    }

    if (q.prefix !== undefined) {
      const prefix = q.prefix.toLowerCase();
      tags = tags.filter((t) => t.name_lower.startsWith(prefix));
      tags = tags.slice(0, 50);
    }

    return reply.send({ tags, count: tags.length });
  });

  // GET /api/tags/:id — registered after /autocomplete to avoid route conflict
  app.get('/api/tags/:id', async (req, reply) => {
    const params = req.params as Record<string, unknown>;
    const idParsed = TagIdSchema.safeParse(params.id);
    if (!idParsed.success) {
      throw new HttpError(400, 'VALIDATION', 'Invalid tag id.');
    }
    const index = app.indexer.getIndex();
    const tag = index.tags.get(idParsed.data);
    if (!tag) {
      throw new HttpError(404, 'TAG_NOT_FOUND', 'Tag not found.');
    }
    return reply.send(tag);
  });

  // POST /api/tags — find-or-create
  app.post('/api/tags', async (req, reply) => {
    const body = TagCreateSchema.parse(req.body);

    const tabId = (req.headers['x-tasko-tab-id'] as string | undefined) ?? null;

    // Strip leading # and compute name_lower
    const name = body.name.startsWith('#') ? body.name.slice(1) : body.name;
    const nameLower = name.toLowerCase().trim();

    if (nameLower.length < 1 || nameLower.length > 32) {
      throw new HttpError(400, 'VALIDATION', 'Tag name must be 1-32 characters after stripping leading #.');
    }

    // Check for existing tag (find step, before locking)
    const index = app.indexer.getIndex();
    const existingId = index.tagsByLower.get(nameLower);
    if (existingId !== undefined) {
      const existing = index.tags.get(existingId);
      if (existing) {
        return reply.code(200).send(existing);
      }
    }

    // Create new tag
    const newTag = await app.indexer.withWriteLock(async (index2, ops) => {
      // Double-check inside the lock
      const existingId2 = index2.tagsByLower.get(nameLower);
      if (existingId2 !== undefined) {
        const existing2 = index2.tags.get(existingId2);
        if (existing2) {
          return { tag: existing2, created: false };
        }
      }

      const now = new Date().toISOString();
      const tag: Tag = {
        id: TagIdSchema.parse(ulid()),
        schema_version: 1,
        name: name.trim(),
        name_lower: nameLower,
        color: null,
        created_at: now,
        updated_at: now,
      };

      await ops.writeTag(tag);
      app.broker.publish({ type: 'tag.created', payload: { id: tag.id, tag }, tabId });

      return { tag, created: true };
    });

    if (!newTag.created) {
      return reply.code(200).send(newTag.tag);
    }
    return reply.code(201).send(newTag.tag);
  });

  // DELETE /api/tags/:id — stub (post-v1)
  app.delete('/api/tags/:id', async (_req, _reply) => {
    throw new HttpError(501, 'INTERNAL', 'Tag deletion is post-v1.');
  });
}
