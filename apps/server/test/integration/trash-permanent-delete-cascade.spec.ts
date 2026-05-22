/**
 * trash-permanent-delete-cascade.spec.ts
 *
 * Covers:
 * - DELETE /api/items/:id?permanent=true on a trashed Epic removes the Epic
 *   AND all cascade descendants (trashed_with: Epic.id) from trash.
 * - All files removed from trash/ directory.
 * - 400 VALIDATION when trying to permanently delete an active (non-trashed) item.
 * - 204 status on success.
 */
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';

describe('trash permanent delete cascade', () => {
  let dataDir: string;
  let server: FastifyInstance;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'tasko-perm-delete-'));
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

  async function createProject(name: string): Promise<{ id: string }> {
    const res = await server.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name, folder_id: null, is_hierarchical: true, color: null, icon: null },
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

  async function trashFileCount(): Promise<number> {
    const trashDir = join(dataDir, 'trash');
    try {
      const files = await readdir(trashDir);
      return files.filter((f) => f.endsWith('.json')).length;
    } catch {
      return 0;
    }
  }

  it('permanent delete of trashed Epic removes Epic and all cascade descendants', async () => {
    const project = await createProject('Test Project');
    const epic = await createItem(project.id, null, 'epic', 'Epic');
    const feature = await createItem(project.id, epic.id, 'feature', 'Feature');
    const task = await createItem(project.id, feature.id, 'task', 'Task');

    // Trash the Epic (cascades feature + task)
    await server.inject({ method: 'DELETE', url: `/api/items/${epic.id}` });

    const countBefore = await trashFileCount();
    expect(countBefore).toBe(3);

    // Permanently delete the Epic
    const res = await server.inject({ method: 'DELETE', url: `/api/items/${epic.id}?permanent=true` });
    expect(res.statusCode).toBe(204);

    const countAfter = await trashFileCount();
    expect(countAfter).toBe(0);
  });

  it('after permanent delete of Epic, none of its descendants are accessible', async () => {
    const project = await createProject('Test Project');
    const epic = await createItem(project.id, null, 'epic', 'Epic');
    const feature = await createItem(project.id, epic.id, 'feature', 'Feature');
    const task = await createItem(project.id, feature.id, 'task', 'Task');

    await server.inject({ method: 'DELETE', url: `/api/items/${epic.id}` });
    await server.inject({ method: 'DELETE', url: `/api/items/${epic.id}?permanent=true` });

    // None should be in active items
    const epicCheck = await server.inject({ method: 'GET', url: `/api/items/${epic.id}` });
    expect(epicCheck.statusCode).toBe(404);

    // None should be in trash
    const trashRes = await server.inject({ method: 'GET', url: '/api/trash?flat=true' });
    const { items } = JSON.parse(trashRes.body) as { items: Array<{ id: string }> };
    const ids = items.map((i) => i.id);

    expect(ids).not.toContain(epic.id);
    expect(ids).not.toContain(feature.id);
    expect(ids).not.toContain(task.id);
  });

  it('permanent delete returns 400 VALIDATION when item is not in trash', async () => {
    const project = await createProject('Test Project');
    const task = await createItem(project.id, null, 'task', 'Active Task');

    const res = await server.inject({ method: 'DELETE', url: `/api/items/${task.id}?permanent=true` });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('VALIDATION');
    expect(body.error.message).toBe('Item must be in Trash before permanent deletion.');
  });

  it('permanent delete of Epic does not affect independently-trashed items', async () => {
    const project = await createProject('Test Project');

    // Trash an independent task
    const independent = await createItem(project.id, null, 'task', 'Independent Task');
    await server.inject({ method: 'DELETE', url: `/api/items/${independent.id}` });

    // Trash Epic with a child
    const epic = await createItem(project.id, null, 'epic', 'Epic');
    const feature = await createItem(project.id, epic.id, 'feature', 'Feature');
    await server.inject({ method: 'DELETE', url: `/api/items/${epic.id}` });

    // Permanently delete the Epic
    await server.inject({ method: 'DELETE', url: `/api/items/${epic.id}?permanent=true` });

    // Independent task should still be in trash
    const trashRes = await server.inject({ method: 'GET', url: '/api/trash?flat=true' });
    const { items } = JSON.parse(trashRes.body) as { items: Array<{ id: string }> };
    const ids = items.map((i) => i.id);

    expect(ids).toContain(independent.id);
    expect(ids).not.toContain(epic.id);
    expect(ids).not.toContain(feature.id);
  });
});
