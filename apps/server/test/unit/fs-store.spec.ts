import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { atomicWrite, deleteFile, moveFile, readJsonFile } from '../../src/store/fs-store.js';

describe('fs-store', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tasko-fs-store-test-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true });
  });

  describe('atomicWrite', () => {
    it('writes file with correct content', async () => {
      const path = join(dir, 'test.json');
      await atomicWrite(path, '{"hello":"world"}\n');
      const content = await readFile(path, 'utf8');
      expect(content).toBe('{"hello":"world"}\n');
    });

    it('overwrites an existing file', async () => {
      const path = join(dir, 'test.json');
      await atomicWrite(path, 'first');
      await atomicWrite(path, 'second');
      const content = await readFile(path, 'utf8');
      expect(content).toBe('second');
    });

    it('leaves no stray .tmp files after success', async () => {
      const path = join(dir, 'test.json');
      await atomicWrite(path, 'data');
      const { readdir } = await import('node:fs/promises');
      const files = await readdir(dir);
      const tmpFiles = files.filter((f) => f.endsWith('.tmp'));
      expect(tmpFiles).toHaveLength(0);
    });
  });

  describe('readJsonFile', () => {
    it('returns null for ENOENT', async () => {
      const result = await readJsonFile(join(dir, 'nonexistent.json'), (r) => r);
      expect(result).toBeNull();
    });

    it('parses and returns valid JSON through the parser', async () => {
      const path = join(dir, 'data.json');
      await atomicWrite(path, JSON.stringify({ foo: 42 }));
      const result = await readJsonFile(path, (r) => (r as { foo: number }).foo);
      expect(result).toBe(42);
    });

    it('throws when JSON is malformed', async () => {
      const path = join(dir, 'bad.json');
      await atomicWrite(path, 'not-json{');
      await expect(readJsonFile(path, (r) => r)).rejects.toThrow();
    });
  });

  describe('moveFile', () => {
    it('moves file to new location', async () => {
      const from = join(dir, 'a.json');
      const to = join(dir, 'b.json');
      await atomicWrite(from, 'content');
      await moveFile(from, to);
      const content = await readFile(to, 'utf8');
      expect(content).toBe('content');
      // Original should be gone
      await expect(stat(from)).rejects.toMatchObject({ code: 'ENOENT' });
    });
  });

  describe('deleteFile', () => {
    it('removes the file', async () => {
      const path = join(dir, 'to-delete.json');
      await atomicWrite(path, 'bye');
      await deleteFile(path);
      await expect(stat(path)).rejects.toMatchObject({ code: 'ENOENT' });
    });
  });
});
