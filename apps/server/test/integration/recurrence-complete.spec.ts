/**
 * Integration tests — recurring completion via PATCH /api/items/:id.
 *
 * Covers:
 * - Recurring task completion returns { completed, next } shape.
 * - next.due_date is correctly computed (monthly day=31 Jan→Feb clamp).
 * - source file has status=done; next file exists with correct id.
 * - Item count grew by 1 after completion.
 * - Un-complete (PATCH status: 'todo'): source returns to todo, next instance preserved.
 * - Non-recurring task completion returns plain Item (no { completed, next } wrap).
 * - Recurring branch NOT entered when already done (idempotent guard).
 */
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INBOX_PROJECT_ID } from '@tasko/types';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';

describe('recurrence-complete integration', () => {
  let dataDir: string;
  let server: FastifyInstance;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'tasko-recurrence-complete-'));
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

  // ─── Helpers ────────────────────────────────────────────────────────────────

  async function countItemFiles(): Promise<number> {
    const itemsDir = join(dataDir, 'items');
    try {
      const files = await readdir(itemsDir);
      return files.filter((f) => f.endsWith('.json')).length;
    } catch {
      return 0;
    }
  }

  async function createRecurringItem(
    overrides: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> {
    const res = await server.inject({
      method: 'POST',
      url: '/api/items',
      payload: {
        type: 'task',
        project_id: INBOX_PROJECT_ID,
        parent_id: null,
        title: 'Recurring test task',
        notes: '',
        due_date: '2026-01-31',
        start_date: null,
        due_time: null,
        priority: 'none',
        status: 'todo',
        tags: [],
        recurrence: {
          frequency: 'monthly',
          day_of_month: 31,
          anchor_mode: 'on_schedule',
        },
        ...overrides,
      },
    });
    expect(res.statusCode).toBe(201);
    return JSON.parse(res.body) as Record<string, unknown>;
  }

  async function createNonRecurringItem(): Promise<Record<string, unknown>> {
    const res = await server.inject({
      method: 'POST',
      url: '/api/items',
      payload: {
        type: 'task',
        project_id: INBOX_PROJECT_ID,
        parent_id: null,
        title: 'Non-recurring task',
        notes: '',
        due_date: '2026-05-18',
        start_date: null,
        due_time: null,
        priority: 'none',
        status: 'todo',
        tags: [],
        recurrence: null,
      },
    });
    expect(res.statusCode).toBe(201);
    return JSON.parse(res.body) as Record<string, unknown>;
  }

  // ─── Main recurring completion test ─────────────────────────────────────────

  it('PATCH status=done on recurring task returns { completed, next } shape', async () => {
    const item = await createRecurringItem();
    const id = item.id as string;

    const res = await server.inject({
      method: 'PATCH',
      url: `/api/items/${id}`,
      payload: { status: 'done' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as Record<string, unknown>;

    // Response must have `completed` and `next` keys
    expect(body).toHaveProperty('completed');
    expect(body).toHaveProperty('next');

    const completed = body.completed as Record<string, unknown>;
    const next = body.next as Record<string, unknown>;

    // completed: source marked done
    expect(completed.id).toBe(id);
    expect(completed.status).toBe('done');
    expect(completed.completed_at).not.toBeNull();
    expect(typeof completed.completed_at).toBe('string');

    // next: fresh instance with computed due_date
    expect(typeof next.id).toBe('string');
    expect(next.id).not.toBe(id);
    expect(next.status).toBe('todo');
    expect(next.due_date).toBe('2026-02-28'); // Jan 31 + 1 month → Feb 28 (non-leap 2026)
    expect(next.completed_at).toBeNull();
  });

  it('next instance inherits recurrence rule', async () => {
    const item = await createRecurringItem();

    const res = await server.inject({
      method: 'PATCH',
      url: `/api/items/${item.id as string}`,
      payload: { status: 'done' },
    });

    const body = JSON.parse(res.body) as Record<string, unknown>;
    const next = body.next as Record<string, unknown>;

    expect(next.recurrence).toEqual({
      frequency: 'monthly',
      day_of_month: 31,
      anchor_mode: 'on_schedule',
    });
  });

  it('next instance has empty subtasks (fresh per-instance)', async () => {
    const item = await createRecurringItem();

    const res = await server.inject({
      method: 'PATCH',
      url: `/api/items/${item.id as string}`,
      payload: { status: 'done' },
    });

    const body = JSON.parse(res.body) as Record<string, unknown>;
    const next = body.next as Record<string, unknown>;

    expect(Array.isArray(next.subtasks)).toBe(true);
    expect((next.subtasks as unknown[]).length).toBe(0);
  });

  it('item count grows by 1 after recurring completion', async () => {
    await createRecurringItem();

    // Count before completion — this is after one item was created
    const beforeCount = await countItemFiles();

    const listBefore = await server.inject({ method: 'GET', url: '/api/items?view=all' });
    const beforeBody = JSON.parse(listBefore.body) as { count: number };
    const indexCountBefore = beforeBody.count;

    // Complete the most recently created item
    const allItems = await server.inject({ method: 'GET', url: '/api/items?view=all' });
    const items = JSON.parse(allItems.body) as { items: Array<Record<string, unknown>> };
    const recurringItem = items.items[0];

    await server.inject({
      method: 'PATCH',
      url: `/api/items/${recurringItem?.id as string}`,
      payload: { status: 'done' },
    });

    const afterCount = await countItemFiles();
    expect(afterCount).toBe(beforeCount + 1);

    // The all view excludes completed; query all including completed
    const listAfterAll = await server.inject({ method: 'GET', url: '/api/items?view=completed' });
    const afterBodyCompleted = JSON.parse(listAfterAll.body) as { count: number };
    // The new instance is todo so it appears in all, source is done so it appears in completed
    const listAfterTodo = await server.inject({ method: 'GET', url: '/api/items?view=all' });
    const afterBodyTodo = JSON.parse(listAfterTodo.body) as { count: number };

    // Total items in the system = before_index (was 1 todo) + 1 new todo instance
    // The completed source is filtered from 'all' so all count stays at 1 todo (the new instance)
    expect(afterBodyTodo.count).toBe(indexCountBefore); // new instance replaces old in 'all' view
    expect(afterBodyCompleted.count).toBeGreaterThanOrEqual(1); // source now in completed
  });

  it('both source and next instance files exist on disk after completion', async () => {
    const item = await createRecurringItem();

    const res = await server.inject({
      method: 'PATCH',
      url: `/api/items/${item.id as string}`,
      payload: { status: 'done' },
    });

    const body = JSON.parse(res.body) as Record<string, unknown>;
    const next = body.next as Record<string, unknown>;

    const itemsDir = join(dataDir, 'items');
    const files = await readdir(itemsDir);
    const fileNames = files.filter((f) => f.endsWith('.json'));

    // Both source and next must have files
    const sourceFile = fileNames.find((f) => f.includes(item.id as string));
    const nextFile = fileNames.find((f) => f.includes(next.id as string));

    expect(sourceFile).toBeDefined();
    expect(nextFile).toBeDefined();
  });

  // ─── Un-check (PATCH status: 'todo') ────────────────────────────────────────

  it('PATCH source status=todo after recurring completion: returns plain Item (not {completed,next})', async () => {
    const item = await createRecurringItem();
    const id = item.id as string;

    // First, complete it
    await server.inject({
      method: 'PATCH',
      url: `/api/items/${id}`,
      payload: { status: 'done' },
    });

    // Un-complete
    const unRes = await server.inject({
      method: 'PATCH',
      url: `/api/items/${id}`,
      payload: { status: 'todo' },
    });

    expect(unRes.statusCode).toBe(200);
    const body = JSON.parse(unRes.body) as Record<string, unknown>;

    // Must NOT have `completed` or `next` keys — it's a plain Item
    expect(body).not.toHaveProperty('completed');
    expect(body).not.toHaveProperty('next');

    // Source is back to todo with cleared completed_at
    expect(body.id).toBe(id);
    expect(body.status).toBe('todo');
    expect(body.completed_at).toBeNull();
  });

  it('next instance is still on disk after un-checking source', async () => {
    const item = await createRecurringItem();
    const id = item.id as string;

    // Complete
    const completeRes = await server.inject({
      method: 'PATCH',
      url: `/api/items/${id}`,
      payload: { status: 'done' },
    });
    const completeBody = JSON.parse(completeRes.body) as Record<string, unknown>;
    const nextItem = completeBody.next as Record<string, unknown>;
    const nextId = nextItem.id as string;

    // Un-complete source
    await server.inject({
      method: 'PATCH',
      url: `/api/items/${id}`,
      payload: { status: 'todo' },
    });

    // Verify next instance is still accessible
    const nextRes = await server.inject({
      method: 'GET',
      url: `/api/items/${nextId}`,
    });

    expect(nextRes.statusCode).toBe(200);
    const nextBody = JSON.parse(nextRes.body) as Record<string, unknown>;
    expect(nextBody.id).toBe(nextId);
    expect(nextBody.status).toBe('todo');
    expect(nextBody.due_date).toBe('2026-02-28');
  });

  it('next instance count is unchanged after un-check (no deletion)', async () => {
    const item = await createRecurringItem();
    const id = item.id as string;

    // Complete
    await server.inject({
      method: 'PATCH',
      url: `/api/items/${id}`,
      payload: { status: 'done' },
    });

    const countAfterComplete = await countItemFiles();

    // Un-complete source
    await server.inject({
      method: 'PATCH',
      url: `/api/items/${id}`,
      payload: { status: 'todo' },
    });

    const countAfterUncheck = await countItemFiles();

    // No files were added or removed during un-check
    expect(countAfterUncheck).toBe(countAfterComplete);
  });

  // ─── Non-recurring task ──────────────────────────────────────────────────────

  it('PATCH status=done on non-recurring task returns plain Item, not {completed,next}', async () => {
    const item = await createNonRecurringItem();
    const id = item.id as string;

    const res = await server.inject({
      method: 'PATCH',
      url: `/api/items/${id}`,
      payload: { status: 'done' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as Record<string, unknown>;

    expect(body).not.toHaveProperty('completed');
    expect(body).not.toHaveProperty('next');
    expect(body.id).toBe(id);
    expect(body.status).toBe('done');
    expect(typeof body.completed_at).toBe('string');
  });

  // ─── Idempotent guard (already done) ────────────────────────────────────────

  it('PATCH status=done on already-completed recurring item does NOT generate another next instance', async () => {
    const item = await createRecurringItem();
    const id = item.id as string;

    // First completion — generates next
    const firstRes = await server.inject({
      method: 'PATCH',
      url: `/api/items/${id}`,
      payload: { status: 'done' },
    });
    expect(firstRes.statusCode).toBe(200);
    const countAfterFirst = await countItemFiles();

    // Second PATCH status=done on the same source (already done)
    // Per the route logic: `source.completed_at === null` guard means this won't fire the recurring branch again
    const secondRes = await server.inject({
      method: 'PATCH',
      url: `/api/items/${id}`,
      payload: { status: 'done' },
    });
    expect(secondRes.statusCode).toBe(200);
    const countAfterSecond = await countItemFiles();

    // No additional file should have been created
    expect(countAfterSecond).toBe(countAfterFirst);

    // Response should be a plain Item (not {completed,next}) since completed_at was already set
    const body2 = JSON.parse(secondRes.body) as Record<string, unknown>;
    expect(body2).not.toHaveProperty('next');
  });

  // ─── Yearly recurrence completion ────────────────────────────────────────────

  it('yearly recurrence: due=2026-01-01, month=1 day=1 → next=2027-01-01', async () => {
    const item = await createRecurringItem({
      due_date: '2026-01-01',
      recurrence: { frequency: 'yearly', month: 1, day: 1, anchor_mode: 'on_schedule' },
    });

    const res = await server.inject({
      method: 'PATCH',
      url: `/api/items/${item.id as string}`,
      payload: { status: 'done' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as Record<string, unknown>;
    const next = body.next as Record<string, unknown>;
    expect(next.due_date).toBe('2027-01-01');
  });

  // ─── Weekly recurrence completion ────────────────────────────────────────────

  it('weekly recurrence: due=Mon 2026-05-18, {Mon} on_schedule → next=Mon 2026-05-25', async () => {
    const item = await createRecurringItem({
      due_date: '2026-05-18',
      recurrence: { frequency: 'weekly', weekdays: ['mon'], anchor_mode: 'on_schedule' },
    });

    const res = await server.inject({
      method: 'PATCH',
      url: `/api/items/${item.id as string}`,
      payload: { status: 'done' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as Record<string, unknown>;
    const next = body.next as Record<string, unknown>;
    expect(next.due_date).toBe('2026-05-25');
  });
});
