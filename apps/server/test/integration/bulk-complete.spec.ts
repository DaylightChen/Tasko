/**
 * bulk-complete.spec.ts
 *
 * Covers:
 * - POST /api/bulk/complete marks all selected items as done.
 * - Non-recurring items: status=done, completed_at set.
 * - Recurring items: original marked done, new instance created.
 * - Returns { completed_count, new_instances, items }.
 * - completed_count counts all completed items.
 * - new_instances has one entry per recurring item.
 *
 * Note: Uses user project (not INBOX_PROJECT_ID) because BulkCompleteResponseSchema
 * uses ItemSchema which validates project_id as a ULID — INBOX_PROJECT_ID ('00000000000000000000INBOX0')
 * contains 'I' and 'O' which are not in the ULID alphabet.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';

describe('bulk complete', () => {
  let dataDir: string;
  let server: FastifyInstance;
  let userProjectId: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'tasko-bulk-complete-'));
    server = await buildServer({
      dataDir,
      port: 0,
      host: '127.0.0.1',
      initIfMissing: true,
      logLevel: 'fatal',
    });
    // Use a user project (not Inbox) to avoid ItemSchema ULID validation issues
    const projRes = await server.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'Test Project', folder_id: null, is_hierarchical: false, color: null, icon: null },
    });
    expect(projRes.statusCode).toBe(201);
    const proj = JSON.parse(projRes.body) as { id: string };
    userProjectId = proj.id;
  });

  afterEach(async () => {
    await server.close();
    await rm(dataDir, { recursive: true });
  });

  async function createTask(title: string): Promise<{ id: string }> {
    const res = await server.inject({
      method: 'POST',
      url: '/api/items',
      payload: {
        type: 'task',
        project_id: userProjectId,
        parent_id: null,
        title,
        notes: '',
        due_date: '2026-05-19',
        start_date: null,
        due_time: null,
        priority: 'none',
        status: 'todo',
        tags: [],
        recurrence: null,
      },
    });
    if (res.statusCode !== 201) throw new Error(`createTask failed: ${res.body}`);
    return JSON.parse(res.body) as { id: string };
  }

  async function createRecurringTask(title: string): Promise<{ id: string }> {
    const res = await server.inject({
      method: 'POST',
      url: '/api/items',
      payload: {
        type: 'task',
        project_id: userProjectId,
        parent_id: null,
        title,
        notes: '',
        due_date: '2026-05-19',
        start_date: null,
        due_time: null,
        priority: 'none',
        status: 'todo',
        tags: [],
        recurrence: { frequency: 'daily', anchor_mode: 'on_schedule' },
      },
    });
    if (res.statusCode !== 201) throw new Error(`createRecurringTask failed: ${res.body}`);
    return JSON.parse(res.body) as { id: string };
  }

  it('bulk complete of 5 items marks all as done', async () => {
    const items: { id: string }[] = [];
    for (let i = 1; i <= 5; i++) {
      items.push(await createTask(`Task ${i}`));
    }
    const ids = items.map((i) => i.id);

    const res = await server.inject({
      method: 'POST',
      url: '/api/bulk/complete',
      payload: { item_ids: ids },
    });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body) as {
      completed_count: number;
      new_instances: unknown[];
      items: unknown[];
    };
    expect(body.completed_count).toBe(5);
    expect(body.new_instances).toHaveLength(0);
  });

  it('non-recurring items get status=done and completed_at set', async () => {
    const task = await createTask('Non-recurring Task');

    await server.inject({
      method: 'POST',
      url: '/api/bulk/complete',
      payload: { item_ids: [task.id] },
    });

    const taskGet = await server.inject({ method: 'GET', url: `/api/items/${task.id}` });
    const taskData = JSON.parse(taskGet.body) as { status: string; completed_at: string | null };
    expect(taskData.status).toBe('done');
    expect(taskData.completed_at).not.toBeNull();
    expect(typeof taskData.completed_at).toBe('string');
  });

  it('recurring items generate new instances', async () => {
    const recurringTask1 = await createRecurringTask('Recurring Task 1');
    const recurringTask2 = await createRecurringTask('Recurring Task 2');

    const res = await server.inject({
      method: 'POST',
      url: '/api/bulk/complete',
      payload: { item_ids: [recurringTask1.id, recurringTask2.id] },
    });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body) as {
      completed_count: number;
      new_instances: Array<{ id: string; recurrence: unknown }>;
    };
    expect(body.completed_count).toBe(2);
    expect(body.new_instances).toHaveLength(2);

    // New instances should have recurrence rules
    for (const instance of body.new_instances) {
      expect(instance.recurrence).not.toBeNull();
    }
  });

  it('mix of 3 non-recurring + 2 recurring: 5 done + 2 new instances', async () => {
    const plain1 = await createTask('Plain 1');
    const plain2 = await createTask('Plain 2');
    const plain3 = await createTask('Plain 3');
    const rec1 = await createRecurringTask('Recurring 1');
    const rec2 = await createRecurringTask('Recurring 2');

    const res = await server.inject({
      method: 'POST',
      url: '/api/bulk/complete',
      payload: { item_ids: [plain1.id, plain2.id, plain3.id, rec1.id, rec2.id] },
    });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body) as {
      completed_count: number;
      new_instances: unknown[];
    };
    expect(body.completed_count).toBe(5);
    expect(body.new_instances).toHaveLength(2);
  });

  it('new recurring instances are accessible via GET /api/items', async () => {
    const recurringTask = await createRecurringTask('Recurring Task');

    const res = await server.inject({
      method: 'POST',
      url: '/api/bulk/complete',
      payload: { item_ids: [recurringTask.id] },
    });

    const body = JSON.parse(res.body) as {
      new_instances: Array<{ id: string }>;
    };
    expect(body.new_instances).toHaveLength(1);
    const newId = body.new_instances[0]?.id;
    expect(newId).toBeDefined();

    const newGet = await server.inject({ method: 'GET', url: `/api/items/${newId}` });
    expect(newGet.statusCode).toBe(200);
    const newData = JSON.parse(newGet.body) as { status: string };
    expect(newData.status).toBe('todo');
  });

  it('completed recurring original has status=done', async () => {
    const recurringTask = await createRecurringTask('Recurring Task');

    await server.inject({
      method: 'POST',
      url: '/api/bulk/complete',
      payload: { item_ids: [recurringTask.id] },
    });

    const taskGet = await server.inject({ method: 'GET', url: `/api/items/${recurringTask.id}` });
    const taskData = JSON.parse(taskGet.body) as { status: string };
    expect(taskData.status).toBe('done');
  });

  it('skips items that do not exist without failing the whole batch', async () => {
    const task = await createTask('Valid Task');

    const res = await server.inject({
      method: 'POST',
      url: '/api/bulk/complete',
      payload: { item_ids: [task.id, '01NONEXISTENT000000000000'] },
    });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body) as { completed_count: number };
    expect(body.completed_count).toBe(1); // only the valid task
  });
});
