import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';

describe('Items cross-project move cascade', () => {
  let dataDir: string;
  let server: FastifyInstance;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'tasko-move-'));
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
    return JSON.parse(res.body) as { id: string };
  }

  async function createItem(
    projectId: string,
    parentId: string | null,
    type: string,
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
        due_date: '2026-05-18',
        start_date: null,
        due_time: null,
        priority: 'none',
        status: 'todo',
        tags: [],
        subtasks: [],
        recurrence: null,
      },
    });
    return JSON.parse(res.body) as { id: string };
  }

  it('cascades project_id to all descendants on PATCH', async () => {
    const projA = await createProject('Project A');
    const projB = await createProject('Project B');

    // Create Epic → Feature → Task in Project A
    const epic = await createItem(projA.id, null, 'epic', 'Epic');
    const feature = await createItem(projA.id, epic.id, 'feature', 'Feature');
    const task = await createItem(projA.id, feature.id, 'task', 'Task');

    // Move the Epic to Project B
    const patchRes = await server.inject({
      method: 'PATCH',
      url: `/api/items/${epic.id}`,
      payload: { project_id: projB.id },
    });
    expect(patchRes.statusCode).toBe(200);

    // Verify Feature also moved
    const featureRes = await server.inject({ method: 'GET', url: `/api/items/${feature.id}` });
    const featureBody = JSON.parse(featureRes.body) as { project_id: string };
    expect(featureBody.project_id).toBe(projB.id);

    // Verify Task also moved
    const taskRes = await server.inject({ method: 'GET', url: `/api/items/${task.id}` });
    const taskBody = JSON.parse(taskRes.body) as { project_id: string };
    expect(taskBody.project_id).toBe(projB.id);
  });

  it('parent_id is preserved after cross-project move', async () => {
    const projA = await createProject('Project A2');
    const projB = await createProject('Project B2');

    const epic = await createItem(projA.id, null, 'epic', 'Epic2');
    const feature = await createItem(projA.id, epic.id, 'feature', 'Feature2');

    await server.inject({
      method: 'PATCH',
      url: `/api/items/${epic.id}`,
      payload: { project_id: projB.id },
    });

    const featureRes = await server.inject({ method: 'GET', url: `/api/items/${feature.id}` });
    const featureBody = JSON.parse(featureRes.body) as { project_id: string; parent_id: string };
    expect(featureBody.project_id).toBe(projB.id);
    expect(featureBody.parent_id).toBe(epic.id);
  });

  it('returns 404 when moving to a non-existent project', async () => {
    const projA = await createProject('Project A3');
    const epic = await createItem(projA.id, null, 'epic', 'Epic3');

    const res = await server.inject({
      method: 'PATCH',
      url: `/api/items/${epic.id}`,
      payload: { project_id: '01HWABCDEFGHJKMNPQRSTVWXYZ' },
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body) as { error: { code: string } };
    expect(body.error.code).toBe('PROJECT_NOT_FOUND');
  });
});
