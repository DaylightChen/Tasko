/**
 * Tests the --init flow and missing-data-dir error path described in the brief:
 * - When `initIfMissing: false` and data dir is missing → throws with exact error message.
 * - When `initIfMissing: true` against a fresh path → creates the full directory tree
 *   (config.json, items/, projects/, folders/, tags/, trash/) and the Inbox sentinel file.
 */
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INBOX_PROJECT_ID } from '@tasko/types';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/load.js';
import { buildServer } from '../../src/server.js';

describe('--init flow and missing data-dir error path', () => {
  let tmpBase: string;
  let server: FastifyInstance | undefined;

  beforeEach(async () => {
    tmpBase = await mkdtemp(join(tmpdir(), 'tasko-init-flow-'));
  });

  afterEach(async () => {
    if (server !== undefined) {
      await server.close();
      server = undefined;
    }
    await rm(tmpBase, { recursive: true });
  });

  it('throws with exact error message when data dir missing and initIfMissing is false', async () => {
    const missingPath = join(tmpBase, 'no-such-dir');
    const config = loadConfig(['--data-dir', missingPath], {});
    // initIfMissing defaults to false when --init is not passed
    expect(config.initIfMissing).toBe(false);

    await expect(buildServer({ ...config, logLevel: 'fatal' })).rejects.toThrow(
      `Data directory does not exist: ${missingPath}. Run with --init to create it.`,
    );
  });

  it('creates the full directory tree when --init is passed with a missing path', async () => {
    const freshPath = join(tmpBase, 'fresh-data');
    const config = loadConfig(['--init', '--data-dir', freshPath], {});
    expect(config.initIfMissing).toBe(true);

    server = await buildServer({ ...config, logLevel: 'fatal' });

    // Verify all required subdirectories exist
    const subdirs = ['items', 'projects', 'folders', 'tags', 'trash'];
    for (const subdir of subdirs) {
      const dirStat = await stat(join(freshPath, subdir));
      expect(dirStat.isDirectory()).toBe(true);
    }

    // Verify config.json was written
    const configFileStat = await stat(join(freshPath, 'config.json'));
    expect(configFileStat.isFile()).toBe(true);
  });

  it('creates the Inbox sentinel project file at projects/INBOX_PROJECT_ID.json when --init is used', async () => {
    const freshPath = join(tmpBase, 'fresh-data-inbox');
    const config = loadConfig(['--init', '--data-dir', freshPath], {});

    server = await buildServer({ ...config, logLevel: 'fatal' });

    const inboxFilePath = join(freshPath, 'projects', `${INBOX_PROJECT_ID}.json`);
    const fileStat = await stat(inboxFilePath);
    expect(fileStat.isFile()).toBe(true);

    // Parse the Inbox file and verify its contents
    const raw = await readFile(inboxFilePath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed.id).toBe(INBOX_PROJECT_ID);
    expect(parsed.name).toBe('Inbox');
    expect(parsed.is_inbox).toBe(true);
    expect(parsed.folder_id).toBeNull();
    expect(parsed.sort_order).toBe(0);
  });

  it('does not fail when --init is called on a directory that already exists', async () => {
    const existingPath = join(tmpBase, 'existing-data');
    // First init
    const config1 = loadConfig(['--init', '--data-dir', existingPath], {});
    server = await buildServer({ ...config1, logLevel: 'fatal' });
    await server.close();

    // Second init on the same path (idempotent)
    const config2 = loadConfig(['--init', '--data-dir', existingPath], {});
    server = await buildServer({ ...config2, logLevel: 'fatal' });
    // Should succeed without throwing
    const res = await server.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
  });
});
