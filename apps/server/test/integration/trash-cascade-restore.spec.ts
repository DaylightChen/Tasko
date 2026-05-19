/**
 * trash-cascade-restore.spec.ts
 *
 * Covers:
 * - POST /api/items/:id/restore on an Epic restores all cascade descendants
 *   (those with trashed_with: Epic.id).
 * - Items that were independently trashed (trashed_with: null) STAY in trash.
 * - Restored items are accessible via /api/items.
 * - Restored items no longer appear in /api/trash.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';

describe('trash cascade restore', () => {
  let dataDir: string;
  let server: FastifyInstance;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'tasko-trash-restore-'));
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

  it('restoring a trashed Epic restores all its cascade descendants', async () => {
    const project = await createProject('Test Project');
    const epic = await createItem(project.id, null, 'epic', 'Epic');
    const feature = await createItem(project.id, epic.id, 'feature', 'Feature');
    const task = await createItem(project.id, feature.id, 'task', 'Task');

    // Trash the epic (cascades feature + task)
    await server.inject({ method: 'DELETE', url: `/api/items/${epic.id}` });

    // Restore the epic
    const restoreRes = await server.inject({ method: 'POST', url: `/api/items/${epic.id}/restore` });
    expect(restoreRes.statusCode).toBe(200);

    const body = JSON.parse(restoreRes.body) as { restored: Array<{ id: string }> };
    expect(body.restored).toHaveLength(3);

    const restoredIds = body.restored.map((i) => i.id);
    expect(restoredIds).toContain(epic.id);
    expect(restoredIds).toContain(feature.id);
    expect(restoredIds).toContain(task.id);
  });

  it('restored items are accessible via /api/items and have trashed_at: null', async () => {
    const project = await createProject('Test Project');
    const epic = await createItem(project.id, null, 'epic', 'Epic');
    const feature = await createItem(project.id, epic.id, 'feature', 'Feature');

    await server.inject({ method: 'DELETE', url: `/api/items/${epic.id}` });
    await server.inject({ method: 'POST', url: `/api/items/${epic.id}/restore` });

    const epicGet = await server.inject({ method: 'GET', url: `/api/items/${epic.id}` });
    expect(epicGet.statusCode).toBe(200);
    const epicBody = JSON.parse(epicGet.body) as { trashed_at: string | null; trashed_with: string | null };
    expect(epicBody.trashed_at).toBeNull();
    expect(epicBody.trashed_with).toBeNull();

    const featureGet = await server.inject({ method: 'GET', url: `/api/items/${feature.id}` });
    expect(featureGet.statusCode).toBe(200);
    const featureBody = JSON.parse(featureGet.body) as {
      trashed_at: string | null;
      trashed_with: string | null;
    };
    expect(featureBody.trashed_at).toBeNull();
    expect(featureBody.trashed_with).toBeNull();
  });

  it('restored items no longer appear in /api/trash', async () => {
    const project = await createProject('Test Project');
    const epic = await createItem(project.id, null, 'epic', 'Epic');
    const feature = await createItem(project.id, epic.id, 'feature', 'Feature');

    await server.inject({ method: 'DELETE', url: `/api/items/${epic.id}` });
    await server.inject({ method: 'POST', url: `/api/items/${epic.id}/restore` });

    const trashRes = await server.inject({ method: 'GET', url: '/api/trash?flat=true' });
    const { items } = JSON.parse(trashRes.body) as { items: Array<{ id: string }> };
    const trashIds = items.map((i) => i.id);

    expect(trashIds).not.toContain(epic.id);
    expect(trashIds).not.toContain(feature.id);
  });

  it('independently trashed items (trashed_with: null) STAY in trash when Epic is restored', async () => {
    const project = await createProject('Test Project');

    // Independently trash a separate item first
    const independent = await createItem(project.id, null, 'task', 'Independent Task');
    await server.inject({ method: 'DELETE', url: `/api/items/${independent.id}` });

    // Trash epic (cascades feature)
    const epic = await createItem(project.id, null, 'epic', 'Epic');
    const feature = await createItem(project.id, epic.id, 'feature', 'Feature');
    await server.inject({ method: 'DELETE', url: `/api/items/${epic.id}` });

    // Restore only the epic
    await server.inject({ method: 'POST', url: `/api/items/${epic.id}/restore` });

    // Independent item must still be in trash
    const trashRes = await server.inject({ method: 'GET', url: '/api/trash?flat=true' });
    const { items } = JSON.parse(trashRes.body) as { items: Array<{ id: string }> };
    const trashIds = items.map((i) => i.id);

    expect(trashIds).toContain(independent.id);
    expect(trashIds).not.toContain(epic.id);
    expect(trashIds).not.toContain(feature.id);
  });

  it('404 when restoring an item that is not in trash', async () => {
    const project = await createProject('Test Project');
    const task = await createItem(project.id, null, 'task', 'Active Task');

    const res = await server.inject({ method: 'POST', url: `/api/items/${task.id}/restore` });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body) as { error: { code: string } };
    expect(body.error.code).toBe('ITEM_NOT_FOUND');
  });
});
