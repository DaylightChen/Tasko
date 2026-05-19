import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INBOX_PROJECT_ID } from '@tasko/types';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';

describe('Error envelope', () => {
  let dataDir: string;
  let server: FastifyInstance;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'tasko-envelope-'));
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

  it('PATCH non-existent item returns 404 with ITEM_NOT_FOUND error envelope', async () => {
    const res = await server.inject({
      method: 'PATCH',
      url: '/api/items/01HWABCDEFGHJKMNPQRSTVWXYZ',
      payload: { title: 'updated' },
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body) as { error: { code: string; message: string } };
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('ITEM_NOT_FOUND');
    expect(typeof body.error.message).toBe('string');
  });

  it('POST item with bad date returns 400 VALIDATION with details', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/items',
      payload: {
        type: 'task',
        project_id: INBOX_PROJECT_ID,
        parent_id: null,
        title: 'Bad date',
        notes: '',
        due_date: 'not-a-date',
        start_date: null,
        due_time: null,
        priority: 'none',
        status: 'todo',
        tags: [],
        subtasks: [],
        recurrence: null,
      },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { error: { code: string; details: unknown } };
    expect(body.error.code).toBe('VALIDATION');
    expect(body.error.details).toBeDefined();
    expect(Array.isArray(body.error.details)).toBe(true);
  });

  it('POST item with empty title returns 400 VALIDATION', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/items',
      payload: {
        type: 'task',
        project_id: INBOX_PROJECT_ID,
        parent_id: null,
        title: '',
        notes: '',
        due_date: '2026-05-18',
        start_date: null,
        due_time: null,
        priority: 'none',
        status: 'todo',
        tags: [],
        subtasks: [],
        recurrence: null,
      },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION');
  });

  it('404 handler for unknown route returns INTERNAL error envelope', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/nonexistent-route' });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body) as { error: { code: string } };
    expect(body.error.code).toBe('INTERNAL');
  });

  it('PATCH item with trashed_at in body returns 400 VALIDATION', async () => {
    // Create an item first
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/items',
      payload: {
        type: 'task',
        project_id: INBOX_PROJECT_ID,
        parent_id: null,
        title: 'My item',
        notes: '',
        due_date: '2026-05-18',
        start_date: null,
        due_time: null,
        priority: 'none',
        status: 'todo',
        tags: [],
        subtasks: [],
        recurrence: null,
      },
    });
    const created = JSON.parse(createRes.body) as { id: string };

    const res = await server.inject({
      method: 'PATCH',
      url: `/api/items/${created.id}`,
      payload: { trashed_at: '2026-01-01T00:00:00Z' },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION');
  });
});
