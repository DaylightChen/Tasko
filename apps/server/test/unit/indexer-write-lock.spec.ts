import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildIndexer } from '../../src/store/indexer.js';

async function makeDataDir(base: string) {
  await mkdir(join(base, 'items'), { recursive: true });
  await mkdir(join(base, 'trash'), { recursive: true });
  await mkdir(join(base, 'projects'), { recursive: true });
  await mkdir(join(base, 'folders'), { recursive: true });
  await mkdir(join(base, 'tags'), { recursive: true });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('indexer write lock serialization', () => {
  let dir: string;
  const logger = { warn: (_msg: string) => {} };

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tasko-lock-test-'));
    await makeDataDir(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true });
  });

  it('serializes 5 concurrent withWriteLock calls', async () => {
    const indexer = buildIndexer(dir, logger);
    await indexer.bootstrap();

    const order: number[] = [];
    const inFlight: number[] = [];

    const tasks = [0, 1, 2, 3, 4].map((i) =>
      indexer.withWriteLock(async () => {
        // Assert no other task is simultaneously inside the lock.
        inFlight.push(i);
        expect(inFlight).toHaveLength(1);
        await delay(5);
        order.push(i);
        inFlight.splice(inFlight.indexOf(i), 1);
      }),
    );

    await Promise.all(tasks);
    expect(order).toHaveLength(5);
    // All 5 tasks completed; order is sequential (FIFO via the chain).
    expect(new Set(order).size).toBe(5);
  });

  it('returns the value from the locked function', async () => {
    const indexer = buildIndexer(dir, logger);
    await indexer.bootstrap();

    const result = await indexer.withWriteLock(async () => 42);
    expect(result).toBe(42);
  });

  it('propagates errors from the locked function', async () => {
    const indexer = buildIndexer(dir, logger);
    await indexer.bootstrap();

    await expect(
      indexer.withWriteLock(async () => {
        throw new Error('lock error');
      }),
    ).rejects.toThrow('lock error');
  });

  it('continues processing after a failed task', async () => {
    const indexer = buildIndexer(dir, logger);
    await indexer.bootstrap();

    const results: string[] = [];

    await Promise.allSettled([
      indexer.withWriteLock(async () => {
        results.push('first');
      }),
      indexer.withWriteLock(async () => {
        throw new Error('fail');
      }),
      indexer.withWriteLock(async () => {
        results.push('third');
      }),
    ]);

    expect(results).toContain('first');
    expect(results).toContain('third');
  });
});
