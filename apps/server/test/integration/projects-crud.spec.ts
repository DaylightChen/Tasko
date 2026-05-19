import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INBOX_PROJECT_ID } from '@tasko/types';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';

describe('Projects CRUD', () => {
  let dataDir: string;
  let server: FastifyInstance;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'tasko-projects-'));
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

  const baseProject = {
    name: 'My Project',
    folder_id: null,
    is_hierarchical: false,
    color: null,
    icon: null,
  };

  it('POST creates a project and returns 201', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/projects',
      payload: baseProject,
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as Record<string, unknown>;
    expect(body.name).toBe('My Project');
    expect(body.is_inbox).toBe(false);
    expect(typeof body.id).toBe('string');
  });

  it('GET /api/projects lists projects with Inbox first', async () => {
    await server.inject({ method: 'POST', url: '/api/projects', payload: baseProject });

    const res = await server.inject({ method: 'GET', url: '/api/projects' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { projects: { id: string; is_inbox: boolean }[] };
    expect(body.projects[0]?.is_inbox).toBe(true);
    expect(body.projects[0]?.id).toBe(INBOX_PROJECT_ID);
  });

  it('PATCH updates project name', async () => {
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/projects',
      payload: baseProject,
    });
    const created = JSON.parse(createRes.body) as { id: string };

    const res = await server.inject({
      method: 'PATCH',
      url: `/api/projects/${created.id}`,
      payload: { name: 'Updated Project' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { name: string };
    expect(body.name).toBe('Updated Project');
  });

  it('PATCH Inbox returns 409 INBOX_IMMUTABLE', async () => {
    const res = await server.inject({
      method: 'PATCH',
      url: `/api/projects/${INBOX_PROJECT_ID}`,
      payload: { name: 'Renamed Inbox' },
    });
    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body) as { error: { code: string } };
    expect(body.error.code).toBe('INBOX_IMMUTABLE');
  });

  it('POST with is_inbox: true returns 400', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { ...baseProject, is_inbox: true },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION');
  });

  it('DELETE returns 501', async () => {
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/projects',
      payload: baseProject,
    });
    const created = JSON.parse(createRes.body) as { id: string };

    const res = await server.inject({
      method: 'DELETE',
      url: `/api/projects/${created.id}`,
    });
    expect(res.statusCode).toBe(501);
  });

  it('GET /api/projects/:id returns 404 for unknown id', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/projects/01HWABCDEFGHJKMNPQRSTVWXYZ',
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body) as { error: { code: string } };
    expect(body.error.code).toBe('PROJECT_NOT_FOUND');
  });
});
