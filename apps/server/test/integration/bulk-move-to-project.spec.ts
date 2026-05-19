/**
 * bulk-move-to-project.spec.ts
 *
 * Covers:
 * - POST /api/bulk/move-to-project moves N items from Project A to Project B.
 * - All items' project_id is updated to new project.
 * - Descendants also follow (cascade project_id update).
 * - Returns { moved_count, items }.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';

describe('bulk move to project', () => {
  let dataDir: string;
  let server: FastifyInstance;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'tasko-bulk-move-project-'));
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

  async function createProject(name: string, hierarchical = false): Promise<{ id: string }> {
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

  it('moves 3 items from Project A to Project B', async () => {
    const projectA = await createProject('Project A');
    const projectB = await createProject('Project B');

    const item1 = await createItem(projectA.id, null, 'task', 'Task 1');
    const item2 = await createItem(projectA.id, null, 'task', 'Task 2');
    const item3 = await createItem(projectA.id, null, 'task', 'Task 3');

    const res = await server.inject({
      method: 'POST',
      url: '/api/bulk/move-to-project',
      payload: {
        item_ids: [item1.id, item2.id, item3.id],
        new_project_id: projectB.id,
      },
    });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body) as {
      moved_count: number;
      items: Array<{ id: string; project_id: string }>;
    };
    expect(body.moved_count).toBe(3);

    // Verify via GET
    for (const id of [item1.id, item2.id, item3.id]) {
      const r = await server.inject({ method: 'GET', url: `/api/items/${id}` });
      const item = JSON.parse(r.body) as { project_id: string };
      expect(item.project_id).toBe(projectB.id);
    }
  });

  it('descendants follow their parents when moved to a new project', async () => {
    const projectA = await createProject('Project A', true);
    const projectB = await createProject('Project B', true);

    const epic = await createItem(projectA.id, null, 'epic', 'Epic');
    const feature = await createItem(projectA.id, epic.id, 'feature', 'Feature');
    const task = await createItem(projectA.id, feature.id, 'task', 'Task');

    const res = await server.inject({
      method: 'POST',
      url: '/api/bulk/move-to-project',
      payload: {
        item_ids: [epic.id],
        new_project_id: projectB.id,
      },
    });
    expect(res.statusCode).toBe(200);

    // Feature and Task should also have project_id = projectB
    const featureGet = await server.inject({ method: 'GET', url: `/api/items/${feature.id}` });
    expect((JSON.parse(featureGet.body) as { project_id: string }).project_id).toBe(projectB.id);

    const taskGet = await server.inject({ method: 'GET', url: `/api/items/${task.id}` });
    expect((JSON.parse(taskGet.body) as { project_id: string }).project_id).toBe(projectB.id);
  });

  it('returns 404 PROJECT_NOT_FOUND when new_project_id does not exist', async () => {
    const projectA = await createProject('Project A');
    const task = await createItem(projectA.id, null, 'task', 'Task');

    const res = await server.inject({
      method: 'POST',
      url: '/api/bulk/move-to-project',
      payload: {
        item_ids: [task.id],
        new_project_id: '01NONEXISTENT000000000000',
      },
    });
    expect(res.statusCode).toBe(404);
  });

  it('items not in item_ids are not moved', async () => {
    const projectA = await createProject('Project A');
    const projectB = await createProject('Project B');

    const task1 = await createItem(projectA.id, null, 'task', 'Task 1');
    const task2 = await createItem(projectA.id, null, 'task', 'Task 2');
    const task3 = await createItem(projectA.id, null, 'task', 'Task 3 (stays)');

    // Only move task1 and task2
    await server.inject({
      method: 'POST',
      url: '/api/bulk/move-to-project',
      payload: {
        item_ids: [task1.id, task2.id],
        new_project_id: projectB.id,
      },
    });

    // task3 should still be in projectA
    const task3Get = await server.inject({ method: 'GET', url: `/api/items/${task3.id}` });
    expect((JSON.parse(task3Get.body) as { project_id: string }).project_id).toBe(projectA.id);
  });
});
