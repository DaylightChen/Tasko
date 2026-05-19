/**
 * broker-publish.spec.ts
 *
 * Verifies that every mutation route publishes at least one SSE event via
 * app.broker.publish, and that published events have the correct shape:
 * { type: string, payload: { id: string, ... }, tabId: string | null }
 *
 * Acceptance criterion from the brief:
 * "Every mutation route inside withWriteLock publishes an SSE event via
 *  app.broker.publish (no subscribers yet — task 17 wires the route)."
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INBOX_PROJECT_ID } from '@tasko/types';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SSEEvent } from '../../src/middleware/sse-broker.js';
import { buildServer } from '../../src/server.js';

describe('Broker publish — mutation routes emit SSE events', () => {
  let dataDir: string;
  let server: FastifyInstance;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'tasko-broker-'));
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

  /** Subscribe to the broker and collect events during a callback, then unsubscribe. */
  async function captureEvents(action: () => Promise<void>): Promise<SSEEvent[]> {
    const events: SSEEvent[] = [];
    const unsub = server.broker.subscribe((e) => {
      events.push(e);
    });
    await action();
    unsub();
    return events;
  }

  const baseItemPayload = {
    type: 'task',
    project_id: INBOX_PROJECT_ID,
    parent_id: null,
    title: 'Broker test task',
    notes: '',
    due_date: '2026-05-18',
    start_date: null,
    due_time: null,
    priority: 'none',
    status: 'todo',
    tags: [],
    subtasks: [],
    recurrence: null,
  };

  // ── Items ────────────────────────────────────────────────────────────────

  it('POST /api/items publishes item.created with id + item payload', async () => {
    const events = await captureEvents(async () => {
      await server.inject({ method: 'POST', url: '/api/items', payload: baseItemPayload });
    });

    expect(events.length).toBeGreaterThanOrEqual(1);
    const ev = events.find((e) => e.type === 'item.created');
    expect(ev).toBeDefined();
    if (!ev) return;
    expect(ev.tabId).toBeNull();
    const payload = ev.payload as Record<string, unknown>;
    expect(typeof payload.id).toBe('string');
    expect(payload.item).toBeDefined();
    const item = payload.item as Record<string, unknown>;
    expect(item.title).toBe('Broker test task');
  });

  it('POST /api/items passes x-tasko-tab-id header as tabId', async () => {
    const events = await captureEvents(async () => {
      await server.inject({
        method: 'POST',
        url: '/api/items',
        payload: baseItemPayload,
        headers: { 'x-tasko-tab-id': 'tab-abc-123' },
      });
    });

    const ev = events.find((e) => e.type === 'item.created');
    expect(ev).toBeDefined();
    expect(ev?.tabId).toBe('tab-abc-123');
  });

  it('PATCH /api/items/:id publishes item.changed', async () => {
    const createRes = await server.inject({ method: 'POST', url: '/api/items', payload: baseItemPayload });
    const created = JSON.parse(createRes.body) as { id: string };

    const events = await captureEvents(async () => {
      await server.inject({
        method: 'PATCH',
        url: `/api/items/${created.id}`,
        payload: { title: 'Updated' },
      });
    });

    expect(events.length).toBeGreaterThanOrEqual(1);
    const ev = events.find((e) => e.type === 'item.changed');
    expect(ev).toBeDefined();
    if (!ev) return;
    const payload = ev.payload as Record<string, unknown>;
    expect(payload.id).toBe(created.id);
    const item = payload.item as Record<string, unknown>;
    expect(item.title).toBe('Updated');
  });

  it('PATCH /api/items/:id with cross-project move publishes item.changed', async () => {
    const projBRes = await server.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'Proj B', folder_id: null, is_hierarchical: false, color: null, icon: null },
    });
    const projB = JSON.parse(projBRes.body) as { id: string };

    const createRes = await server.inject({ method: 'POST', url: '/api/items', payload: baseItemPayload });
    const created = JSON.parse(createRes.body) as { id: string };

    const events = await captureEvents(async () => {
      await server.inject({
        method: 'PATCH',
        url: `/api/items/${created.id}`,
        payload: { project_id: projB.id },
      });
    });

    const ev = events.find((e) => e.type === 'item.changed');
    expect(ev).toBeDefined();
    const payload = ev?.payload as Record<string, unknown>;
    expect(payload.id).toBe(created.id);
  });

  it('POST /api/items/:id/subtasks publishes item.changed', async () => {
    const createRes = await server.inject({ method: 'POST', url: '/api/items', payload: baseItemPayload });
    const created = JSON.parse(createRes.body) as { id: string };

    const events = await captureEvents(async () => {
      await server.inject({
        method: 'POST',
        url: `/api/items/${created.id}/subtasks`,
        payload: { title: 'Subtask' },
      });
    });

    const ev = events.find((e) => e.type === 'item.changed');
    expect(ev).toBeDefined();
    const payload = ev?.payload as Record<string, unknown>;
    expect(payload.id).toBe(created.id);
  });

  it('PATCH /api/items/:id/subtasks/:sid publishes item.changed', async () => {
    const createRes = await server.inject({ method: 'POST', url: '/api/items', payload: baseItemPayload });
    const created = JSON.parse(createRes.body) as { id: string };

    const addRes = await server.inject({
      method: 'POST',
      url: `/api/items/${created.id}/subtasks`,
      payload: { title: 'Subtask' },
    });
    const parentWithSt = JSON.parse(addRes.body) as { subtasks: { id: string }[] };
    const sid = parentWithSt.subtasks[0]?.id;
    expect(sid).toBeDefined();
    if (!sid) return;

    const events = await captureEvents(async () => {
      await server.inject({
        method: 'PATCH',
        url: `/api/items/${created.id}/subtasks/${sid}`,
        payload: { status: 'done' },
      });
    });

    const ev = events.find((e) => e.type === 'item.changed');
    expect(ev).toBeDefined();
  });

  it('DELETE /api/items/:id/subtasks/:sid publishes item.changed', async () => {
    const createRes = await server.inject({ method: 'POST', url: '/api/items', payload: baseItemPayload });
    const created = JSON.parse(createRes.body) as { id: string };

    const addRes = await server.inject({
      method: 'POST',
      url: `/api/items/${created.id}/subtasks`,
      payload: { title: 'Subtask' },
    });
    const parentWithSt = JSON.parse(addRes.body) as { subtasks: { id: string }[] };
    const sid = parentWithSt.subtasks[0]?.id;
    expect(sid).toBeDefined();
    if (!sid) return;

    const events = await captureEvents(async () => {
      await server.inject({
        method: 'DELETE',
        url: `/api/items/${created.id}/subtasks/${sid}`,
      });
    });

    const ev = events.find((e) => e.type === 'item.changed');
    expect(ev).toBeDefined();
  });

  it('POST /api/items/:id/move publishes item.changed', async () => {
    const projBRes = await server.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'Move Target', folder_id: null, is_hierarchical: false, color: null, icon: null },
    });
    const projB = JSON.parse(projBRes.body) as { id: string };

    const createRes = await server.inject({ method: 'POST', url: '/api/items', payload: baseItemPayload });
    const created = JSON.parse(createRes.body) as { id: string };

    const events = await captureEvents(async () => {
      await server.inject({
        method: 'POST',
        url: `/api/items/${created.id}/move`,
        payload: { new_project_id: projB.id },
      });
    });

    const ev = events.find((e) => e.type === 'item.changed');
    expect(ev).toBeDefined();
  });

  // ── Projects ──────────────────────────────────────────────────────────────

  it('POST /api/projects publishes project.created', async () => {
    const events = await captureEvents(async () => {
      await server.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { name: 'New Project', folder_id: null, is_hierarchical: false, color: null, icon: null },
      });
    });

    const ev = events.find((e) => e.type === 'project.created');
    expect(ev).toBeDefined();
    if (!ev) return;
    const payload = ev.payload as Record<string, unknown>;
    expect(typeof payload.id).toBe('string');
    const project = payload.project as Record<string, unknown>;
    expect(project.name).toBe('New Project');
  });

  it('PATCH /api/projects/:id publishes project.changed', async () => {
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'Proj', folder_id: null, is_hierarchical: false, color: null, icon: null },
    });
    const created = JSON.parse(createRes.body) as { id: string };

    const events = await captureEvents(async () => {
      await server.inject({
        method: 'PATCH',
        url: `/api/projects/${created.id}`,
        payload: { name: 'Updated Proj' },
      });
    });

    const ev = events.find((e) => e.type === 'project.changed');
    expect(ev).toBeDefined();
    const payload = ev?.payload as Record<string, unknown>;
    expect(payload.id).toBe(created.id);
  });

  // ── Folders ──────────────────────────────────────────────────────────────

  it('POST /api/folders publishes folder.created', async () => {
    const events = await captureEvents(async () => {
      await server.inject({ method: 'POST', url: '/api/folders', payload: { name: 'New Folder' } });
    });

    const ev = events.find((e) => e.type === 'folder.created');
    expect(ev).toBeDefined();
    if (!ev) return;
    const payload = ev.payload as Record<string, unknown>;
    expect(typeof payload.id).toBe('string');
    const folder = payload.folder as Record<string, unknown>;
    expect(folder.name).toBe('New Folder');
  });

  it('PATCH /api/folders/:id publishes folder.changed', async () => {
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/folders',
      payload: { name: 'Old Folder' },
    });
    const created = JSON.parse(createRes.body) as { id: string };

    const events = await captureEvents(async () => {
      await server.inject({
        method: 'PATCH',
        url: `/api/folders/${created.id}`,
        payload: { name: 'New Folder Name' },
      });
    });

    const ev = events.find((e) => e.type === 'folder.changed');
    expect(ev).toBeDefined();
    const payload = ev?.payload as Record<string, unknown>;
    expect(payload.id).toBe(created.id);
  });

  it('DELETE /api/folders/:id publishes folder.deleted and project.changed for each moved project', async () => {
    const folderRes = await server.inject({
      method: 'POST',
      url: '/api/folders',
      payload: { name: 'To Delete' },
    });
    const folder = JSON.parse(folderRes.body) as { id: string };

    const proj1Res = await server.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'P1', folder_id: folder.id, is_hierarchical: false, color: null, icon: null },
    });
    const proj1 = JSON.parse(proj1Res.body) as { id: string };

    const events = await captureEvents(async () => {
      await server.inject({ method: 'DELETE', url: `/api/folders/${folder.id}` });
    });

    const deletedEv = events.find((e) => e.type === 'folder.deleted');
    expect(deletedEv).toBeDefined();
    const deletedPayload = deletedEv?.payload as Record<string, unknown>;
    expect(deletedPayload.id).toBe(folder.id);

    const changedEv = events.find((e) => e.type === 'project.changed');
    expect(changedEv).toBeDefined();
    const changedPayload = changedEv?.payload as Record<string, unknown>;
    expect(changedPayload.id).toBe(proj1.id);
  });

  // ── Tags ─────────────────────────────────────────────────────────────────

  it('POST /api/tags (new tag) publishes tag.created', async () => {
    const events = await captureEvents(async () => {
      await server.inject({ method: 'POST', url: '/api/tags', payload: { name: 'broker-tag' } });
    });

    const ev = events.find((e) => e.type === 'tag.created');
    expect(ev).toBeDefined();
    if (!ev) return;
    const payload = ev.payload as Record<string, unknown>;
    expect(typeof payload.id).toBe('string');
    const tag = payload.tag as Record<string, unknown>;
    expect(tag.name).toBe('broker-tag');
  });

  it('POST /api/tags (duplicate tag) does NOT publish tag.created again', async () => {
    // Create first
    await server.inject({ method: 'POST', url: '/api/tags', payload: { name: 'dup-tag' } });

    // Create duplicate — should 200 with no new event
    const events = await captureEvents(async () => {
      await server.inject({ method: 'POST', url: '/api/tags', payload: { name: 'dup-tag' } });
    });

    const createdEvents = events.filter((e) => e.type === 'tag.created');
    expect(createdEvents.length).toBe(0);
  });

  // ── Config ───────────────────────────────────────────────────────────────

  it('PATCH /api/config publishes config.changed', async () => {
    const events = await captureEvents(async () => {
      await server.inject({ method: 'PATCH', url: '/api/config', payload: { theme: 'dark' } });
    });

    const ev = events.find((e) => e.type === 'config.changed');
    expect(ev).toBeDefined();
    if (!ev) return;
    const payload = ev.payload as Record<string, unknown>;
    const config = payload.config as Record<string, unknown>;
    expect(config.theme).toBe('dark');
  });
});
