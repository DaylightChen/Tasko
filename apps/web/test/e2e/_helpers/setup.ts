/**
 * E2E test setup helpers.
 *
 * POST items / projects to the API so each test can seed known data before
 * navigating to the page under test. The dev server must be running on
 * http://localhost:7373 for these to work.
 */

const API_BASE = 'http://localhost:7373/api';

export interface SeedItem {
  title: string;
  due_date: string;
  project_id?: string;
  status?: 'todo' | 'in_progress' | 'done';
  priority?: 'none' | 'low' | 'medium' | 'high';
  parent_id?: string;
  type?: 'epic' | 'feature' | 'task';
}

export interface SeedProject {
  name: string;
  is_hierarchical?: boolean;
  color?: string;
}

/**
 * Seed a single item via POST /api/items.
 *
 * The route schema (apps/server/src/routes/items.ts ItemCreateRouteSchema)
 * requires `type`, `parent_id`, `start_date`, `due_time`, `recurrence` to be
 * present (nullable but not optional). Send explicit `null`s for the ones
 * the test doesn't care about.
 */
export async function seedItem(item: SeedItem): Promise<{ id: string } & SeedItem> {
  const body: Record<string, unknown> = {
    type: item.type ?? 'task',
    title: item.title,
    due_date: item.due_date,
    project_id: item.project_id ?? '00000000000000000000INBOX0',
    status: item.status ?? 'todo',
    priority: item.priority ?? 'none',
    parent_id: item.parent_id ?? null,
    start_date: null,
    due_time: null,
    recurrence: null,
  };

  const res = await fetch(`${API_BASE}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`seedItem failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<{ id: string } & SeedItem>;
}

/**
 * Seed multiple items, returning their ids in order.
 */
export async function seedItems(items: SeedItem[]): Promise<Array<{ id: string } & SeedItem>> {
  const results: Array<{ id: string } & SeedItem> = [];
  for (const item of items) {
    results.push(await seedItem(item));
  }
  return results;
}

/**
 * Seed a project via POST /api/projects.
 *
 * ProjectCreateSchema requires `folder_id` and `icon` to be present
 * (nullable, not optional). Send explicit `null`s.
 */
export async function seedProject(project: SeedProject): Promise<{ id: string } & SeedProject> {
  const res = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: project.name,
      is_hierarchical: project.is_hierarchical ?? false,
      color: project.color ?? '#888888',
      folder_id: null,
      icon: null,
    }),
  });
  if (!res.ok) {
    throw new Error(`seedProject failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<{ id: string } & SeedProject>;
}
