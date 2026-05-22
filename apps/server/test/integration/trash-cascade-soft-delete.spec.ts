/**
 * trash-cascade-soft-delete.spec.ts
 *
 * Covers:
 * - DELETE /api/items/:id (soft) on an Epic with Feature+Task descendants
 *   cascades all items to trash.
 * - Root item has trashed_with: null; descendants have trashed_with: Epic.id.
 * - Root and descendants are no longer in active items index.
 * - Files moved to trash/ directory on disk.
 */
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INBOX_PROJECT_ID } from '@tasko/types';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';

describe('trash cascade soft-delete', () => {
  let dataDir: string;
  let server: FastifyInstance;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'tasko-trash-cascade-'));
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

  async function trashFiles(): Promise<string[]> {
    const trashDir = join(dataDir, 'trash');
    try {
      const files = await readdir(trashDir);
      return files.filter((f) => f.endsWith('.json'));
    } catch {
      return [];
    }
  }

  async function activeItemFiles(): Promise<string[]> {
    const itemsDir = join(dataDir, 'items');
    try {
      const files = await readdir(itemsDir);
      return files.filter((f) => f.endsWith('.json'));
    } catch {
      return [];
    }
  }

  it('soft-deleting an Epic cascades Feature and Task into trash', async () => {
    const project = await createProject('Test Project');
    const epic = await createItem(project.id, null, 'epic', 'Epic L1');
    const feature = await createItem(project.id, epic.id, 'feature', 'Feature L2');
    const task = await createItem(project.id, feature.id, 'task', 'Task L3');

    const res = await server.inject({ method: 'DELETE', url: `/api/items/${epic.id}` });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body) as { trashed: unknown[] };
    expect(Array.isArray(body.trashed)).toBe(true);
    // Should contain Epic + Feature + Task = 3 items
    expect(body.trashed).toHaveLength(3);

    // IDs present in trashed array
    const trashedIds = (body.trashed as { id: string }[]).map((i) => i.id);
    expect(trashedIds).toContain(epic.id);
    expect(trashedIds).toContain(feature.id);
    expect(trashedIds).toContain(task.id);
  });

  it('root item has trashed_with: null', async () => {
    const project = await createProject('Test Project');
    const epic = await createItem(project.id, null, 'epic', 'Epic');
    await createItem(project.id, epic.id, 'feature', 'Feature');

    await server.inject({ method: 'DELETE', url: `/api/items/${epic.id}` });

    // Verify via GET /api/trash
    const trashRes = await server.inject({ method: 'GET', url: '/api/trash?flat=true' });
    expect(trashRes.statusCode).toBe(200);
    const { items } = JSON.parse(trashRes.body) as {
      items: Array<{ id: string; trashed_with: string | null }>;
    };

    const epicTrash = items.find((i) => i.id === epic.id);
    expect(epicTrash).toBeDefined();
    expect(epicTrash?.trashed_with).toBeNull();
  });

  it('descendants have trashed_with set to Epic.id', async () => {
    const project = await createProject('Test Project');
    const epic = await createItem(project.id, null, 'epic', 'Epic');
    const feature = await createItem(project.id, epic.id, 'feature', 'Feature');
    const task = await createItem(project.id, feature.id, 'task', 'Task');

    await server.inject({ method: 'DELETE', url: `/api/items/${epic.id}` });

    const trashRes = await server.inject({ method: 'GET', url: '/api/trash?flat=true' });
    const { items } = JSON.parse(trashRes.body) as {
      items: Array<{ id: string; trashed_with: string | null }>;
    };

    const featureTrash = items.find((i) => i.id === feature.id);
    const taskTrash = items.find((i) => i.id === task.id);

    expect(featureTrash?.trashed_with).toBe(epic.id);
    expect(taskTrash?.trashed_with).toBe(epic.id);
  });

  it('active items index no longer contains any of the trashed items', async () => {
    const project = await createProject('Test Project');
    const epic = await createItem(project.id, null, 'epic', 'Epic');
    const feature = await createItem(project.id, epic.id, 'feature', 'Feature');
    const task = await createItem(project.id, feature.id, 'task', 'Task');

    await server.inject({ method: 'DELETE', url: `/api/items/${epic.id}` });

    // GET /api/items?view=all should not include any of these
    const allRes = await server.inject({ method: 'GET', url: '/api/items?view=all' });
    const allBody = JSON.parse(allRes.body) as { items: Array<{ id: string }> };
    const allIds = allBody.items.map((i) => i.id);

    expect(allIds).not.toContain(epic.id);
    expect(allIds).not.toContain(feature.id);
    expect(allIds).not.toContain(task.id);
  });

  it('trash files exist on disk for all cascade-deleted items', async () => {
    const project = await createProject('Test Project');
    const epic = await createItem(project.id, null, 'epic', 'Epic');
    const feature = await createItem(project.id, epic.id, 'feature', 'Feature');
    const task = await createItem(project.id, feature.id, 'task', 'Task');

    const before = await trashFiles();
    expect(before).toHaveLength(0);

    await server.inject({ method: 'DELETE', url: `/api/items/${epic.id}` });

    const after = await trashFiles();
    expect(after).toHaveLength(3);
    expect(after.some((f) => f.includes(epic.id))).toBe(true);
    expect(after.some((f) => f.includes(feature.id))).toBe(true);
    expect(after.some((f) => f.includes(task.id))).toBe(true);

    // Active items directory should be empty
    const active = await activeItemFiles();
    expect(active).toHaveLength(0);
  });

  it('independently trashed items (trashed_with: null) not affected when trashing a different Epic', async () => {
    const project = await createProject('Test Project');

    // Independently trash one task first
    const independent = await createItem(project.id, null, 'task', 'Independent Task');
    await server.inject({ method: 'DELETE', url: `/api/items/${independent.id}` });

    // Now trash Epic with a child
    const epic = await createItem(project.id, null, 'epic', 'Epic');
    const feature = await createItem(project.id, epic.id, 'feature', 'Feature');
    await server.inject({ method: 'DELETE', url: `/api/items/${epic.id}` });

    const trashRes = await server.inject({ method: 'GET', url: '/api/trash?flat=true' });
    const { items } = JSON.parse(trashRes.body) as {
      items: Array<{ id: string; trashed_with: string | null }>;
    };

    // Independent item trashed_with stays null
    const indItem = items.find((i) => i.id === independent.id);
    expect(indItem?.trashed_with).toBeNull();

    // Feature trashed_with points to epic
    const featItem = items.find((i) => i.id === feature.id);
    expect(featItem?.trashed_with).toBe(epic.id);
  });

  it('soft-deleting single item (no descendants) returns trashed array of length 1 with trashed_with: null', async () => {
    const task = await createItem(INBOX_PROJECT_ID, null, 'task', 'Solo Task');

    const res = await server.inject({ method: 'DELETE', url: `/api/items/${task.id}` });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body) as { trashed: Array<{ trashed_with: string | null }> };
    expect(body.trashed).toHaveLength(1);
    expect(body.trashed[0]?.trashed_with).toBeNull();
  });
});
