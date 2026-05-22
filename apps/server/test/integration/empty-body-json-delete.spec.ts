/**
 * Regression: Fastify v5 rejects empty body + Content-Type: application/json
 * with FST_ERR_CTP_EMPTY_JSON_BODY. Without our custom JSON parser, a DELETE
 * request from the browser (which sets that header by default) 500s.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INBOX_PROJECT_ID } from '@tasko/types';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';

describe('DELETE /api/items/:id tolerates empty body with application/json', () => {
  let dataDir: string;
  let server: FastifyInstance;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'tasko-empty-body-'));
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

  it('returns 200 (not 500) when DELETE is sent with Content-Type: application/json and no body', async () => {
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/items',
      payload: {
        type: 'task',
        project_id: INBOX_PROJECT_ID,
        parent_id: null,
        title: 'Doomed',
        notes: '',
        due_date: '2026-05-21',
        start_date: null,
        due_time: null,
        priority: 'none',
        status: 'todo',
        tags: [],
        subtasks: [],
        recurrence: null,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const { id } = JSON.parse(createRes.body) as { id: string };

    const delRes = await server.inject({
      method: 'DELETE',
      url: `/api/items/${id}`,
      headers: { 'content-type': 'application/json' },
      // no body
    });
    expect(delRes.statusCode).toBe(200);
    const body = JSON.parse(delRes.body) as { trashed: Array<{ id: string }> };
    expect(body.trashed[0]?.id).toBe(id);
  });
});
