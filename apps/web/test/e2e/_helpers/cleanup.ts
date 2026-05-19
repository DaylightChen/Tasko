/**
 * E2E test cleanup helpers.
 *
 * Wipes all active items and empties the trash so each test starts from a
 * clean slate. Must be called in beforeEach / afterEach hooks.
 */

const API_BASE = 'http://localhost:7373/api';

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
 */
export async function cleanupAll(): Promise<void> {
  await deleteAllActiveItems();
  await emptyTrash();
  await deleteAllUserProjects();
  // Second pass in case deleting projects created trash entries
  await emptyTrash();
}
