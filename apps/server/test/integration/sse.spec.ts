import { mkdtemp, rm } from 'node:fs/promises';
/**
 * sse.spec.ts
 *
 * Integration test for GET /api/events (SSE stream).
 *
 * Uses a real HTTP connection (Node's http module) against a listening Fastify
 * instance to verify:
 * - Events are broadcast to subscribers.
 * - source='other-tab' when requester tab_id differs from the mutation's tabId.
 * - source='self' when they match.
 * - Heartbeat interval exported constant can be read.
 * - Connection cleanup on client disconnect.
 */
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INBOX_PROJECT_ID } from '@tasko/types';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';

/**
 * Parse SSE line stream into discrete events.
 * An SSE event is terminated by a blank line.
 * Returns array of { type, data } objects.
 */
function parseSSEEvents(lines: string[]): Array<{ type: string; data: string }> {
  const events: Array<{ type: string; data: string }> = [];
  let currentType = 'message';
  let currentData = '';
  let inEvent = false;

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      currentType = line.slice('event: '.length).trim();
      inEvent = true;
    } else if (line.startsWith('data: ')) {
      currentData = line.slice('data: '.length).trim();
      inEvent = true;
    } else if (line.trim() === '' && inEvent) {
      if (currentData !== '') {
        events.push({ type: currentType, data: currentData });
      }
      currentType = 'message';
      currentData = '';
      inEvent = false;
    }
  }

  return events;
}

/**
 * Check if the accumulated SSE lines contain at least one complete event
 * of the given type (i.e., we have both the event line and data line
 * followed by a blank line).
 */
function hasCompleteEvent(lines: string[], type: string): boolean {
  return parseSSEEvents(lines).some((e) => e.type === type);
}

/**
 * Open an SSE connection and collect lines until `predicate` returns true
 * or timeout elapses. Resolves with { lines, timedOut }.
 */
function collectSSELines(
  port: number,
  tabId: string,
  predicate: (lines: string[]) => boolean,
  timeoutMs = 4000,
): Promise<{ lines: string[]; timedOut: boolean }> {
  return new Promise((resolve) => {
    const lines: string[] = [];
    let settled = false;

    function settle(timedOut: boolean): void {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      req.destroy();
      resolve({ lines, timedOut });
    }

    const timer = setTimeout(() => settle(true), timeoutMs);

    const queryStr = tabId ? `?tab_id=${encodeURIComponent(tabId)}` : '';
    const req = http.get(
      `http://127.0.0.1:${port}/api/events${queryStr}`,
      { headers: { Accept: 'text/event-stream' } },
      (res) => {
        res.setEncoding('utf-8');
        let buffer = '';
        res.on('data', (chunk: string) => {
          buffer += chunk;
          // Split on newline, keeping partial last line in buffer
          const parts = buffer.split('\n');
          const partial = parts.pop() ?? '';
          buffer = partial;
          for (const part of parts) {
            lines.push(part);
          }
          if (!settled && predicate(lines)) {
            settle(false);
          }
        });
        res.on('end', () => {
          if (buffer) lines.push(buffer);
          settle(false);
        });
      },
    );

    req.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ECONNRESET') {
        settle(false);
        return;
      }
      settle(false);
    });
  });
}

const BASE_ITEM = {
  type: 'task',
  project_id: INBOX_PROJECT_ID,
  parent_id: null,
  title: 'SSE test task',
  notes: '',
  due_date: '2026-05-20',
  start_date: null,
  due_time: null,
  priority: 'none',
  status: 'todo',
  tags: [],
  subtasks: [],
  recurrence: null,
};

