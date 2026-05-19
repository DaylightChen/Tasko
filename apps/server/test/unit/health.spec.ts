import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/load.js';
import { buildServer } from '../../src/server.js';

describe('GET /api/health', () => {
  it('returns ok with the expected shape', async () => {
    const config = loadConfig([], { TASKO_DATA_DIR: '/tmp/tasko-test' });
    const app = await buildServer({ ...config, logLevel: 'fatal' });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.version).toBe('1.0.0');
    expect(body.data_dir).toBe('/tmp/tasko-test');
    expect(body.item_count).toBe(0);
    expect(typeof body.uptime_s).toBe('number');
    await app.close();
  });
});
