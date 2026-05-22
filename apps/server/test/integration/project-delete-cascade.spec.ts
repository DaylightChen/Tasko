/**
 * project-delete-cascade.spec.ts
 *
 * Covers:
 * - DELETE /api/projects/:id cascades all active items to trash with
 *   trashed_with: <project.id>.
 * - Project file removed from projects/ directory.
 * - Returns { deleted_project_id, trashed_items: count }.
 * - DELETE /api/projects/:id on Inbox → 409 INBOX_IMMUTABLE.
 */
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INBOX_PROJECT_ID } from '@tasko/types';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';

describe('project delete cascade', () => {
  let dataDir: string;
  let server: FastifyInstance;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'tasko-project-delete-'));
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

  async function projectFileCount(): Promise<number> {
    const projectsDir = join(dataDir, 'projects');
    try {
      const files = await readdir(projectsDir);
      return files.filter((f) => f.endsWith('.json')).length;
    } catch {
      return 0;
    }
  }

  it('deleting a project moves all its items to trash with trashed_with: <project.id>', async () => {
    const project = await createProject('Work');
    const task1 = await createItem(project.id, null, 'task', 'Task 1');
    const task2 = await createItem(project.id, null, 'task', 'Task 2');
    const epic = await createItem(project.id, null, 'epic', 'Epic');
    const feature = await createItem(project.id, epic.id, 'feature', 'Feature');
    const task3 = await createItem(project.id, feature.id, 'task', 'Task 3');

    const res = await server.inject({ method: 'DELETE', url: `/api/projects/${project.id}` });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body) as { deleted_project_id: string; trashed_items: number };
    expect(body.deleted_project_id).toBe(project.id);
    expect(body.trashed_items).toBe(5); // task1, task2, epic, feature, task3

    // All items should be in trash with trashed_with: project.id
    const trashRes = await server.inject({ method: 'GET', url: '/api/trash?flat=true' });
    const { items } = JSON.parse(trashRes.body) as {
      items: Array<{ id: string; trashed_with: string | null }>;
    };

    const projectItems = [task1.id, task2.id, epic.id, feature.id, task3.id];
    for (const id of projectItems) {
      const trashItem = items.find((i) => i.id === id);
      expect(trashItem, `Item ${id} should be in trash`).toBeDefined();
      expect(trashItem?.trashed_with).toBe(project.id);
    }
  });

  it('project file is removed from disk after deletion', async () => {
    const project = await createProject('Work');
    await createItem(project.id, null, 'task', 'Task 1');

    const countBefore = await projectFileCount();

    await server.inject({ method: 'DELETE', url: `/api/projects/${project.id}` });

    const countAfter = await projectFileCount();
    // One fewer project file (Inbox is not a file in this setup, only user projects)
    expect(countAfter).toBe(countBefore - 1);
  });

  it('project no longer accessible via GET /api/projects after deletion', async () => {
    const project = await createProject('Work');
    await server.inject({ method: 'DELETE', url: `/api/projects/${project.id}` });

    const projectsRes = await server.inject({ method: 'GET', url: '/api/projects' });
    const { projects } = JSON.parse(projectsRes.body) as { projects: Array<{ id: string }> };
    expect(projects.find((p) => p.id === project.id)).toBeUndefined();
  });

  it('Inbox deletion → 409 INBOX_IMMUTABLE', async () => {
    const res = await server.inject({ method: 'DELETE', url: `/api/projects/${INBOX_PROJECT_ID}` });
    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body) as { error: { code: string } };
    expect(body.error.code).toBe('INBOX_IMMUTABLE');
  });

  it('deleting project with 0 items returns trashed_items: 0', async () => {
    const project = await createProject('Empty Project');

    const res = await server.inject({ method: 'DELETE', url: `/api/projects/${project.id}` });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body) as { trashed_items: number };
    expect(body.trashed_items).toBe(0);
  });

  it('items from other projects are not affected when deleting a project', async () => {
    const projectA = await createProject('Project A');
    const projectB = await createProject('Project B');

    const taskA = await createItem(projectA.id, null, 'task', 'Task in A');
    const taskB = await createItem(projectB.id, null, 'task', 'Task in B');

    await server.inject({ method: 'DELETE', url: `/api/projects/${projectA.id}` });

    // Task in B should still be active
    const taskBGet = await server.inject({ method: 'GET', url: `/api/items/${taskB.id}` });
    expect(taskBGet.statusCode).toBe(200);

    // Task in A should be in trash
    const trashRes = await server.inject({ method: 'GET', url: '/api/trash?flat=true' });
    const { items } = JSON.parse(trashRes.body) as { items: Array<{ id: string }> };
    expect(items.find((i) => i.id === taskA.id)).toBeDefined();
    expect(items.find((i) => i.id === taskB.id)).toBeUndefined();
  });
});
