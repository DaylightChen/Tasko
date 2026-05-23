/**
 * E2E test cleanup helpers.
 *
 * Wipes all active items and empties the trash so each test starts from a
 * clean slate. Must be called in beforeEach / afterEach hooks.
 *
 * ── DATA-DIR SAFETY GUARD ──────────────────────────────────────────────────
 * This module mutates whatever data dir the server on :7373 is serving. To
 * prevent accidental destruction of a developer's real `~/Documents/.tasko-data`
 * (which happened during the v0.1 polish pass before this guard existed),
 * `cleanupAll` first calls `/api/health`, reads `data_dir`, and ABORTS with a
 * loud error if the path is not the project-local `.tasko-data-test/`.
 *
 * Pair this with `pnpm dev:test` (sets TASKO_DATA_DIR=$PWD/.tasko-data-test).
 */

const API_BASE = 'http://localhost:7373/api';

const EXPECTED_DATA_DIR_SUFFIX = '/.tasko-data-test';

let dataDirVerified = false;

/**
 * Ask /api/health what data dir the server is serving, and refuse to proceed
 * unless it looks like a project-local test dir. Cached after the first call
 * so we don't pay an HTTP round-trip per beforeEach.
 */
async function assertTestDataDir(): Promise<void> {
  if (dataDirVerified) return;

  let dataDir: string;
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) {
      throw new Error(`/api/health returned ${res.status}`);
    }
    const body = (await res.json()) as { data_dir?: unknown };
    if (typeof body.data_dir !== 'string') {
      throw new Error('/api/health response missing string `data_dir`');
    }
    dataDir = body.data_dir;
  } catch (err) {
    throw new Error(
      `E2E cleanup aborted: could not verify the server's data_dir via /api/health.\nIs the dev server running on :7373?\nOriginal error: ${err instanceof Error ? err.message : String(err)}\nStart the test-isolated server with:  pnpm dev:test`,
    );
  }

  if (!dataDir.endsWith(EXPECTED_DATA_DIR_SUFFIX)) {
    throw new Error(
      `E2E cleanup aborted: the server on :7373 is serving "${dataDir}", which is NOT a project-local test data dir. Running the cleanup helpers against this server would delete real data.\n\nStop the current server and run:  pnpm dev:test\n(or set TASKO_DATA_DIR to an absolute path ending in "${EXPECTED_DATA_DIR_SUFFIX}")`,
    );
  }

  dataDirVerified = true;
}

/**
 * Delete all active (non-trashed) items.
 */
async function deleteAllActiveItems(): Promise<void> {
  const res = await fetch(`${API_BASE}/items?include_completed=true&limit=1000`);
  if (!res.ok) return;
  const data = (await res.json()) as { items: Array<{ id: string }> };
  for (const item of data.items ?? []) {
    await fetch(`${API_BASE}/items/${item.id}`, { method: 'DELETE' }).catch(() => {});
  }
}

/**
 * Empty the trash (permanently delete all trashed items).
 */
async function emptyTrash(): Promise<void> {
  await fetch(`${API_BASE}/trash/empty`, { method: 'POST' }).catch(() => {});
}

/**
 * Delete all user-created projects (skip Inbox sentinel).
 */
async function deleteAllUserProjects(): Promise<void> {
  const res = await fetch(`${API_BASE}/projects`);
  if (!res.ok) return;
  const data = (await res.json()) as { projects: Array<{ id: string; is_inbox: boolean }> };
  for (const project of data.projects ?? []) {
    if (!project.is_inbox) {
      await fetch(`${API_BASE}/projects/${project.id}`, { method: 'DELETE' }).catch(() => {});
    }
  }
}

/**
 * Full cleanup: delete all active items, empty trash, delete user projects.
 * Call in beforeEach to start each test from a known clean state.
 *
 * Refuses to run unless the server's `data_dir` ends in `.tasko-data-test/`.
 */
export async function cleanupAll(): Promise<void> {
  await assertTestDataDir();
  await deleteAllActiveItems();
  await emptyTrash();
  await deleteAllUserProjects();
  // Second pass in case deleting projects created trash entries
  await emptyTrash();
}
