/**
 * Smoke test: withWriteLock exposes the actual WriteOps interface.
 * Calls ops.writeItem(...) with a minimal valid Item and verifies:
 * 1. The file lands on disk at items/<id>.json.
 * 2. The in-memory index is updated (items.has(id) becomes true).
 * 3. The adjacency caches (topLevelByProject) are updated.
 *
 * Also tests the Inbox sentinel disk round-trip: when INBOX_PROJECT_ID.json
 * already exists on disk with is_inbox: true, a second bootstrap loads it
 * without creating a duplicate.
 */
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INBOX_PROJECT_ID, type Item, ItemIdSchema } from '@tasko/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildIndexer } from '../../src/store/indexer.js';

async function makeDataDir(base: string) {
  await mkdir(join(base, 'items'), { recursive: true });
  await mkdir(join(base, 'trash'), { recursive: true });
  await mkdir(join(base, 'projects'), { recursive: true });
  await mkdir(join(base, 'folders'), { recursive: true });
  await mkdir(join(base, 'tags'), { recursive: true });
}

const now = new Date().toISOString();

// A minimal valid item using INBOX_PROJECT_ID as parent project.
// Branded ids are obtained via ItemIdSchema.parse (ULID-valid string).
const TEST_ITEM_ID = ItemIdSchema.parse('01HWABCDEFGHJKMNPQRSTVWXYZ');

// Build the item object using the branded id. project_id is INBOX_PROJECT_ID which
// is already cast as ProjectId in the types package. The indexer uses ItemDiskSchema
// (relaxed) internally so INBOX_PROJECT_ID in project_id is accepted on disk reads.
const testItem: Item = {
  id: TEST_ITEM_ID,
  schema_version: 1,
  type: 'task',
  project_id: INBOX_PROJECT_ID,
  parent_id: null,
  title: 'Test write ops item',
  notes: '',
  due_date: '2026-06-01',
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
  sort_order: 512,
  created_at: now,
  updated_at: now,
};

describe('WriteOps interface via withWriteLock', () => {
  let dir: string;
  const logger = { warn: (_msg: string) => {} };

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tasko-write-ops-'));
    await makeDataDir(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true });
  });

  it('writeItem writes the file to disk', async () => {
    const indexer = buildIndexer(dir, logger);
    await indexer.bootstrap();

    await indexer.withWriteLock(async (_index, ops) => {
      await ops.writeItem(testItem);
    });

    const filePath = join(dir, 'items', `${TEST_ITEM_ID}.json`);
    const fileStat = await stat(filePath);
    expect(fileStat.isFile()).toBe(true);

    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed.id).toBe(TEST_ITEM_ID);
    expect(parsed.title).toBe('Test write ops item');
  });

  it('writeItem updates the in-memory index', async () => {
    const indexer = buildIndexer(dir, logger);
    await indexer.bootstrap();

    await indexer.withWriteLock(async (_index, ops) => {
      await ops.writeItem(testItem);
    });

    const index = indexer.getIndex();
    expect(index.items.has(TEST_ITEM_ID)).toBe(true);
    const stored = index.items.get(TEST_ITEM_ID);
    expect(stored?.title).toBe('Test write ops item');
  });

  it('writeItem updates topLevelByProject adjacency cache for top-level items', async () => {
    const indexer = buildIndexer(dir, logger);
    await indexer.bootstrap();

    await indexer.withWriteLock(async (_index, ops) => {
      await ops.writeItem(testItem);
    });

    const index = indexer.getIndex();
    const topLevel = index.topLevelByProject.get(INBOX_PROJECT_ID);
    expect(topLevel).toBeDefined();
    expect(topLevel?.has(TEST_ITEM_ID)).toBe(true);
  });

  it('removeItem removes the file from disk and updates the index', async () => {
    const indexer = buildIndexer(dir, logger);
    await indexer.bootstrap();

    // Write, then remove
    await indexer.withWriteLock(async (_index, ops) => {
      await ops.writeItem(testItem);
    });

    await indexer.withWriteLock(async (_index, ops) => {
      await ops.removeItem(testItem.id);
    });

    const filePath = join(dir, 'items', `${TEST_ITEM_ID}.json`);
    await expect(stat(filePath)).rejects.toMatchObject({ code: 'ENOENT' });
    const index = indexer.getIndex();
    expect(index.items.has(TEST_ITEM_ID)).toBe(false);
  });

  it('moveItemToTrash moves the item and updates both maps', async () => {
    const indexer = buildIndexer(dir, logger);
    await indexer.bootstrap();

    await indexer.withWriteLock(async (_index, ops) => {
      await ops.writeItem(testItem);
    });

    await indexer.withWriteLock(async (_index, ops) => {
      await ops.moveItemToTrash(testItem);
    });

    const index = indexer.getIndex();
    expect(index.items.has(TEST_ITEM_ID)).toBe(false);
    expect(index.trash.has(TEST_ITEM_ID)).toBe(true);

    // trash file should exist, items file should not
    const trashPath = join(dir, 'trash', `${TEST_ITEM_ID}.json`);
    const itemPath = join(dir, 'items', `${TEST_ITEM_ID}.json`);
    await expect(stat(trashPath)).resolves.toBeTruthy();
    await expect(stat(itemPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});

describe('Inbox sentinel disk round-trip', () => {
  let dir: string;
  const logger = { warn: (_msg: string) => {} };

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tasko-inbox-roundtrip-'));
    await makeDataDir(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true });
  });

  it('loads existing Inbox sentinel from disk without creating a duplicate', async () => {
    // Pre-seed the Inbox project file exactly as it would appear after first bootstrap
    const inboxProject = {
      id: INBOX_PROJECT_ID,
      schema_version: 1,
      name: 'Inbox',
      folder_id: null,
      is_hierarchical: false,
      color: null,
      icon: null,
      sort_order: 0,
      is_inbox: true,
      created_at: now,
      updated_at: now,
    };
    const inboxFilePath = join(dir, 'projects', `${INBOX_PROJECT_ID}.json`);
    await writeFile(inboxFilePath, `${JSON.stringify(inboxProject, null, 2)}\n`);

    const indexer = buildIndexer(dir, logger);
    const stats = await indexer.bootstrap();

    // Should have exactly 1 project (the pre-seeded Inbox, not a duplicate)
    const index = indexer.getIndex();
    expect(index.projects.size).toBe(1);
    expect(index.projects.has(INBOX_PROJECT_ID)).toBe(true);

    const inbox = index.projects.get(INBOX_PROJECT_ID);
    expect(inbox?.is_inbox).toBe(true);
    expect(inbox?.name).toBe('Inbox');

    // bootstrap stats.projects should count the pre-seeded one
    expect(stats.projects).toBe(1);
  });

  it('round-trips Inbox sentinel: write by bootstrap, re-read by second bootstrap', async () => {
    // First bootstrap: creates the Inbox sentinel
    const indexer1 = buildIndexer(dir, logger);
    await indexer1.bootstrap();

    // Second bootstrap: reads the file written by the first
    const indexer2 = buildIndexer(dir, logger);
    const stats2 = await indexer2.bootstrap();

    const index2 = indexer2.getIndex();
    expect(index2.projects.size).toBe(1);
    expect(index2.projects.has(INBOX_PROJECT_ID)).toBe(true);

    const inbox = index2.projects.get(INBOX_PROJECT_ID);
    expect(inbox?.is_inbox).toBe(true);

    // stats.projects should be 1 (loaded from disk), not 0 (which would mean bootstrap tried to create again)
    expect(stats2.projects).toBe(1);
  });
});
