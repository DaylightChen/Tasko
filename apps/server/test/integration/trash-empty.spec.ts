/**
 * trash-empty.spec.ts
 *
 * Covers:
 * - POST /api/trash/empty empties all items from trash.
 * - Returns { deleted_count: N } with correct count.
 * - All trash files removed from disk.
 * - GET /api/trash returns empty list after emptying.
 * - Empty trash on already-empty trash returns { deleted_count: 0 }.
 */
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';

describe('trash empty', () => {
  let dataDir: string;
  let server: FastifyInstance;
  let userProjectId: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'tasko-trash-empty-'));
    server = await buildServer({
      dataDir,
      port: 0,
      host: '127.0.0.1',
      initIfMissing: true,
      logLevel: 'fatal',
    });
    // Create a user project to avoid INBOX_PROJECT_ID issues with ItemSchema ULID validation
    const projRes = await server.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'Test Project', folder_id: null, is_hierarchical: false, color: null, icon: null },
    });
    expect(projRes.statusCode).toBe(201);
    const proj = JSON.parse(projRes.body) as { id: string };
    userProjectId = proj.id;
  });

  afterEach(async () => {
    await server.close();
    await rm(dataDir, { recursive: true });
  });

  async function createAndTrashItem(title: string): Promise<string> {
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/items',
      payload: {
        type: 'task',
        project_id: userProjectId,
        parent_id: null,
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
    expect(createRes.statusCode).toBe(201);
    const item = JSON.parse(createRes.body) as { id: string };

    const trashRes = await server.inject({ method: 'DELETE', url: `/api/items/${item.id}` });
    expect(trashRes.statusCode).toBe(200);

    return item.id;
  }

  async function trashFileCount(): Promise<number> {
    const trashDir = join(dataDir, 'trash');
    try {
      const files = await readdir(trashDir);
      return files.filter((f) => f.endsWith('.json')).length;
    } catch {
      return 0;
    }
  }

  it('POST /api/trash/empty returns { deleted_count: 5 } when 5 items are in trash', async () => {
    for (let i = 1; i <= 5; i++) {
      await createAndTrashItem(`Task ${i}`);
    }

    const res = await server.inject({ method: 'POST', url: '/api/trash/empty' });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body) as { deleted_count: number };
    expect(body.deleted_count).toBe(5);
  });

  it('trash files are removed from disk after empty', async () => {
    for (let i = 1; i <= 5; i++) {
      await createAndTrashItem(`Task ${i}`);
    }

    const beforeCount = await trashFileCount();
    expect(beforeCount).toBe(5);

    await server.inject({ method: 'POST', url: '/api/trash/empty' });

    const afterCount = await trashFileCount();
    expect(afterCount).toBe(0);
  });

  it('GET /api/trash returns empty list after emptying', async () => {
    for (let i = 1; i <= 3; i++) {
      await createAndTrashItem(`Task ${i}`);
    }

    await server.inject({ method: 'POST', url: '/api/trash/empty' });

    const trashRes = await server.inject({ method: 'GET', url: '/api/trash' });
    expect(trashRes.statusCode).toBe(200);
    const body = JSON.parse(trashRes.body) as { items: unknown[]; count: number };
    expect(body.items).toHaveLength(0);
    expect(body.count).toBe(0);
  });

  it('empty trash on already-empty trash returns { deleted_count: 0 }', async () => {
    const res = await server.inject({ method: 'POST', url: '/api/trash/empty' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { deleted_count: number };
    expect(body.deleted_count).toBe(0);
  });

  it('cascade descendants are also counted in deleted_count', async () => {
    const project = { id: userProjectId };

    // Create Epic with 2 descendants
    const epicRes = await server.inject({
      method: 'POST',
      url: '/api/items',
      payload: {
        type: 'epic',
        project_id: project.id,
        parent_id: null,
        title: 'Epic',
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
    const epic = JSON.parse(epicRes.body) as { id: string };

    const featureRes = await server.inject({
      method: 'POST',
      url: '/api/items',
      payload: {
        type: 'feature',
        project_id: project.id,
        parent_id: epic.id,
        title: 'Feature',
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
    const feature = JSON.parse(featureRes.body) as { id: string };
    void feature;

    // Trash epic (cascades feature = 2 items total)
    await server.inject({ method: 'DELETE', url: `/api/items/${epic.id}` });

    // Also trash 3 independent items
    for (let i = 0; i < 3; i++) {
      await createAndTrashItem(`Extra Task ${i}`);
    }

    // Total in trash: 2 (epic cascade) + 3 (independent) = 5
    const trashRes = await server.inject({ method: 'GET', url: '/api/trash?flat=true' });
    const { count } = JSON.parse(trashRes.body) as { count: number };
    expect(count).toBe(5);

    const emptyRes = await server.inject({ method: 'POST', url: '/api/trash/empty' });
    const emptyBody = JSON.parse(emptyRes.body) as { deleted_count: number };
    expect(emptyBody.deleted_count).toBe(5);
  });
});
