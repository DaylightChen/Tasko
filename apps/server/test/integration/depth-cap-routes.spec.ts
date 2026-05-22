/**
 * Integration tests — depth-cap enforcement in HTTP routes.
 *
 * Covers:
 * - POST /api/items that would create a level-5 item → 409 DEPTH_CAP
 * - PATCH /api/items/:id with parent_id that would violate depth cap → 409 DEPTH_CAP
 * - POST /api/items/:id/move with new_parent_id that violates cap → 409 DEPTH_CAP
 * - Cycle attempt via POST /api/items/:id/move → 409 with 'Cannot place under own descendant.'
 * - Valid re-parent within cap → 200 OK
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';

describe('depth-cap route enforcement', () => {
  let dataDir: string;
  let server: FastifyInstance;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'tasko-depth-cap-'));
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
    if (res.statusCode !== 201) {
      throw new Error(`createItem failed (${res.statusCode}): ${res.body}`);
    }
    return JSON.parse(res.body) as { id: string };
  }

  // Build a 3-level chain in a project: epic → feature → task
  // Returns { projectId, epicId, featureId, taskId }
  async function buildThreeLevelChain() {
    const project = await createProject('Depth Cap Project');
    const epic = await createItem(project.id, null, 'epic', 'Epic L1');
    const feature = await createItem(project.id, epic.id, 'feature', 'Feature L2');
    const task = await createItem(project.id, feature.id, 'task', 'Task L3');
    return { projectId: project.id, epicId: epic.id, featureId: feature.id, taskId: task.id };
  }

  // ─── POST /api/items depth-cap rejection ────────────────────────────────────

  it('POST /api/items rejects creating a level-5 item (task under task under feature under epic)', async () => {
    const { projectId, taskId } = await buildThreeLevelChain();

    // task is at level 3. Creating another task under it → level 4 (ok).
    // But if we add a task (with subtask) scenario we need to exceed.
    // Instead: create a task at level 4 first, then try task at level 5.
    const taskL4 = await createItem(projectId, taskId, 'task', 'Task L4');

    // Now try to create level 5 task under taskL4
    const res = await server.inject({
      method: 'POST',
      url: '/api/items',
      payload: {
        type: 'task',
        project_id: projectId,
        parent_id: taskL4.id,
        title: 'Task L5 (should fail)',
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

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('DEPTH_CAP');
    expect(typeof body.error.message).toBe('string');
    expect(body.error.message.length).toBeGreaterThan(0);
  });

  it('POST /api/items allows creating a task at exactly level 4', async () => {
    const { projectId, taskId } = await buildThreeLevelChain();

    // task is at L3. Adding a child task → L4, which equals the cap.
    const res = await server.inject({
      method: 'POST',
      url: '/api/items',
      payload: {
        type: 'task',
        project_id: projectId,
        parent_id: taskId,
        title: 'Task L4 (allowed)',
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

    expect(res.statusCode).toBe(201);
  });

  it('POST /api/items rejects placing a Feature (with children) deeper than allowed', async () => {
    // Build: epic(L1) → feature(L2) → task(L3). Try to move feature under task (which becomes L4)
    // Actually for POST we build a Feature with a child task already, then try to create it under a deep parent.
    // Simpler: create epic → feature → task → (feature_with_task already at L3 would be added as L4 feature,
    // and that feature's task would be L5).
    // Let's build: projectB with epic→feat→task at L3, then try to POST a feature under task (non-task parent check).
    const projB = await createProject('Project B');
    const epicB = await createItem(projB.id, null, 'epic', 'Epic B');
    const featB = await createItem(projB.id, epicB.id, 'feature', 'Feature B');
    const taskB = await createItem(projB.id, featB.id, 'task', 'Task B L3');
    // Task is already at level 3. A feature cannot attach to a task (subtask rule).
    const res = await server.inject({
      method: 'POST',
      url: '/api/items',
      payload: {
        type: 'feature',
        project_id: projB.id,
        parent_id: taskB.id,
        title: 'Feature under Task (should fail)',
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
    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('DEPTH_CAP');
    expect(body.error.message).toMatch(/Only subtasks may attach to a Task/i);
  });

  // ─── PATCH /api/items/:id depth-cap rejection ────────────────────────────────

  it('PATCH /api/items/:id with parent_id rejects when the move would exceed depth cap', async () => {
    const { projectId, taskId } = await buildThreeLevelChain();

    // task is at L3. Create an isolated task (L1).
    const isolatedTask = await createItem(projectId, null, 'task', 'Isolated Task');

    // Create a child task under the L3 task to make it L4
    const taskL4 = await createItem(projectId, taskId, 'task', 'Task L4');

    // Now patch isolatedTask to be placed under taskL4 (would be L5)
    const res = await server.inject({
      method: 'PATCH',
      url: `/api/items/${isolatedTask.id}`,
      payload: { parent_id: taskL4.id },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('DEPTH_CAP');
    expect(typeof body.error.message).toBe('string');
  });

  it('PATCH /api/items/:id allows a valid re-parent within the cap', async () => {
    const { projectId, epicId, featureId } = await buildThreeLevelChain();

    // Create another feature at top level
    const anotherFeature = await createItem(projectId, null, 'feature', 'Feature L1');

    // Move it under the epic (becomes L2) → valid
    const res = await server.inject({
      method: 'PATCH',
      url: `/api/items/${anotherFeature.id}`,
      payload: { parent_id: epicId },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as Record<string, unknown>;
    expect(body.parent_id).toBe(epicId);
    void featureId; // suppress unused warning
  });

  // ─── POST /api/items/:id/move depth-cap rejection ────────────────────────────

  it('POST /api/items/:id/move rejects when the re-parent would violate depth cap', async () => {
    const { projectId, taskId } = await buildThreeLevelChain();

    const taskL4 = await createItem(projectId, taskId, 'task', 'Task L4');
    const floatingTask = await createItem(projectId, null, 'task', 'Floating Task');

    // Move floatingTask to be under taskL4 → would be L5
    const res = await server.inject({
      method: 'POST',
      url: `/api/items/${floatingTask.id}/move`,
      payload: { new_parent_id: taskL4.id },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('DEPTH_CAP');
    expect(typeof body.error.message).toBe('string');
  });

  it('POST /api/items/:id/move rejects a cycle (placing a parent under its descendant)', async () => {
    // Build: epic → feature
    const project = await createProject('Cycle Project');
    const epic = await createItem(project.id, null, 'epic', 'Epic');
    const feature = await createItem(project.id, epic.id, 'feature', 'Feature');

    // Try to move the epic under the feature (placing it under its own descendant)
    const res = await server.inject({
      method: 'POST',
      url: `/api/items/${epic.id}/move`,
      payload: { new_parent_id: feature.id },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('DEPTH_CAP');
    expect(body.error.message).toBe('Cannot place under own descendant.');
  });

  it('POST /api/items/:id/move allows a valid move', async () => {
    const { projectId, epicId, featureId } = await buildThreeLevelChain();

    // Create a loose feature at root
    const looseFeature = await createItem(projectId, null, 'feature', 'Loose Feature');

    // Move it under the epic (valid: L2)
    const res = await server.inject({
      method: 'POST',
      url: `/api/items/${looseFeature.id}/move`,
      payload: { new_parent_id: epicId },
    });

    expect(res.statusCode).toBe(200);
    void featureId; // suppress unused
  });
});
