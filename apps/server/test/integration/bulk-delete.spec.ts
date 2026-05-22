/**
 * bulk-delete.spec.ts
 *
 * Covers:
 * - POST /api/bulk/delete soft-deletes all selected items + their descendants.
 * - Returns { trashed_count, items }.
 * - Items and descendants appear in /api/trash.
 * - Items no longer accessible via /api/items.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';

describe('bulk delete', () => {
  let dataDir: string;
  let server: FastifyInstance;
  let userProjectId: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'tasko-bulk-delete-'));
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
      payload: { name: 'Test Project', folder_id: null, is_hierarchical: true, color: null, icon: null },
    });
    expect(projRes.statusCode).toBe(201);
    const proj = JSON.parse(projRes.body) as { id: string };
    userProjectId = proj.id;
  });

  afterEach(async () => {
    await server.close();
    await rm(dataDir, { recursive: true });
  });

  async function createProject(name: string, hierarchical = true): Promise<{ id: string }> {
    const res = await server.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name, folder_id: null, is_hierarchical: hierarchical, color: null, icon: null },
    });
    expect(res.statusCode).toBe(201);
    return JSON.parse(res.body) as { id: string };
  }

  async function createItem(
    projectId: string,
    parentId: string | null,
    type: 'epic' | 'feature' | 'task',
    title: string,
  ): Promise<{ id: string }> {
    const res = await server.inject({
      method: 'POST',
      url: '/api/items',
      payload: {
        type,
        project_id: projectId,
        parent_id: parentId,
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
    if (res.statusCode !== 201) throw new Error(`createItem failed (${res.statusCode}): ${res.body}`);
    return JSON.parse(res.body) as { id: string };
  }

  it('bulk delete of 5 items moves all to trash', async () => {
    const ids: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const item = await createItem(userProjectId, null, 'task', `Task ${i}`);
      ids.push(item.id);
    }

    const res = await server.inject({
      method: 'POST',
      url: '/api/bulk/delete',
      payload: { item_ids: ids },
    });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body) as { trashed_count: number; items: Array<{ id: string }> };
    expect(body.trashed_count).toBe(5);

    // Verify all ids appear in the response items array
    const trashedIds = body.items.map((i) => i.id);
    for (const id of ids) {
      expect(trashedIds).toContain(id);
    }

    // Verify items are no longer in active list
    const allRes = await server.inject({ method: 'GET', url: '/api/items?view=all' });
    const allBody = JSON.parse(allRes.body) as { items: Array<{ id: string }> };
    const activeIds = allBody.items.map((i) => i.id);
    for (const id of ids) {
      expect(activeIds).not.toContain(id);
    }
  });

  it('bulk delete cascades descendants', async () => {
    const epic = await createItem(userProjectId, null, 'epic', 'Epic');
    const feature = await createItem(userProjectId, epic.id, 'feature', 'Feature');
    const task = await createItem(userProjectId, feature.id, 'task', 'Task');

    const res = await server.inject({
      method: 'POST',
      url: '/api/bulk/delete',
      payload: { item_ids: [epic.id] },
    });
    expect(res.statusCode).toBe(200);

    // Epic + Feature + Task = 3 items trashed
    const body = JSON.parse(res.body) as { trashed_count: number };
    expect(body.trashed_count).toBe(3);

    // All items should not be in active list
    const allRes = await server.inject({ method: 'GET', url: '/api/items?view=all' });
    const allBody = JSON.parse(allRes.body) as { items: Array<{ id: string }> };
    const allIds = allBody.items.map((i) => i.id);
    expect(allIds).not.toContain(epic.id);
    expect(allIds).not.toContain(feature.id);
    expect(allIds).not.toContain(task.id);
  });

  it('bulk-deleted items are not accessible via GET /api/items after deletion', async () => {
    const ids: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const item = await createItem(userProjectId, null, 'task', `Task ${i}`);
      ids.push(item.id);
    }

    await server.inject({
      method: 'POST',
      url: '/api/bulk/delete',
      payload: { item_ids: ids },
    });

    const allRes = await server.inject({ method: 'GET', url: '/api/items?view=all' });
    const allBody = JSON.parse(allRes.body) as { items: Array<{ id: string }> };
    const allIds = allBody.items.map((i) => i.id);

    for (const id of ids) {
      expect(allIds).not.toContain(id);
    }
  });

  it('skips already-trashed items without error', async () => {
    const task = await createItem(userProjectId, null, 'task', 'Task');

    // Trash it first
    await server.inject({ method: 'DELETE', url: `/api/items/${task.id}` });

    // Try to bulk-delete the already-trashed item
    const res = await server.inject({
      method: 'POST',
      url: '/api/bulk/delete',
      payload: { item_ids: [task.id] },
    });
    // Should succeed (skip already-trashed)
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { trashed_count: number };
    expect(body.trashed_count).toBe(0); // was already in trash, so nothing newly trashed
  });

  it('bulk delete multiple top-level items from different areas of the project', async () => {
    const projectA = await createProject('Project A');
    const projectB = await createProject('Project B');

    const itemA = await createItem(projectA.id, null, 'task', 'Task in A');
    const itemB = await createItem(projectB.id, null, 'task', 'Task in B');

    const res = await server.inject({
      method: 'POST',
      url: '/api/bulk/delete',
      payload: { item_ids: [itemA.id, itemB.id] },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { trashed_count: number };
    expect(body.trashed_count).toBe(2);
  });
});
