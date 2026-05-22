import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';

function localDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// view=project, include_completed=false drops items with status='done'. But if
// a done item is on the ancestor path of an active item, the client tree
// builder cannot reach the active item — Task is orphaned in the response.
// The server keeps such done ancestors so the tree remains traversable.
describe('view=project keeps completed ancestors of active descendants', () => {
  let dataDir: string;
  let server: FastifyInstance;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'tasko-ancestors-'));
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

  const baseItem = {
    parent_id: null as string | null,
    notes: '',
    start_date: null,
    due_time: null,
    priority: 'none' as const,
    status: 'todo' as const,
    tags: [],
    subtasks: [],
    recurrence: null,
  };

  async function createItem(overrides: Record<string, unknown>): Promise<{ id: string }> {
    const res = await server.inject({
      method: 'POST',
      url: '/api/items',
      payload: { title: 'Item', ...baseItem, due_date: localDate(0), ...overrides },
    });
    if (res.statusCode !== 201) {
      throw new Error(`createItem failed (${res.statusCode}): ${res.body}`);
    }
    return JSON.parse(res.body) as { id: string };
  }

  async function patchItem(id: string, patch: Record<string, unknown>): Promise<void> {
    await server.inject({ method: 'PATCH', url: `/api/items/${id}`, payload: patch });
  }

  async function listProject(projectId: string): Promise<{ id: string; status: string }[]> {
    const res = await server.inject({
      method: 'GET',
      url: `/api/items?view=project&project_id=${projectId}`,
    });
    const body = JSON.parse(res.body) as { items: { id: string; status: string }[] };
    return body.items;
  }

  it('returns a completed Feature when its Task has been reopened', async () => {
    const proj = await createProject('P');
    const epic = await createItem({ type: 'epic', project_id: proj.id, title: 'Epic 1' });
    const feature = await createItem({
      type: 'feature',
      project_id: proj.id,
      parent_id: epic.id,
      title: 'Feature 1',
    });
    const task = await createItem({
      type: 'task',
      project_id: proj.id,
      parent_id: feature.id,
      title: 'Task 1',
    });

    // Complete Task 1, then complete Feature 1, then reopen Task 1.
    await patchItem(task.id, { status: 'done' });
    await patchItem(feature.id, { status: 'done' });
    await patchItem(task.id, { status: 'todo' });

    const items = await listProject(proj.id);
    const ids = items.map((i) => i.id);

    // Epic 1 is active — must be visible.
    expect(ids).toContain(epic.id);
    // Task 1 is active — must be visible.
    expect(ids).toContain(task.id);
    // Feature 1 is done but is on the path Task 1 -> Epic 1 — must be kept so
    // the tree builder can reach Task 1.
    expect(ids).toContain(feature.id);
    // Feature 1's status is still 'done' — the client renders it dimmed.
    expect(items.find((i) => i.id === feature.id)?.status).toBe('done');
  });

  it('returns a completed Epic + Feature chain when only the Task is active', async () => {
    const proj = await createProject('P');
    const epic = await createItem({ type: 'epic', project_id: proj.id, title: 'Epic' });
    const feature = await createItem({
      type: 'feature',
      project_id: proj.id,
      parent_id: epic.id,
    });
    const task = await createItem({ type: 'task', project_id: proj.id, parent_id: feature.id });

    await patchItem(epic.id, { status: 'done' });
    await patchItem(feature.id, { status: 'done' });
    // Task stays todo.

    const items = await listProject(proj.id);
    const ids = items.map((i) => i.id);

    expect(ids).toContain(task.id);
    expect(ids).toContain(feature.id);
    expect(ids).toContain(epic.id);
  });

  it('does NOT return a fully-completed branch (no active descendants)', async () => {
    const proj = await createProject('P');
    const epic = await createItem({ type: 'epic', project_id: proj.id });
    const feature = await createItem({
      type: 'feature',
      project_id: proj.id,
      parent_id: epic.id,
    });
    const task = await createItem({ type: 'task', project_id: proj.id, parent_id: feature.id });

    // Whole branch done — no active descendant on the path.
    await patchItem(task.id, { status: 'done' });
    await patchItem(feature.id, { status: 'done' });
    await patchItem(epic.id, { status: 'done' });

    const items = await listProject(proj.id);
    const ids = items.map((i) => i.id);

    // include_completed defaults to false → fully-done branch is hidden.
    expect(ids).not.toContain(epic.id);
    expect(ids).not.toContain(feature.id);
    expect(ids).not.toContain(task.id);
  });

  it('keeps a done Feature when an active Task is moved under it', async () => {
    const proj = await createProject('P');
    const feature = await createItem({ type: 'feature', project_id: proj.id });
    const task = await createItem({ type: 'task', project_id: proj.id });

    await patchItem(feature.id, { status: 'done' });
    // Active Task gets re-parented under a completed Feature.
    await patchItem(task.id, { parent_id: feature.id });

    const items = await listProject(proj.id);
    const ids = items.map((i) => i.id);

    expect(ids).toContain(task.id);
    expect(ids).toContain(feature.id);
  });

  it('include_completed=true still returns everything', async () => {
    const proj = await createProject('P');
    const feature = await createItem({ type: 'feature', project_id: proj.id });
    const taskActive = await createItem({
      type: 'task',
      project_id: proj.id,
      parent_id: feature.id,
    });
    const taskDone = await createItem({
      type: 'task',
      project_id: proj.id,
      parent_id: feature.id,
    });
    await patchItem(taskDone.id, { status: 'done' });

    const res = await server.inject({
      method: 'GET',
      url: `/api/items?view=project&project_id=${proj.id}&include_completed=true`,
    });
    const body = JSON.parse(res.body) as { items: { id: string }[] };
    const ids = body.items.map((i) => i.id);

    expect(ids).toContain(feature.id);
    expect(ids).toContain(taskActive.id);
    expect(ids).toContain(taskDone.id);
  });
});
