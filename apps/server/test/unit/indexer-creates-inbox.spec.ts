import { mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INBOX_PROJECT_ID } from '@tasko/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildIndexer } from '../../src/store/indexer.js';

async function makeDataDir(base: string) {
  await mkdir(join(base, 'items'), { recursive: true });
  await mkdir(join(base, 'trash'), { recursive: true });
  await mkdir(join(base, 'projects'), { recursive: true });
  await mkdir(join(base, 'folders'), { recursive: true });
  await mkdir(join(base, 'tags'), { recursive: true });
}

describe('indexer creates Inbox sentinel', () => {
  let dir: string;
  const logger = { warn: (_msg: string) => {} };

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tasko-inbox-test-'));
    await makeDataDir(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true });
  });

  it('creates the Inbox project file on fresh bootstrap', async () => {
    const indexer = buildIndexer(dir, logger);
    await indexer.bootstrap();

    const inboxFilePath = join(dir, 'projects', `${INBOX_PROJECT_ID}.json`);
    const fileStat = await stat(inboxFilePath);
    expect(fileStat.isFile()).toBe(true);
  });

  it('sets the Inbox project in the in-memory index', async () => {
    const indexer = buildIndexer(dir, logger);
    await indexer.bootstrap();

    const index = indexer.getIndex();
    expect(index.projects.has(INBOX_PROJECT_ID)).toBe(true);
    const inbox = index.projects.get(INBOX_PROJECT_ID);
    expect(inbox?.name).toBe('Inbox');
    expect(inbox?.is_inbox).toBe(true);
  });

  it('does not duplicate the Inbox project if already on disk', async () => {
    const indexer = buildIndexer(dir, logger);
    // First bootstrap creates Inbox
    await indexer.bootstrap();

    // Second bootstrap should reuse the existing one, not duplicate
    const indexer2 = buildIndexer(dir, logger);
    await indexer2.bootstrap();

    const index = indexer2.getIndex();
    expect(index.projects.size).toBe(1);
    expect(index.projects.has(INBOX_PROJECT_ID)).toBe(true);
  });

  it('Inbox project has is_inbox: true and name: Inbox', async () => {
    const indexer = buildIndexer(dir, logger);
    await indexer.bootstrap();

    const index = indexer.getIndex();
    const inbox = index.projects.get(INBOX_PROJECT_ID);
    expect(inbox?.is_inbox).toBe(true);
    expect(inbox?.name).toBe('Inbox');
    expect(inbox?.folder_id).toBeNull();
    expect(inbox?.sort_order).toBe(0);
  });
});
