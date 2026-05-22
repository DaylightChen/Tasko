/**
 * Integration tests — un-check semantics for completed recurring tasks.
 *
 * Per spec §6.6 / §9.4 #5: un-checking a completed recurring instance:
 * - Clears completed_at on the source instance.
 * - Sets status back to 'todo'.
 * - Does NOT delete the auto-generated next instance.
 * - Returns just the updated source Item (not {completed,next}).
 *
 * These tests isolate the un-check path from the recurrence-complete.spec.ts
 * to make the intent clear.
 */
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INBOX_PROJECT_ID } from '@tasko/types';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';

describe('recurrence-uncomplete integration', () => {
  let dataDir: string;
  let server: FastifyInstance;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'tasko-recurrence-uncomplete-'));
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

  async function seedAndComplete(): Promise<{
    sourceId: string;
    nextId: string;
    nextDueDate: string;
  }> {
    // Create a monthly recurring task
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/items',
      payload: {
        type: 'task',
        project_id: INBOX_PROJECT_ID,
        parent_id: null,
        title: 'Un-check test task',
        notes: '',
        due_date: '2026-03-31',
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
      },
    });
    expect(createRes.statusCode).toBe(201);
    const created = JSON.parse(createRes.body) as Record<string, unknown>;
    const sourceId = created.id as string;

    // Complete it → generates next instance
    const completeRes = await server.inject({
      method: 'PATCH',
      url: `/api/items/${sourceId}`,
      payload: { status: 'done' },
    });
    expect(completeRes.statusCode).toBe(200);
    const completeBody = JSON.parse(completeRes.body) as Record<string, unknown>;

    const next = completeBody.next as Record<string, unknown>;
    return {
      sourceId,
      nextId: next.id as string,
      nextDueDate: next.due_date as string,
    };
  }

  // ─── Core un-check behavior ──────────────────────────────────────────────────

  it('PATCH source status=todo: source status becomes todo', async () => {
    const { sourceId } = await seedAndComplete();

    const unRes = await server.inject({
      method: 'PATCH',
      url: `/api/items/${sourceId}`,
      payload: { status: 'todo' },
    });

    expect(unRes.statusCode).toBe(200);
    const body = JSON.parse(unRes.body) as Record<string, unknown>;
    expect(body.status).toBe('todo');
  });

  it('PATCH source status=todo: completed_at is cleared to null', async () => {
    const { sourceId } = await seedAndComplete();

    const unRes = await server.inject({
      method: 'PATCH',
      url: `/api/items/${sourceId}`,
      payload: { status: 'todo' },
    });

    expect(unRes.statusCode).toBe(200);
    const body = JSON.parse(unRes.body) as Record<string, unknown>;
    expect(body.completed_at).toBeNull();
  });

  it('PATCH source status=todo: next instance still accessible via GET', async () => {
    const { sourceId, nextId, nextDueDate } = await seedAndComplete();

    // Un-check source
    await server.inject({
      method: 'PATCH',
      url: `/api/items/${sourceId}`,
      payload: { status: 'todo' },
    });

    // Next instance must still be retrievable
    const nextRes = await server.inject({
      method: 'GET',
      url: `/api/items/${nextId}`,
    });

    expect(nextRes.statusCode).toBe(200);
    const nextBody = JSON.parse(nextRes.body) as Record<string, unknown>;
    expect(nextBody.id).toBe(nextId);
    expect(nextBody.status).toBe('todo');
    // Mar 31 + 1 month = Apr 30 (April only has 30 days)
    expect(nextBody.due_date).toBe(nextDueDate);
    expect(nextDueDate).toBe('2026-04-30');
  });

  it('PATCH source status=todo: file count does not change (no deletions)', async () => {
    const { sourceId } = await seedAndComplete();
    const fileCountAfterComplete = await countItemFiles();

    await server.inject({
      method: 'PATCH',
      url: `/api/items/${sourceId}`,
      payload: { status: 'todo' },
    });

    const fileCountAfterUncheck = await countItemFiles();
    expect(fileCountAfterUncheck).toBe(fileCountAfterComplete);
  });

  it('PATCH source status=todo: response is plain Item, not {completed,next}', async () => {
    const { sourceId } = await seedAndComplete();

    const unRes = await server.inject({
      method: 'PATCH',
      url: `/api/items/${sourceId}`,
      payload: { status: 'todo' },
    });

    const body = JSON.parse(unRes.body) as Record<string, unknown>;
    expect(body).not.toHaveProperty('completed');
    expect(body).not.toHaveProperty('next');
    expect(body.id).toBe(sourceId);
  });

  it('PATCH source status=todo: next instance still appears in view=all listing', async () => {
    const { sourceId, nextId } = await seedAndComplete();

    // Un-check source
    await server.inject({
      method: 'PATCH',
      url: `/api/items/${sourceId}`,
      payload: { status: 'todo' },
    });

    // Query all active items
    const listRes = await server.inject({
      method: 'GET',
      url: '/api/items?view=all',
    });
    const listBody = JSON.parse(listRes.body) as { items: Array<Record<string, unknown>> };
    const ids = listBody.items.map((i) => i.id);

    // Both source (now todo) and next instance should be in all
    expect(ids).toContain(sourceId);
    expect(ids).toContain(nextId);
  });

  // ─── Chain: complete again after un-check ────────────────────────────────────

  it('can complete source again after un-check: generates a second next instance', async () => {
    const { sourceId } = await seedAndComplete();
    const fileCountAfterFirst = await countItemFiles();

    // Un-check
    await server.inject({
      method: 'PATCH',
      url: `/api/items/${sourceId}`,
      payload: { status: 'todo' },
    });

    // Complete again
    const reCompleteRes = await server.inject({
      method: 'PATCH',
      url: `/api/items/${sourceId}`,
      payload: { status: 'done' },
    });

    expect(reCompleteRes.statusCode).toBe(200);
    const body = JSON.parse(reCompleteRes.body) as Record<string, unknown>;
    expect(body).toHaveProperty('completed');
    expect(body).toHaveProperty('next');

    const fileCountAfterSecond = await countItemFiles();
    // Second completion creates another file
    expect(fileCountAfterSecond).toBe(fileCountAfterFirst + 1);
  });

  // ─── Daily recurring un-check ────────────────────────────────────────────────

  it('daily recurring un-check: next instance preserved', async () => {
    // Create daily task
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/items',
      payload: {
        type: 'task',
        project_id: INBOX_PROJECT_ID,
        parent_id: null,
        title: 'Daily recurring',
        notes: '',
        due_date: '2026-05-18',
        start_date: null,
        due_time: null,
        priority: 'none',
        status: 'todo',
        tags: [],
        recurrence: { frequency: 'daily', anchor_mode: 'on_schedule' },
      },
    });
    expect(createRes.statusCode).toBe(201);
    const created = JSON.parse(createRes.body) as Record<string, unknown>;
    const sourceId = created.id as string;

    // Complete it
    const completeRes = await server.inject({
      method: 'PATCH',
      url: `/api/items/${sourceId}`,
      payload: { status: 'done' },
    });
    expect(completeRes.statusCode).toBe(200);
    const completeBody = JSON.parse(completeRes.body) as Record<string, unknown>;
    const nextId = (completeBody.next as Record<string, unknown>).id as string;
    const nextDueDate = (completeBody.next as Record<string, unknown>).due_date as string;

    // next should be May 19 (daily on_schedule from May 18)
    expect(nextDueDate).toBe('2026-05-19');

    // Un-check source
    await server.inject({
      method: 'PATCH',
      url: `/api/items/${sourceId}`,
      payload: { status: 'todo' },
    });

    // Next instance still accessible
    const nextRes = await server.inject({
      method: 'GET',
      url: `/api/items/${nextId}`,
    });
    expect(nextRes.statusCode).toBe(200);
    expect((JSON.parse(nextRes.body) as Record<string, unknown>).due_date).toBe('2026-05-19');
  });
});
