/**
 * bulk-move-to-project-depth-cap-reject.spec.ts
 *
 * Covers:
 * - When any item in the batch would exceed the depth cap under the new parent,
 *   the whole batch is rejected with 409 DEPTH_CAP.
 * - NONE of the items are moved (transactional behavior).
 * - The error includes details listing which item failed.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';

describe('bulk move to project — depth cap rejection', () => {
  let dataDir: string;
  let server: FastifyInstance;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'tasko-bulk-depth-cap-'));
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

  it('rejects entire batch with 409 DEPTH_CAP when one item would exceed nesting cap', async () => {
    // Build a target project with a deep hierarchy:
    // Target: epic (L1) → feature (L2) → task (L3) → taskL4 (L4)
    // We want to move an item that has a child into taskL4 (so child would be L6 — exceeds cap of L4).
    const targetProject = await createProject('Target Project');
    const targetEpic = await createItem(targetProject.id, null, 'epic', 'Target Epic');
    const targetFeature = await createItem(targetProject.id, targetEpic.id, 'feature', 'Target Feature');
    const targetTask = await createItem(targetProject.id, targetFeature.id, 'task', 'Target Task');
    const targetL4 = await createItem(targetProject.id, targetTask.id, 'task', 'Target L4');

    // Source items: a safe task and a task-with-child
    // Moving task-with-child to targetL4 (L4 parent) would put task at L5 — exceeds cap of 4
    const sourceProject = await createProject('Source Project');
    const safeTask = await createItem(sourceProject.id, null, 'task', 'Safe Task');
    const parentTask = await createItem(sourceProject.id, null, 'task', 'Parent Task (will violate)');
    const childTask = await createItem(sourceProject.id, parentTask.id, 'task', 'Child Task');
    void childTask;

    // Try to move both safeTask and parentTask into targetL4
    // parentTask has a child, so moving it to targetL4 (depth 4) would put parentTask at depth 5
    const res = await server.inject({
      method: 'POST',
      url: '/api/bulk/move-to-project',
      payload: {
        item_ids: [safeTask.id, parentTask.id],
        new_project_id: targetProject.id,
        new_parent_id: targetL4.id,
      },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body) as { error: { code: string; message: string; details?: unknown } };
    expect(body.error.code).toBe('DEPTH_CAP');
    expect(typeof body.error.message).toBe('string');
  });

  it('none of the items are moved when batch is rejected (transactional)', async () => {
    const targetProject = await createProject('Target Project');
    const targetEpic = await createItem(targetProject.id, null, 'epic', 'Target Epic');
    const targetFeature = await createItem(targetProject.id, targetEpic.id, 'feature', 'Target Feature');
    const targetTask = await createItem(targetProject.id, targetFeature.id, 'task', 'Target Task');
    const targetL4 = await createItem(targetProject.id, targetTask.id, 'task', 'Target L4');

    const sourceProject = await createProject('Source Project');
    const safeTask = await createItem(sourceProject.id, null, 'task', 'Safe Task');
    const parentTask = await createItem(sourceProject.id, null, 'task', 'Parent Task');
    const childTask = await createItem(sourceProject.id, parentTask.id, 'task', 'Child Task');
    void childTask;

    // Attempt the move (should fail)
    await server.inject({
      method: 'POST',
      url: '/api/bulk/move-to-project',
      payload: {
        item_ids: [safeTask.id, parentTask.id],
        new_project_id: targetProject.id,
        new_parent_id: targetL4.id,
      },
    });

    // Verify safeTask is still in sourceProject (not moved despite being individually valid)
    const safeGet = await server.inject({ method: 'GET', url: `/api/items/${safeTask.id}` });
    const safeData = JSON.parse(safeGet.body) as { project_id: string };
    expect(safeData.project_id).toBe(sourceProject.id);

    // Verify parentTask is still in sourceProject
    const parentGet = await server.inject({ method: 'GET', url: `/api/items/${parentTask.id}` });
    const parentData = JSON.parse(parentGet.body) as { project_id: string };
    expect(parentData.project_id).toBe(sourceProject.id);
  });

  it('valid move (all items within cap) succeeds with 200', async () => {
    const projectA = await createProject('Project A');
    const projectB = await createProject('Project B');

    const task1 = await createItem(projectA.id, null, 'task', 'Task 1');
    const task2 = await createItem(projectA.id, null, 'task', 'Task 2');

    const res = await server.inject({
      method: 'POST',
      url: '/api/bulk/move-to-project',
      payload: {
        item_ids: [task1.id, task2.id],
        new_project_id: projectB.id,
      },
    });
    expect(res.statusCode).toBe(200);
  });
});
