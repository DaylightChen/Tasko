import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
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

const now = new Date().toISOString();

const validItem = {
  id: '01HWABCDEFGHJKMNPQRSTVWXYZ',
  schema_version: 1,
  type: 'task',
  project_id: INBOX_PROJECT_ID,
  parent_id: null,
  title: 'Test item',
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

const validProject = {
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

describe('indexer bootstrap', () => {
  let dir: string;
  let warnMessages: string[];
  let logger: { warn: (msg: string) => void };

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tasko-bootstrap-test-'));
    await makeDataDir(dir);
    warnMessages = [];
    logger = {
      warn: (msg: string) => {
        warnMessages.push(msg);
      },
    };
  });

  afterEach(async () => {
    await rm(dir, { recursive: true });
  });

  it('indexes a valid item file', async () => {
    await writeFile(join(dir, 'projects', `${INBOX_PROJECT_ID}.json`), JSON.stringify(validProject));
    await writeFile(join(dir, 'items', `${validItem.id}.json`), JSON.stringify(validItem));

    const indexer = buildIndexer(dir, logger);
    const stats = await indexer.bootstrap();
    expect(stats.items).toBe(1);
    const index = indexer.getIndex();
    expect(index.items.has(validItem.id as Parameters<typeof index.items.has>[0])).toBe(true);
    const item = index.items.get(validItem.id as Parameters<typeof index.items.get>[0]);
    expect(item?.title).toBe('Test item');
  });

  it('skips corrupted JSON and logs a warning', async () => {
    await writeFile(join(dir, 'projects', `${INBOX_PROJECT_ID}.json`), JSON.stringify(validProject));
    // Good item
    await writeFile(join(dir, 'items', `${validItem.id}.json`), JSON.stringify(validItem));
    // Corrupted item
    await writeFile(join(dir, 'items', '01HWABCDEFGHJKMNPQRSTVWXY0.json'), 'not-valid-json{{{');

    const indexer = buildIndexer(dir, logger);
    const stats = await indexer.bootstrap();
    expect(stats.items).toBe(1);
    expect(stats.warnings.length).toBeGreaterThan(0);
    expect(warnMessages.length).toBeGreaterThan(0);
    // Good item still indexed
    const index = indexer.getIndex();
    expect(index.items.size).toBe(1);
  });

  it('skips a file with schema validation errors and logs a warning', async () => {
    await writeFile(join(dir, 'projects', `${INBOX_PROJECT_ID}.json`), JSON.stringify(validProject));
    // Item with missing required fields
    await writeFile(
      join(dir, 'items', '01HWABCDEFGHJKMNPQRSTVWXY1.json'),
      JSON.stringify({ id: '01HWABCDEFGHJKMNPQRSTVWXY1', title: 'bad' }),
    );

    const indexer = buildIndexer(dir, logger);
    const stats = await indexer.bootstrap();
    expect(stats.items).toBe(0);
    expect(stats.warnings.length).toBeGreaterThan(0);
  });

  it('indexes a valid project', async () => {
    await writeFile(join(dir, 'projects', `${INBOX_PROJECT_ID}.json`), JSON.stringify(validProject));

    const indexer = buildIndexer(dir, logger);
    const stats = await indexer.bootstrap();
    expect(stats.projects).toBe(1);
    const index = indexer.getIndex();
    expect(index.projects.has(INBOX_PROJECT_ID)).toBe(true);
  });
});
