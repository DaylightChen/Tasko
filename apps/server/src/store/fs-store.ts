import { randomUUID } from 'node:crypto';
// NOTE: On Windows, `fs.rename` across volumes is not atomic. For v1 (desktop-only on a
// local POSIX filesystem) the tmp+rename pattern is correct. If a future version targets
// Windows network mounts, fall back to copyFile + unlink and log a warning.
import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export async function atomicWrite(path: string, contents: string): Promise<void> {
  const tmp = `${path}.${randomUUID()}.tmp`;
  await writeFile(tmp, contents, 'utf8');
  await rename(tmp, path);
}

export async function readJsonFile<T>(path: string, parse: (raw: unknown) => T): Promise<T | null> {
  try {
    const raw = await readFile(path, 'utf8');
    return parse(JSON.parse(raw) as unknown);
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      return null;
    }
    throw err;
  }
}

export async function listDir(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      return [];
    }
    throw err;
  }
}

export async function moveFile(from: string, to: string): Promise<void> {
  await rename(from, to);
}

export async function deleteFile(path: string): Promise<void> {
  await unlink(path);
}

// Serialize with 2-space indent + trailing newline (git-diff friendly per architecture.md §2.9).
export function stringify(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
