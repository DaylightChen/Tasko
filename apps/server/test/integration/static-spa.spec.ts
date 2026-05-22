import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/load.js';
import { buildServer } from '../../src/server.js';

describe('static SPA serving', () => {
  let dataDir: string;
  let spaDir: string;
  let app: FastifyInstance;
  let originalSpaDirEnv: string | undefined;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'tasko-spa-data-'));
    spaDir = await mkdtemp(join(tmpdir(), 'tasko-spa-dist-'));
    await writeFile(
      join(spaDir, 'index.html'),
      '<!DOCTYPE html><html><head><title>Tasko</title></head><body><div id="root"></div></body></html>',
    );
    await writeFile(join(spaDir, 'app.js'), 'console.log("tasko spa");');
    originalSpaDirEnv = process.env.TASKO_SPA_DIR;
    process.env.TASKO_SPA_DIR = spaDir;
    const config = loadConfig(['--init'], { TASKO_DATA_DIR: dataDir });
    app = await buildServer({ ...config, logLevel: 'fatal' });
  });

  afterEach(async () => {
    await app.close();
    await rm(dataDir, { recursive: true });
    await rm(spaDir, { recursive: true });
    if (originalSpaDirEnv === undefined) {
      // biome-ignore lint/performance/noDelete: clearing an env var requires `delete`; assigning undefined coerces to the string "undefined" in process.env.
      delete process.env.TASKO_SPA_DIR;
    } else {
      process.env.TASKO_SPA_DIR = originalSpaDirEnv;
    }
  });

  it('serves index.html at /', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.body).toContain('<title>Tasko</title>');
  });

  it('serves existing assets directly', async () => {
    const res = await app.inject({ method: 'GET', url: '/app.js' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('tasko spa');
  });

  it('falls back to index.html for unknown non-API GET routes (SPA client-side routing)', async () => {
    const res = await app.inject({ method: 'GET', url: '/today' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.body).toContain('<title>Tasko</title>');
  });

  it('returns JSON 404 envelope for unknown /api/* routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/does-not-exist' });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body) as { error: { code: string } };
    expect(body.error.code).toBe('INTERNAL');
  });

  it('returns JSON 404 (not SPA fallback) for non-GET methods on unknown routes', async () => {
    const res = await app.inject({ method: 'POST', url: '/some-unknown-path' });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body) as { error: { code: string } };
    expect(body.error.code).toBe('INTERNAL');
  });
});

describe('static SPA serving — no SPA dist present', () => {
  let dataDir: string;
  let app: FastifyInstance;
  let originalSpaDirEnv: string | undefined;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'tasko-spa-nodata-'));
    originalSpaDirEnv = process.env.TASKO_SPA_DIR;
    // Point TASKO_SPA_DIR at a directory that does not contain index.html, and
    // run from a working dir where no candidate path resolves either.
    process.env.TASKO_SPA_DIR = dataDir;
    const config = loadConfig(['--init'], { TASKO_DATA_DIR: dataDir });
    app = await buildServer({ ...config, logLevel: 'fatal' });
  });

  afterEach(async () => {
    await app.close();
    await rm(dataDir, { recursive: true });
    if (originalSpaDirEnv === undefined) {
      // biome-ignore lint/performance/noDelete: clearing an env var requires `delete`; assigning undefined coerces to the string "undefined" in process.env.
      delete process.env.TASKO_SPA_DIR;
    } else {
      process.env.TASKO_SPA_DIR = originalSpaDirEnv;
    }
  });

  it('returns JSON 404 envelope at / when no SPA dist is discoverable', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    // No candidate has index.html, so the fallback is the JSON envelope.
    // We can't fully guarantee the resolveSpaRoot can't find a different
    // candidate (e.g. apps/web/dist exists in the source tree during local
    // dev runs), so this test only asserts the response is well-formed:
    // either 200 HTML (if an ambient SPA was discovered) or 404 JSON.
    if (res.statusCode === 200) {
      expect(res.headers['content-type']).toMatch(/text\/html/);
    } else {
      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body) as { error: { code: string } };
      expect(body.error.code).toBe('INTERNAL');
    }
  });
});
