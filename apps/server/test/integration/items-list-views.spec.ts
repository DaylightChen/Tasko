import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INBOX_PROJECT_ID } from '@tasko/types';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';

// Helper: get today and offset dates as YYYY-MM-DD strings
function localDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('Items list views', () => {
  let dataDir: string;
  let server: FastifyInstance;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'tasko-views-'));
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

  const baseItem = {
    type: 'task' as const,
    project_id: INBOX_PROJECT_ID,
    parent_id: null,
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
      payload: { ...baseItem, ...overrides },
    });
    return JSON.parse(res.body) as { id: string };
  }

  async function createProject(name: string): Promise<{ id: string }> {
    const res = await server.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name, folder_id: null, is_hierarchical: false, color: null, icon: null },
    });
    return JSON.parse(res.body) as { id: string };
  }

  async function createTag(name: string): Promise<{ id: string }> {
    const res = await server.inject({
      method: 'POST',
      url: '/api/tags',
      payload: { name },
    });
    return JSON.parse(res.body) as { id: string };
  }

  it('view=today includes overdue items', async () => {
    const overdue = await createItem({ title: 'Overdue', due_date: localDate(-3) });
    const todayItem = await createItem({ title: 'Today', due_date: localDate(0) });
    const futureItem = await createItem({ title: 'Future', due_date: localDate(5) });

    const res = await server.inject({ method: 'GET', url: '/api/items?view=today' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { items: { id: string }[] };
    const ids = body.items.map((i) => i.id);
    expect(ids).toContain(overdue.id);
    expect(ids).toContain(todayItem.id);
    expect(ids).not.toContain(futureItem.id);
  });

  it('view=today includes multi-day items spanning today', async () => {
    const multiDay = await createItem({
      title: 'Multi-day',
      start_date: localDate(-2),
      due_date: localDate(2),
    });

    const res = await server.inject({ method: 'GET', url: '/api/items?view=today' });
    const body = JSON.parse(res.body) as { items: { id: string }[] };
    const ids = body.items.map((i) => i.id);
    expect(ids).toContain(multiDay.id);
  });

  it('view=tomorrow includes only tomorrow items', async () => {
    const todayItem = await createItem({ title: 'Today', due_date: localDate(0) });
    const tomorrowItem = await createItem({ title: 'Tomorrow', due_date: localDate(1) });
    const futureItem = await createItem({ title: 'Future', due_date: localDate(5) });

    const res = await server.inject({ method: 'GET', url: '/api/items?view=tomorrow' });
    const body = JSON.parse(res.body) as { items: { id: string }[] };
    const ids = body.items.map((i) => i.id);
    expect(ids).not.toContain(todayItem.id);
    expect(ids).toContain(tomorrowItem.id);
    expect(ids).not.toContain(futureItem.id);
  });

  it('view=next7 includes items in the next 7 days', async () => {
    const todayItem = await createItem({ title: 'Today', due_date: localDate(0) });
    const day5Item = await createItem({ title: 'Day 5', due_date: localDate(5) });
    const day6Item = await createItem({ title: 'Day 6', due_date: localDate(6) });
    const day7Item = await createItem({ title: 'Day 7', due_date: localDate(7) });

    const res = await server.inject({ method: 'GET', url: '/api/items?view=next7' });
    const body = JSON.parse(res.body) as { items: { id: string }[] };
    const ids = body.items.map((i) => i.id);
    expect(ids).toContain(todayItem.id);
    expect(ids).toContain(day5Item.id);
    expect(ids).toContain(day6Item.id);
    expect(ids).not.toContain(day7Item.id);
  });

  it('view=inbox includes only top-level inbox items', async () => {
    const inboxItem = await createItem({ title: 'Inbox item', due_date: localDate(0) });
    const proj = await createProject('ProjectA');
    const projItem = await createItem({
      title: 'Project item',
      due_date: localDate(0),
      project_id: proj.id,
    });

    const res = await server.inject({ method: 'GET', url: '/api/items?view=inbox' });
    const body = JSON.parse(res.body) as { items: { id: string }[] };
    const ids = body.items.map((i) => i.id);
    expect(ids).toContain(inboxItem.id);
    expect(ids).not.toContain(projItem.id);
  });

  it('view=all excludes completed items', async () => {
    const active = await createItem({ title: 'Active', due_date: localDate(0) });
    const completed = await createItem({ title: 'Completed', due_date: localDate(0) });

    // Mark completed
    await server.inject({
      method: 'PATCH',
      url: `/api/items/${completed.id}`,
      payload: { status: 'done' },
    });

    const res = await server.inject({ method: 'GET', url: '/api/items?view=all' });
    const body = JSON.parse(res.body) as { items: { id: string }[] };
    const ids = body.items.map((i) => i.id);
    expect(ids).toContain(active.id);
    expect(ids).not.toContain(completed.id);
  });

  it('view=completed includes only completed items', async () => {
    const active = await createItem({ title: 'Active', due_date: localDate(0) });
    const completed = await createItem({ title: 'Completed', due_date: localDate(0) });

    await server.inject({
      method: 'PATCH',
      url: `/api/items/${completed.id}`,
      payload: { status: 'done' },
    });

    const res = await server.inject({ method: 'GET', url: '/api/items?view=completed' });
    const body = JSON.parse(res.body) as { items: { id: string }[] };
    const ids = body.items.map((i) => i.id);
    expect(ids).not.toContain(active.id);
    expect(ids).toContain(completed.id);
  });

  it('view=project filters by project_id', async () => {
    const proj = await createProject('ProjectB');
    const inboxItem = await createItem({ title: 'Inbox', due_date: localDate(0) });
    const projItem = await createItem({
      title: 'Project',
      due_date: localDate(0),
      project_id: proj.id,
    });

    const res = await server.inject({
      method: 'GET',
      url: `/api/items?view=project&project_id=${proj.id}`,
    });
    const body = JSON.parse(res.body) as { items: { id: string }[] };
    const ids = body.items.map((i) => i.id);
    expect(ids).toContain(projItem.id);
    expect(ids).not.toContain(inboxItem.id);
  });

  it('view=project with parent_id=root filters to top-level items', async () => {
    const proj = await createProject('ProjectC');
    const parent = await createItem({
      title: 'Epic',
      due_date: localDate(0),
      type: 'epic',
      project_id: proj.id,
    });
    const child = await createItem({
      title: 'Feature',
      due_date: localDate(0),
      type: 'feature',
      project_id: proj.id,
      parent_id: parent.id,
    });

    const res = await server.inject({
      method: 'GET',
      url: `/api/items?view=project&project_id=${proj.id}&parent_id=root`,
    });
    const body = JSON.parse(res.body) as { items: { id: string }[] };
    const ids = body.items.map((i) => i.id);
    expect(ids).toContain(parent.id);
    expect(ids).not.toContain(child.id);
  });

  it('view=tag filters by tag_id', async () => {
    const tag = await createTag('urgent');
    const taggedItem = await createItem({
      title: 'Tagged',
      due_date: localDate(0),
      tags: [tag.id],
    });
    const untaggedItem = await createItem({ title: 'Untagged', due_date: localDate(0) });

    const res = await server.inject({
      method: 'GET',
      url: `/api/items?view=tag&tag_id=${tag.id}`,
    });
    const body = JSON.parse(res.body) as { items: { id: string }[] };
    const ids = body.items.map((i) => i.id);
    expect(ids).toContain(taggedItem.id);
    expect(ids).not.toContain(untaggedItem.id);
  });

  it('rejects unknown view values with 400', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/items?view=badvalue' });
    expect(res.statusCode).toBe(400);
  });

  it('view=project returns 400 when project_id is missing', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/items?view=project' });
    expect(res.statusCode).toBe(400);
  });
});
