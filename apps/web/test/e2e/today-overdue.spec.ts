/**
 * today-overdue.spec.ts
 *
 * Validates: Task-08 overdue strip — seed 3 overdue items, navigate to /today,
 * assert "Overdue (3)" heading visible, click "Move all overdue to today",
 * confirm, strip disappears + items appear in Today section, click Undo,
 * items return to Overdue.
 *
 * Requires: dev server running on localhost:5173 (Vite proxy → :7373).
 */
import { expect, test } from '@playwright/test';
import { cleanupAll } from './_helpers/cleanup';
import { seedItems } from './_helpers/setup';

const YESTERDAY = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
const LAST_WEEK = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);

test.describe('Today view — overdue strip', () => {
  test.beforeEach(async () => {
    await cleanupAll();
  });

  test.afterEach(async () => {
    await cleanupAll();
  });

  test('shows Overdue strip + bulk move + Undo', async ({ page }) => {
    // Seed 3 overdue items
    await seedItems([
      { title: 'Overdue task 1', due_date: YESTERDAY },
      { title: 'Overdue task 2', due_date: LAST_WEEK },
      { title: 'Overdue task 3', due_date: LAST_WEEK },
    ]);

    await page.goto('/today');
    await page.waitForLoadState('networkidle');

    // Assert overdue section heading
    const overdueHeading = page.locator('h2', { hasText: 'Overdue (3)' });
    await expect(overdueHeading).toBeVisible();

    // Click "Move all overdue to today"
    const moveBtn = page.getByRole('button', { name: 'Move all overdue to today' });
    await expect(moveBtn).toBeVisible();
    await moveBtn.click();

    // Confirm the dialog
    const confirmBtn = page.getByRole('button', { name: 'Move all' });
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // Strip should disappear
    await expect(overdueHeading).not.toBeVisible({ timeout: 5_000 });

    // All 3 items should now be in the Today section
    const todaySection = page.locator('section[aria-label*="Today"]');
    await expect(todaySection.getByText('Overdue task 1')).toBeVisible();
    await expect(todaySection.getByText('Overdue task 2')).toBeVisible();
    await expect(todaySection.getByText('Overdue task 3')).toBeVisible();

    // Undo via snackbar
    const undoBtn = page.getByRole('button', { name: 'Undo' });
    await expect(undoBtn).toBeVisible({ timeout: 5_000 });
    await undoBtn.click();

    // Overdue strip should return
    await expect(overdueHeading).toBeVisible({ timeout: 5_000 });
  });
});
