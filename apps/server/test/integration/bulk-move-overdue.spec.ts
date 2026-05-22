/**
 * bulk-move-overdue.spec.ts
 *
 * Covers:
 * - POST /api/bulk/move-overdue-to-today only moves items with due_date < today.
 * - Items due today or in the future are unchanged.
 * - Returns { moved_ids, moved_count, new_due_date }.
 * - new_due_date matches today.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INBOX_PROJECT_ID } from '@tasko/types';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';

const TODAY = '2026-05-19';
const YESTERDAY = '2026-05-18';
const THREE_DAYS_AGO = '2026-05-16';
const FIVE_DAYS_AGO = '2026-05-14';
const TOMORROW = '2026-05-20';

describe('bulk move overdue to today', () => {
  let dataDir: string;
  let server: FastifyInstance;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'tasko-bulk-overdue-'));
    server = await buildServer({
      dataDir,
      port: 0,
      host: '127.0.0.1',
      initIfMissing: true,
      logLevel: 'fatal',
    });
    // Pin today
    vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
  });

  afterEach(async () => {
    await server.close();
    await rm(dataDir, { recursive: true });
    vi.useRealTimers();
  });

  async function createItem(due_date: string, title: string): Promise<{ id: string }> {
    const res = await server.inject({
      method: 'POST',
      url: '/api/items',
      payload: {
        type: 'task',
        project_id: INBOX_PROJECT_ID,
        parent_id: null,
        title,
        notes: '',
        due_date,
        start_date: null,
        due_time: null,
        priority: 'none',
        status: 'todo',
        tags: [],
        recurrence: null,
      },
    });
    if (res.statusCode !== 201) throw new Error(`createItem failed: ${res.body}`);
    return JSON.parse(res.body) as { id: string };
  }

  it('moves only 3 overdue items; 2 today items are unchanged', async () => {
    const o1 = await createItem(YESTERDAY, 'Overdue 1');
    const o2 = await createItem(THREE_DAYS_AGO, 'Overdue 2');
    const o3 = await createItem(FIVE_DAYS_AGO, 'Overdue 3');
    const t1 = await createItem(TODAY, 'Today 1');
    const t2 = await createItem(TODAY, 'Today 2');

    const res = await server.inject({ method: 'POST', url: '/api/bulk/move-overdue-to-today' });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body) as { moved_ids: string[]; moved_count: number; new_due_date: string };
    expect(body.moved_count).toBe(3);
    expect(body.moved_ids).toContain(o1.id);
    expect(body.moved_ids).toContain(o2.id);
    expect(body.moved_ids).toContain(o3.id);
    expect(body.moved_ids).not.toContain(t1.id);
    expect(body.moved_ids).not.toContain(t2.id);
    expect(body.new_due_date).toBe(TODAY);
  });

  it('overdue items have due_date set to today after bulk move', async () => {
    const o1 = await createItem(YESTERDAY, 'Overdue Task');
    const o2 = await createItem(THREE_DAYS_AGO, 'Older Overdue');

    await server.inject({ method: 'POST', url: '/api/bulk/move-overdue-to-today' });

    const r1 = await server.inject({ method: 'GET', url: `/api/items/${o1.id}` });
    const r2 = await server.inject({ method: 'GET', url: `/api/items/${o2.id}` });

    expect((JSON.parse(r1.body) as { due_date: string }).due_date).toBe(TODAY);
    expect((JSON.parse(r2.body) as { due_date: string }).due_date).toBe(TODAY);
  });

  it('today items are not touched by bulk move overdue', async () => {
    const t1 = await createItem(TODAY, 'Today Task 1');
    const t2 = await createItem(TODAY, 'Today Task 2');

    await server.inject({ method: 'POST', url: '/api/bulk/move-overdue-to-today' });

    const r1 = await server.inject({ method: 'GET', url: `/api/items/${t1.id}` });
    const r2 = await server.inject({ method: 'GET', url: `/api/items/${t2.id}` });

    expect((JSON.parse(r1.body) as { due_date: string }).due_date).toBe(TODAY);
    expect((JSON.parse(r2.body) as { due_date: string }).due_date).toBe(TODAY);
  });

  it('future items are not moved by bulk move overdue', async () => {
    const future = await createItem(TOMORROW, 'Future Task');
    await createItem(YESTERDAY, 'Overdue Task'); // ensure there is something to move

    await server.inject({ method: 'POST', url: '/api/bulk/move-overdue-to-today' });

    const r = await server.inject({ method: 'GET', url: `/api/items/${future.id}` });
    expect((JSON.parse(r.body) as { due_date: string }).due_date).toBe(TOMORROW);
  });

  it('returns moved_count: 0 when there are no overdue items', async () => {
    await createItem(TODAY, 'Today Task');
    await createItem(TOMORROW, 'Tomorrow Task');

    const res = await server.inject({ method: 'POST', url: '/api/bulk/move-overdue-to-today' });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body) as { moved_count: number };
    expect(body.moved_count).toBe(0);
  });

  it('completed items are not moved even if overdue', async () => {
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/items',
      payload: {
        type: 'task',
        project_id: INBOX_PROJECT_ID,
        parent_id: null,
        title: 'Completed overdue task',
        notes: '',
        due_date: YESTERDAY,
        start_date: null,
        due_time: null,
        priority: 'none',
        status: 'done',
        tags: [],
        recurrence: null,
      },
    });
    const item = JSON.parse(createRes.body) as { id: string };

    const res = await server.inject({ method: 'POST', url: '/api/bulk/move-overdue-to-today' });
    const body = JSON.parse(res.body) as { moved_count: number };
    expect(body.moved_count).toBe(0);

    // Completed item's due_date should be unchanged
    const itemGet = await server.inject({ method: 'GET', url: `/api/items/${item.id}` });
    expect((JSON.parse(itemGet.body) as { due_date: string }).due_date).toBe(YESTERDAY);
  });
});

// Need to import vi for setSystemTime
import { vi } from 'vitest';
