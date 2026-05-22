import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';

describe('Folders CRUD', () => {
  let dataDir: string;
  let server: FastifyInstance;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'tasko-folders-'));
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

  it('POST creates a folder and returns 201', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/folders',
      payload: { name: 'Work' },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as Record<string, unknown>;
    expect(body.name).toBe('Work');
    expect(typeof body.id).toBe('string');
  });

  it('GET /api/folders lists folders', async () => {
    await server.inject({ method: 'POST', url: '/api/folders', payload: { name: 'Folder1' } });

    const res = await server.inject({ method: 'GET', url: '/api/folders' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { folders: unknown[]; count: number };
    expect(body.count).toBeGreaterThan(0);
  });

  it('PATCH updates folder name', async () => {
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/folders',
      payload: { name: 'OldName' },
    });
    const created = JSON.parse(createRes.body) as { id: string };

    const res = await server.inject({
      method: 'PATCH',
      url: `/api/folders/${created.id}`,
      payload: { name: 'NewName' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { name: string };
    expect(body.name).toBe('NewName');
  });

  it('DELETE folder cascades projects to folder_id: null', async () => {
    // Create folder
    const folderRes = await server.inject({
      method: 'POST',
      url: '/api/folders',
      payload: { name: 'To Delete' },
    });
    const folder = JSON.parse(folderRes.body) as { id: string };

    // Create 2 projects in the folder
    const proj1Res = await server.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'Project 1', folder_id: folder.id, is_hierarchical: false, color: null, icon: null },
    });
    const proj2Res = await server.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'Project 2', folder_id: folder.id, is_hierarchical: false, color: null, icon: null },
    });
    const proj1 = JSON.parse(proj1Res.body) as { id: string };
    const proj2 = JSON.parse(proj2Res.body) as { id: string };

    // Delete the folder
    const delRes = await server.inject({
      method: 'DELETE',
      url: `/api/folders/${folder.id}`,
    });
    expect(delRes.statusCode).toBe(200);
    const delBody = JSON.parse(delRes.body) as { deleted_folder_id: string; projects_moved: number };
    expect(delBody.deleted_folder_id).toBe(folder.id);
    expect(delBody.projects_moved).toBe(2);

    // Verify both projects have folder_id: null
    const p1Res = await server.inject({ method: 'GET', url: `/api/projects/${proj1.id}` });
    const p1 = JSON.parse(p1Res.body) as { folder_id: string | null };
    expect(p1.folder_id).toBeNull();

    const p2Res = await server.inject({ method: 'GET', url: `/api/projects/${proj2.id}` });
    const p2 = JSON.parse(p2Res.body) as { folder_id: string | null };
    expect(p2.folder_id).toBeNull();
  });

  it('DELETE unknown folder returns 404', async () => {
    const res = await server.inject({
      method: 'DELETE',
      url: '/api/folders/01HWABCDEFGHJKMNPQRSTVWXYZ',
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body) as { error: { code: string } };
    expect(body.error.code).toBe('FOLDER_NOT_FOUND');
  });
});
