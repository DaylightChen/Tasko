import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INBOX_PROJECT_ID } from '@tasko/types';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';

describe('Items CRUD', () => {
  let dataDir: string;
  let server: FastifyInstance;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'tasko-items-crud-'));
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

  const baseItem = {
    type: 'task',
    project_id: INBOX_PROJECT_ID,
    parent_id: null,
    title: 'Test task',
    notes: '',
    due_date: '2026-05-18',
    start_date: null,
    due_time: null,
    priority: 'none',
    status: 'todo',
    tags: [],
    subtasks: [],
    recurrence: null,
  };

  it('POST creates a task and returns 201', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/items',
      payload: baseItem,
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as Record<string, unknown>;
    expect(body.title).toBe('Test task');
    expect(typeof body.id).toBe('string');
    expect(body.schema_version).toBe(1);
    expect(body.trashed_at).toBeNull();
  });

  it('GET /api/items/:id returns the created item', async () => {
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/items',
      payload: baseItem,
    });
    const created = JSON.parse(createRes.body) as Record<string, unknown>;
    const id = created.id as string;

    const res = await server.inject({ method: 'GET', url: `/api/items/${id}` });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as Record<string, unknown>;
    expect(body.id).toBe(id);
    expect(body.title).toBe('Test task');
  });

  it('PATCH updates title and priority', async () => {
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/items',
      payload: baseItem,
    });
    const created = JSON.parse(createRes.body) as Record<string, unknown>;
    const id = created.id as string;

    const res = await server.inject({
      method: 'PATCH',
      url: `/api/items/${id}`,
      payload: { title: 'Updated title', priority: 'high' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as Record<string, unknown>;
    expect(body.title).toBe('Updated title');
    expect(body.priority).toBe('high');
  });

  it('GET /api/items?view=all includes the created item', async () => {
    await server.inject({ method: 'POST', url: '/api/items', payload: baseItem });

    const res = await server.inject({ method: 'GET', url: '/api/items?view=all' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { items: unknown[]; count: number };
    expect(body.count).toBeGreaterThan(0);
    expect(Array.isArray(body.items)).toBe(true);
  });

  it('POST returns 400 for missing title', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/items',
      payload: { ...baseItem, title: '' },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION');
  });

  it('POST returns 400 for bad date format', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/items',
      payload: { ...baseItem, due_date: 'not-a-date' },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION');
  });

  it('POST returns 400 when parent is in a different project', async () => {
    // Create a project
    const projRes = await server.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'Project A', folder_id: null, is_hierarchical: false, color: null, icon: null },
    });
    const proj = JSON.parse(projRes.body) as { id: string };

    // Create parent item in Project A
    const parentRes = await server.inject({
      method: 'POST',
      url: '/api/items',
      payload: { ...baseItem, project_id: proj.id },
    });
    const parent = JSON.parse(parentRes.body) as { id: string };

    // Try to create child in Inbox with parent in Project A
    const res = await server.inject({
      method: 'POST',
      url: '/api/items',
      payload: {
        ...baseItem,
        project_id: INBOX_PROJECT_ID,
        parent_id: parent.id,
      },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION');
  });

  it('POST returns 404 when parent_id points to a non-existent item', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/items',
      payload: {
        ...baseItem,
        parent_id: '01HWABCDEFGHJKMNPQRSTVWXYZ',
      },
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body) as { error: { code: string } };
    expect(body.error.code).toBe('PARENT_NOT_FOUND');
  });

  it('PATCH returns 400 when patching trashed_at', async () => {
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/items',
      payload: baseItem,
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

  it('PATCH stamps completed_at when status changes to done', async () => {
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/items',
      payload: baseItem,
    });
    const created = JSON.parse(createRes.body) as { id: string };

    const res = await server.inject({
      method: 'PATCH',
      url: `/api/items/${created.id}`,
      payload: { status: 'done' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { completed_at: string | null; status: string };
    expect(body.status).toBe('done');
    expect(body.completed_at).not.toBeNull();
  });

  it('GET /api/items/:id returns 404 for unknown id', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/items/01HWABCDEFGHJKMNPQRSTVWXYZ',
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body) as { error: { code: string } };
    expect(body.error.code).toBe('ITEM_NOT_FOUND');
  });
});
