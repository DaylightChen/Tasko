import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/load.js';
import { buildServer } from '../../src/server.js';

describe('GET /api/health', () => {
  let dataDir: string;
  let app: FastifyInstance;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'tasko-health-unit-'));
  });

  afterEach(async () => {
    await app.close();
    await rm(dataDir, { recursive: true });
  });

  it('returns ok with the expected shape', async () => {
    const config = loadConfig(['--init'], { TASKO_DATA_DIR: dataDir });
    app = await buildServer({ ...config, logLevel: 'fatal' });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.version).toBe('1.0.0');
    expect(body.data_dir).toBe(dataDir);
    expect(body.item_count).toBe(0);
    expect(typeof body.uptime_s).toBe('number');
  });
});
