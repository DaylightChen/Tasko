import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INBOX_PROJECT_ID } from '@tasko/types';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';

describe('Items subtask sub-routes', () => {
  let dataDir: string;
  let server: FastifyInstance;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'tasko-subtasks-'));
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

  async function createTask(overrides: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    const res = await server.inject({
      method: 'POST',
      url: '/api/items',
      payload: {
        type: 'task',
        project_id: INBOX_PROJECT_ID,
        parent_id: null,
        title: 'Parent Task',
        notes: '',
        due_date: '2026-05-18',
        start_date: null,
        due_time: null,
        priority: 'none',
        status: 'todo',
        tags: [],
        subtasks: [],
        recurrence: null,
        ...overrides,
      },
    });
    return JSON.parse(res.body) as Record<string, unknown>;
  }

  it('POST adds 3 subtasks and returns parent item (201)', async () => {
    const task = await createTask();
    const id = task.id as string;

    for (let i = 1; i <= 3; i++) {
      const res = await server.inject({
        method: 'POST',
        url: `/api/items/${id}/subtasks`,
        payload: { title: `Subtask ${i}` },
      });
      expect(res.statusCode).toBe(201);
    }

    const getRes = await server.inject({ method: 'GET', url: `/api/items/${id}` });
    const body = JSON.parse(getRes.body) as { subtasks: unknown[] };
    expect(body.subtasks).toHaveLength(3);
  });

  it('PATCH subtask updates sort_order (reorder)', async () => {
    const task = await createTask();
    const id = task.id as string;

    const addRes = await server.inject({
      method: 'POST',
      url: `/api/items/${id}/subtasks`,
      payload: { title: 'Subtask', sort_order: 1024 },
    });
    expect(addRes.statusCode).toBe(201);
    const parent = JSON.parse(addRes.body) as { subtasks: { id: string; sort_order: number }[] };
    const sid = parent.subtasks[0]?.id;
    expect(sid).toBeDefined();
    if (!sid) return;

    const patchRes = await server.inject({
      method: 'PATCH',
      url: `/api/items/${id}/subtasks/${sid}`,
      payload: { sort_order: 2048 },
    });
    expect(patchRes.statusCode).toBe(200);
    const updated = JSON.parse(patchRes.body) as { subtasks: { id: string; sort_order: number }[] };
    const updatedSt = updated.subtasks.find((st) => st.id === sid);
    expect(updatedSt?.sort_order).toBe(2048);
  });

  it('PATCH subtask sets status done and stamps completed_at', async () => {
    const task = await createTask();
    const id = task.id as string;

    const addRes = await server.inject({
      method: 'POST',
      url: `/api/items/${id}/subtasks`,
      payload: { title: 'Subtask' },
    });
    const parent = JSON.parse(addRes.body) as { subtasks: { id: string; completed_at: string | null }[] };
    const sid = parent.subtasks[0]?.id;
    expect(sid).toBeDefined();
    if (!sid) return;

    const patchRes = await server.inject({
      method: 'PATCH',
      url: `/api/items/${id}/subtasks/${sid}`,
      payload: { status: 'done' },
    });
    expect(patchRes.statusCode).toBe(200);
    const result = JSON.parse(patchRes.body) as {
      subtasks: { id: string; status: string; completed_at: string | null }[];
    };
    const updatedSt = result.subtasks.find((st) => st.id === sid);
    expect(updatedSt?.status).toBe('done');
    expect(updatedSt?.completed_at).not.toBeNull();
  });

  it('DELETE subtask removes it and returns parent', async () => {
    const task = await createTask();
    const id = task.id as string;

    const addRes = await server.inject({
      method: 'POST',
      url: `/api/items/${id}/subtasks`,
      payload: { title: 'To be deleted' },
    });
    const parent = JSON.parse(addRes.body) as { subtasks: { id: string }[] };
    const sid = parent.subtasks[0]?.id;
    expect(sid).toBeDefined();
    if (!sid) return;

    const delRes = await server.inject({
      method: 'DELETE',
      url: `/api/items/${id}/subtasks/${sid}`,
    });
    expect(delRes.statusCode).toBe(200);
    const result = JSON.parse(delRes.body) as { subtasks: { id: string }[] };
    expect(result.subtasks.find((st) => st.id === sid)).toBeUndefined();
  });

  it('POST subtask to a Feature returns 422', async () => {
    const feature = await createTask({ type: 'feature' });
    const id = feature.id as string;

    const res = await server.inject({
      method: 'POST',
      url: `/api/items/${id}/subtasks`,
      payload: { title: 'Bad subtask' },
    });
    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.body) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('VALIDATION');
    expect(body.error.message).toContain('Tasks');
  });
});
