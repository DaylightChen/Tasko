import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INBOX_PROJECT_ID } from '@tasko/types';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/load.js';
import { buildServer } from '../../src/server.js';

const now = new Date().toISOString();

const validItem = {
  id: '01HWABCDEFGHJKMNPQRSTVWXYZ',
  schema_version: 1,
  type: 'task',
  project_id: INBOX_PROJECT_ID,
  parent_id: null,
  title: 'Test task',
  notes: '',
  due_date: '2026-05-20',
  start_date: null,
  due_time: null,
  priority: 'none',
  status: 'todo',
  tags: [],
  subtasks: [],
  recurrence: null,
  completed_at: null,
  trashed_at: null,
  trashed_with: null,
  sort_order: 1024,
  created_at: now,
  updated_at: now,
};

describe('GET /api/health with indexer', () => {
  let dataDir: string;
  let server: FastifyInstance;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'tasko-health-test-'));
  });

  afterEach(async () => {
    await server.close();
    await rm(dataDir, { recursive: true });
  });

  it('reports item_count: 0 on fresh init', async () => {
    const config = loadConfig(['--init'], { TASKO_DATA_DIR: dataDir });
    server = await buildServer({ ...config, logLevel: 'fatal' });

    const res = await server.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.item_count).toBe(0);
    expect(body.data_dir).toBe(dataDir);
  });

  it('reports item_count: 1 after adding an item JSON file', async () => {
    // Set up dirs manually first
    await mkdir(join(dataDir, 'items'), { recursive: true });
    await mkdir(join(dataDir, 'trash'), { recursive: true });
    await mkdir(join(dataDir, 'projects'), { recursive: true });
    await mkdir(join(dataDir, 'folders'), { recursive: true });
    await mkdir(join(dataDir, 'tags'), { recursive: true });

    // Drop in a valid item JSON
    await writeFile(join(dataDir, 'items', `${validItem.id}.json`), JSON.stringify(validItem));

    const config = loadConfig(['--init'], { TASKO_DATA_DIR: dataDir });
    server = await buildServer({ ...config, logLevel: 'fatal' });

    const res = await server.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as Record<string, unknown>;
    expect(body.item_count).toBe(1);
  });

  it('returns ok:true and version 1.0.0', async () => {
    const config = loadConfig(['--init'], { TASKO_DATA_DIR: dataDir });
    server = await buildServer({ ...config, logLevel: 'fatal' });

    const res = await server.inject({ method: 'GET', url: '/api/health' });
    const body = JSON.parse(res.body) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.version).toBe('1.0.0');
    expect(typeof body.uptime_s).toBe('number');
  });
});