describe('SSE route — GET /api/events', () => {
  let dataDir: string;
  let server: FastifyInstance;
  let port: number;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'tasko-sse-test-'));
    server = await buildServer({
      dataDir,
      port: 0,
      host: '127.0.0.1',
      initIfMissing: true,
      logLevel: 'fatal',
    });
    await server.listen({ port: 0, host: '127.0.0.1' });
    const addr = server.server.address();
    if (!addr || typeof addr === 'string') {
      throw new Error('Could not determine server port');
    }
    port = addr.port;
  });

  afterEach(async () => {
    await server.close();
    await rm(dataDir, { recursive: true });
  });

  it('broadcasts item.created with source=other-tab when tab IDs differ', async () => {
    const listenerTabId = 'listener-tab';
    const mutatorTabId = 'mutator-tab';

    const collectPromise = collectSSELines(
      port,
      listenerTabId,
      (lines) => hasCompleteEvent(lines, 'item.created'),
      4000,
    );

    // Give the SSE connection time to establish
    await new Promise((r) => setTimeout(r, 200));

    const res = await server.inject({
      method: 'POST',
      url: '/api/items',
      headers: { 'x-tasko-tab-id': mutatorTabId },
      payload: { ...BASE_ITEM, title: 'Other tab task' },
    });
    expect(res.statusCode).toBe(201);

    const { lines, timedOut } = await collectPromise;
    expect(timedOut, `timed out; received lines: ${JSON.stringify(lines)}`).toBe(false);

    const events = parseSSEEvents(lines);
    const created = events.find((e) => e.type === 'item.created');
    expect(created).toBeDefined();
    if (!created) return;

    const payload = JSON.parse(created.data) as Record<string, unknown>;
    expect(payload.source).toBe('other-tab');
    expect(typeof payload.timestamp).toBe('string');
  });

  it('broadcasts item.created with source=self when tab IDs match', async () => {
    const sharedTabId = 'shared-tab';

    const collectPromise = collectSSELines(
      port,
      sharedTabId,
      (lines) => hasCompleteEvent(lines, 'item.created'),
      4000,
    );

    await new Promise((r) => setTimeout(r, 200));

    const res = await server.inject({
      method: 'POST',
      url: '/api/items',
      headers: { 'x-tasko-tab-id': sharedTabId },
      payload: { ...BASE_ITEM, title: 'Self tab task' },
    });
    expect(res.statusCode).toBe(201);

    const { lines, timedOut } = await collectPromise;
    expect(timedOut, `timed out; received lines: ${JSON.stringify(lines)}`).toBe(false);

    const events = parseSSEEvents(lines);
    const created = events.find((e) => e.type === 'item.created');
    expect(created).toBeDefined();
    if (!created) return;

    const payload = JSON.parse(created.data) as Record<string, unknown>;
    expect(payload.source).toBe('self');
  });

  it('sends events that include a timestamp field', async () => {
    const collectPromise = collectSSELines(
      port,
      'ts-tab',
      (lines) => hasCompleteEvent(lines, 'item.created'),
      4000,
    );

    await new Promise((r) => setTimeout(r, 200));

    await server.inject({
      method: 'POST',
      url: '/api/items',
      headers: { 'x-tasko-tab-id': 'other-tab' },
      payload: { ...BASE_ITEM, title: 'Timestamp test' },
    });

    const { lines, timedOut } = await collectPromise;
    expect(timedOut, `timed out; received lines: ${JSON.stringify(lines)}`).toBe(false);

    const events = parseSSEEvents(lines);
    const ev = events.find((e) => e.type === 'item.created');
    expect(ev).toBeDefined();
    if (!ev) return;

    const payload = JSON.parse(ev.data) as Record<string, unknown>;
    expect(typeof payload.timestamp).toBe('string');
    expect(() => new Date(payload.timestamp as string).toISOString()).not.toThrow();
  });

  it('does not error when client disconnects early', async () => {
    const collectPromise = collectSSELines(port, 'disconnect-tab', () => false, 300);

    const { timedOut } = await collectPromise;
    expect(timedOut).toBe(true);
  });
});

describe('SSE heartbeat interval — exported constant', () => {
  it('HEARTBEAT_INTERVAL_MS is a positive number', async () => {
    const { HEARTBEAT_INTERVAL_MS } = await import('../../src/routes/events.js');
    expect(typeof HEARTBEAT_INTERVAL_MS).toBe('number');
    expect(HEARTBEAT_INTERVAL_MS).toBeGreaterThan(0);
  });

  it('HEARTBEAT_INTERVAL_MS defaults to 25000 when SSE_HEARTBEAT_MS env is not set', async () => {
    const { HEARTBEAT_INTERVAL_MS } = await import('../../src/routes/events.js');
    const envVal = process.env.SSE_HEARTBEAT_MS;
    if (!envVal || Number.isNaN(Number(envVal))) {
      expect(HEARTBEAT_INTERVAL_MS).toBe(25_000);
    } else {
      expect(HEARTBEAT_INTERVAL_MS).toBe(Number(envVal));
    }
  });
});
