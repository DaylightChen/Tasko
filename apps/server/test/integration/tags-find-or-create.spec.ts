import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';

describe('Tags find-or-create', () => {
  let dataDir: string;
  let server: FastifyInstance;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'tasko-tags-'));
    server = await buildServer({
      dataDir,
      port: 0,
      host: '127.0.0.1',
      initIfMissing: true,
      logLevel: 'fatal',
    });
  });

  afterEach(async () => {
    await server.close();
    await rm(dataDir, { recursive: true });
  });

  it('POST creates a new tag and returns 201', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/tags',
      payload: { name: 'urgent' },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as { id: string; name: string; name_lower: string };
    expect(body.name).toBe('urgent');
    expect(body.name_lower).toBe('urgent');
    expect(typeof body.id).toBe('string');
  });

  it('POST with same name returns 200 (existing tag)', async () => {
    const first = await server.inject({
      method: 'POST',
      url: '/api/tags',
      payload: { name: 'urgent' },
    });
    const created = JSON.parse(first.body) as { id: string };

    const second = await server.inject({
      method: 'POST',
      url: '/api/tags',
      payload: { name: 'urgent' },
    });
    expect(second.statusCode).toBe(200);
    const existing = JSON.parse(second.body) as { id: string };
    expect(existing.id).toBe(created.id);
  });

  it('POST with leading # strips the hash and deduplicates case-insensitively', async () => {
    const first = await server.inject({
      method: 'POST',
      url: '/api/tags',
      payload: { name: 'urgent' },
    });
    const created = JSON.parse(first.body) as { id: string };

    const second = await server.inject({
      method: 'POST',
      url: '/api/tags',
      payload: { name: '#URGENT' },
    });
    expect(second.statusCode).toBe(200);
    const existing = JSON.parse(second.body) as { id: string };
    expect(existing.id).toBe(created.id);
  });

  it('POST with different casing deduplicates', async () => {
    const first = await server.inject({
      method: 'POST',
      url: '/api/tags',
      payload: { name: 'Urgent' },
    });
    const created = JSON.parse(first.body) as { id: string; name: string };
    expect(created.name).toBe('Urgent');

    const second = await server.inject({
      method: 'POST',
      url: '/api/tags',
      payload: { name: 'urgent' },
    });
    expect(second.statusCode).toBe(200);
    const existing = JSON.parse(second.body) as { id: string };
    expect(existing.id).toBe(created.id);
  });

  it('GET /api/tags?prefix=urg returns matching tags', async () => {
    // Create a tag and an item to make it non-orphan
    const tagRes = await server.inject({
      method: 'POST',
      url: '/api/tags',
      payload: { name: 'urgent' },
    });
    const tag = JSON.parse(tagRes.body) as { id: string };

    // Create item with this tag
    await server.inject({
      method: 'POST',
      url: '/api/items',
      payload: {
        type: 'task',
        project_id: '00000000000000000000INBOX0',
        parent_id: null,
        title: 'Tagged task',
        notes: '',
        due_date: '2026-05-18',
        start_date: null,
        due_time: null,
        priority: 'none',
        status: 'todo',
        tags: [tag.id],
        subtasks: [],
        recurrence: null,
      },
    });

    const res = await server.inject({ method: 'GET', url: '/api/tags?prefix=urg' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { tags: { id: string }[]; count: number };
    expect(body.tags.some((t) => t.id === tag.id)).toBe(true);
  });

  it('GET /api/tags/autocomplete?q=urg returns matching tags including orphans', async () => {
    const tagRes = await server.inject({
      method: 'POST',
      url: '/api/tags',
      payload: { name: 'urgent' },
    });
    const tag = JSON.parse(tagRes.body) as { id: string };

    const res = await server.inject({ method: 'GET', url: '/api/tags/autocomplete?q=urg' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { tags: { id: string }[] };
    expect(body.tags.some((t) => t.id === tag.id)).toBe(true);
  });

  it('GET /api/tags?include_orphans=false excludes tags not in any item', async () => {
    await server.inject({
      method: 'POST',
      url: '/api/tags',
      payload: { name: 'orphan-tag' },
    });

    const res = await server.inject({ method: 'GET', url: '/api/tags?include_orphans=false' });
    const body = JSON.parse(res.body) as { tags: { name: string }[] };
    expect(body.tags.some((t) => t.name === 'orphan-tag')).toBe(false);
  });

  it('DELETE /api/tags/:id returns 501', async () => {
    const tagRes = await server.inject({
      method: 'POST',
      url: '/api/tags',
      payload: { name: 'to-delete' },
    });
    const tag = JSON.parse(tagRes.body) as { id: string };

    const res = await server.inject({ method: 'DELETE', url: `/api/tags/${tag.id}` });
    expect(res.statusCode).toBe(501);
  });
});
