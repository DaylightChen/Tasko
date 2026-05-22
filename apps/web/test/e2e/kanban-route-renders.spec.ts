/**
 * kanban-route-renders.spec.ts
 *
 * Regression test for: navigating to /project/<id>/kanban silently fell
 * back to the parent's tree/flat-list view because `project.$id.tsx`
 * rendered its component directly (no <Outlet />). With nested file-based
 * routes (`project.$id.kanban.tsx`), the parent must be a layout that
 * renders <Outlet /> or the child route never mounts.
 *
 * Fix: split into `project.$id.tsx` (Outlet-only layout) and a new
 * `project.$id.index.tsx` (the default TreeView / FlatListView).
 *
 * Non-destructive: picks the first non-Inbox project from the API and
 * navigates to its /kanban route. Asserts the three column headers
 * ("To Do", "In Progress", "Done") render — they don't exist on the
 * tree/flat view, so this distinguishes the bug from the fix.
 *
 * Requires: dev server running on localhost:5173 with at least one
 * non-Inbox project.
 */
import { expect, test } from '@playwright/test';

test('navigating to /project/<id>/kanban renders the kanban board, not the tree/flat list', async ({
  page,
}) => {
  await page.goto('/today');
  await page.waitForLoadState('domcontentloaded');

  // Pick a non-Inbox project that has at least one task — kanban renders an
  // empty-state when there are zero tasks (no column headers), which we
  // can't distinguish from a routing bug. Find a project with items.
  const data = await page.evaluate(async () => {
    const [pj, it] = await Promise.all([
      fetch('/api/projects').then((r) => r.json()),
      fetch('/api/items?include_completed=true&limit=200').then((r) => r.json()),
    ]);
    return { projects: pj.projects, items: it.items } as {
      projects: Array<{ id: string; is_inbox: boolean; name: string }>;
      items: Array<{ project_id: string; type: string }>;
    };
  });
  const projectIdsWithTasks = new Set(data.items.filter((i) => i.type === 'task').map((i) => i.project_id));
  const target = data.projects.find((p) => !p.is_inbox && projectIdsWithTasks.has(p.id));
  if (!target) {
    test.skip(true, 'No non-Inbox project with at least one task in dev data — cannot assert kanban columns');
    return;
  }

  await page.goto(`/project/${target.id}/kanban`);
  await page.waitForLoadState('domcontentloaded');
  // Allow router + dnd-kit + react-query to settle
  await page.waitForTimeout(300);

  const main = page.locator('section[aria-label="Kanban board"]');
  await expect(main).toBeVisible();

  // The three fixed columns must exist
  for (const label of ['To Do', 'In Progress', 'Done']) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }

  // Regression for: "I cannot go back after going to kanban". The kanban view
  // must include the ViewToggle in its header. Picking the non-kanban option
  // (Tree or List depending on the project) navigates back to /project/<id>.
  const treeBtn = page.getByRole('tab', { name: /Tree view|List view/ });
  await expect(treeBtn).toBeVisible();
  await treeBtn.click();
  await expect(page).toHaveURL(new RegExp(`/project/${target.id}/?$`));
  // The kanban <section> must be gone now (we're back on the index route).
  await expect(page.locator('section[aria-label="Kanban board"]')).toHaveCount(0);
});
