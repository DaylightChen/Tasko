import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';

describe('Config routes', () => {
  let dataDir: string;
  let server: FastifyInstance;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'tasko-config-'));
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

  it('GET /api/config returns the default config', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/config' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as Record<string, unknown>;
    expect(body.schema_version).toBe(1);
    expect(typeof body.theme).toBe('string');
    expect(typeof body.week_start).toBe('string');
    expect(typeof body.last_modified).toBe('string');
  });

  it('PATCH /api/config updates theme to dark', async () => {
    const res = await server.inject({
      method: 'PATCH',
      url: '/api/config',
      payload: { theme: 'dark' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { theme: string };
    expect(body.theme).toBe('dark');
  });

  it('GET after PATCH reflects updated value and stamps last_modified', async () => {
    const before = await server.inject({ method: 'GET', url: '/api/config' });
    const beforeBody = JSON.parse(before.body) as { last_modified: string; theme: string };

    await server.inject({ method: 'PATCH', url: '/api/config', payload: { theme: 'dark' } });

    const after = await server.inject({ method: 'GET', url: '/api/config' });
    const afterBody = JSON.parse(after.body) as { last_modified: string; theme: string };

    expect(afterBody.theme).toBe('dark');
    // last_modified should be updated (or at least a valid ISO date)
    expect(typeof afterBody.last_modified).toBe('string');
    expect(afterBody.last_modified.length).toBeGreaterThan(0);
    // last_modified should be >= beforeBody.last_modified
    expect(afterBody.last_modified >= beforeBody.last_modified).toBe(true);
  });

  it('PATCH with invalid theme returns 400', async () => {
    const res = await server.inject({
      method: 'PATCH',
      url: '/api/config',
      payload: { theme: 'invalid-theme' },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION');
  });

  it('PATCH updates week_start', async () => {
    const res = await server.inject({
      method: 'PATCH',
      url: '/api/config',
      payload: { week_start: 'sun' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { week_start: string };
    expect(body.week_start).toBe('sun');
  });
});
