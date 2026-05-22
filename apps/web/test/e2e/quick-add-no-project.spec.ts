/**
 * quick-add-no-project.spec.ts
 *
 * Validates: Task-07 form validation — from /today, type "X" in quick-add
 * and press Enter → Task modal opens; click Save without picking a project →
 * validation error "Pick a project." appears inline.
 *
 * Requires: dev server running on localhost:5173.
 */
import { expect, test } from '@playwright/test';
import { cleanupAll } from './_helpers/cleanup';

test.describe('Quick-add → Task modal validation', () => {
  test.beforeEach(async () => {
    await cleanupAll();
  });

  test('Save without project shows Pick a project. error', async ({ page }) => {
    await page.goto('/today');
    await page.waitForLoadState('networkidle');

    // Type in quick-add input
    const quickAdd = page.getByRole('textbox', { name: 'Add task' });
    await expect(quickAdd).toBeVisible();
    await quickAdd.fill('X');
    await quickAdd.press('Enter');

    // Task modal should open
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Modal should have title pre-filled
    const titleInput = modal.getByRole('textbox', { name: /title/i });
    await expect(titleInput).toHaveValue('X');

    // Click Save without picking a project — first we need a due date
    // The modal requires both title + due_date + project_id. Set a due date.
    // For this test: the title is already "X" and due_date will need to be set.
    // The form-state validate() returns false when project_id is not set.
    // We just need to try to save without a project to trigger the error.

    const saveBtn = modal.getByRole('button', { name: 'Save' });
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Validation error "Pick a project." should appear
    const projectError = modal.locator('text="Pick a project."');
    await expect(projectError).toBeVisible({ timeout: 3_000 });
  });
});
