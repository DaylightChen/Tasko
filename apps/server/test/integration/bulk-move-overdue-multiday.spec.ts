/**
 * bulk-move-overdue-multiday.spec.ts
 *
 * Covers:
 * - Multi-day overdue item (start=May 1, due=May 5, today=May 19) →
 *   after bulk move: due_date = May 19, start_date = May 15 (delta of 4 days preserved).
 *
 * Delta: May 5 - May 1 = 4 days. Today = May 19. So:
 *   new_due_date = May 19
 *   new_start_date = May 19 - 4 = May 15
 *
 * Wait — let's reread the brief:
 *   "start=May 1, due=May 5, today=May 18; new due=May 18, new start=May 14 (delta preserved)"
 *   Delta between start and due: May 5 - May 1 = 4 days.
 *   today=May 18, new_due=May 18, new_start=May 18 - 4 = May 14.
 *
 * But our today is pinned to May 19 (per brief "today's date").
 * The brief example says today=May 18, so we pin to that in this test.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INBOX_PROJECT_ID } from '@tasko/types';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildServer } from '../../src/server.js';

describe('bulk move overdue — multi-day span delta preservation', () => {
  let dataDir: string;
  let server: FastifyInstance;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'tasko-bulk-multiday-'));
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
    vi.useRealTimers();
  });

  it('multi-day overdue: start=May 1, due=May 5, today=May 18 → due=May 18, start=May 14', async () => {
    // Pin today to May 18
    vi.setSystemTime(new Date('2026-05-18T12:00:00Z'));

    const createRes = await server.inject({
      method: 'POST',
      url: '/api/items',
      payload: {
        type: 'task',
        project_id: INBOX_PROJECT_ID,
        parent_id: null,
        title: 'Multi-day overdue task',
        notes: '',
        due_date: '2026-05-05',
        start_date: '2026-05-01',
        due_time: null,
        priority: 'none',
        status: 'todo',
        tags: [],
        recurrence: null,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const item = JSON.parse(createRes.body) as { id: string };

    const res = await server.inject({ method: 'POST', url: '/api/bulk/move-overdue-to-today' });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body) as { moved_count: number; new_due_date: string };
    expect(body.moved_count).toBe(1);
    expect(body.new_due_date).toBe('2026-05-18');

    // Verify the item's new dates
    const itemGet = await server.inject({ method: 'GET', url: `/api/items/${item.id}` });
    const itemData = JSON.parse(itemGet.body) as { due_date: string; start_date: string };

    expect(itemData.due_date).toBe('2026-05-18');
    // Original span: May 5 - May 1 = 4 days
    // New start_date: May 18 - 4 = May 14
    expect(itemData.start_date).toBe('2026-05-14');
  });

  it('single-day overdue item with start_date === due_date: only due_date shifts', async () => {
    vi.setSystemTime(new Date('2026-05-18T12:00:00Z'));

    const createRes = await server.inject({
      method: 'POST',
      url: '/api/items',
      payload: {
        type: 'task',
        project_id: INBOX_PROJECT_ID,
        parent_id: null,
        title: 'Same-day start and due',
        notes: '',
        due_date: '2026-05-05',
        start_date: '2026-05-05', // same-day (span length = 0)
        due_time: null,
        priority: 'none',
        status: 'todo',
        tags: [],
        recurrence: null,
      },
    });
    const item = JSON.parse(createRes.body) as { id: string };

    await server.inject({ method: 'POST', url: '/api/bulk/move-overdue-to-today' });

    const itemGet = await server.inject({ method: 'GET', url: `/api/items/${item.id}` });
    const itemData = JSON.parse(itemGet.body) as { due_date: string; start_date: string };

    expect(itemData.due_date).toBe('2026-05-18');
    // start_date = start_date was < due_date? No, they're equal so it's "single day": start is not shifted
    // Actually implementation: start_date < due_date is the check for multi-day
    // If start_date === due_date: NOT multi-day, so start_date is NOT shifted by the route
    // start_date remains the same as what was set... but wait: the route only sets due_date = today for single-day
    // Let's check: the start_date would stay at '2026-05-05' (unchanged)
    expect(itemData.start_date).toBe('2026-05-05');
  });

  it('multi-day with delta of 1 day: start=May 4, due=May 5, today=May 18 → due=May 18, start=May 17', async () => {
    vi.setSystemTime(new Date('2026-05-18T12:00:00Z'));

    const createRes = await server.inject({
      method: 'POST',
      url: '/api/items',
      payload: {
        type: 'task',
        project_id: INBOX_PROJECT_ID,
        parent_id: null,
        title: 'One-day span overdue',
        notes: '',
        due_date: '2026-05-05',
        start_date: '2026-05-04',
        due_time: null,
        priority: 'none',
        status: 'todo',
        tags: [],
        recurrence: null,
      },
    });
    const item = JSON.parse(createRes.body) as { id: string };

    await server.inject({ method: 'POST', url: '/api/bulk/move-overdue-to-today' });

    const itemGet = await server.inject({ method: 'GET', url: `/api/items/${item.id}` });
    const itemData = JSON.parse(itemGet.body) as { due_date: string; start_date: string };

    expect(itemData.due_date).toBe('2026-05-18');
    // Delta = May 5 - May 4 = 1. today = May 18. today - 1 = May 17.
    expect(itemData.start_date).toBe('2026-05-17');
  });

  it('single-day overdue item (no start_date): due_date moves to today, start_date stays null', async () => {
    vi.setSystemTime(new Date('2026-05-18T12:00:00Z'));

    const createRes = await server.inject({
      method: 'POST',
      url: '/api/items',
      payload: {
        type: 'task',
        project_id: INBOX_PROJECT_ID,
        parent_id: null,
        title: 'No start date overdue',
        notes: '',
        due_date: '2026-05-05',
        start_date: null,
        due_time: null,
        priority: 'none',
        status: 'todo',
        tags: [],
        recurrence: null,
      },
    });
    const item = JSON.parse(createRes.body) as { id: string };

    await server.inject({ method: 'POST', url: '/api/bulk/move-overdue-to-today' });

    const itemGet = await server.inject({ method: 'GET', url: `/api/items/${item.id}` });
    const itemData = JSON.parse(itemGet.body) as { due_date: string; start_date: string | null };

    expect(itemData.due_date).toBe('2026-05-18');
    expect(itemData.start_date).toBeNull();
  });
});
