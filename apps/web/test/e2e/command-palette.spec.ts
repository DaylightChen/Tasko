/**
 * command-palette.spec.ts
 *
 * Validates: Task-18 command palette — open via ⌘K / Ctrl+K, type "today",
 * "Go to Today" is highlighted, Enter navigates. Verifies "Go to <project>"
 * dynamic commands appear when projects exist.
 *
 * Requires: dev server running on localhost:5173.
 */
import { expect, test } from '@playwright/test';
import { cleanupAll } from './_helpers/cleanup';
import { seedProject } from './_helpers/setup';
import { waitForPageReady } from './_helpers/wait';

test.describe('Command palette', () => {
  test.beforeEach(async () => {
    await cleanupAll();
  });

  test.afterEach(async () => {
    await cleanupAll();
  });

  test('opens with Mod+K and navigates to Today', async ({ page }) => {
    await page.goto('/inbox');
    await waitForPageReady(page);

    await page.keyboard.press('Meta+k');

    const dialog = page.locator('[aria-label="Command palette"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    const cmdkInput = page.locator('input[aria-label="Type a command"]');
    await cmdkInput.click();
    await cmdkInput.fill('today');

    const todayItem = page.locator('[cmdk-item]', { hasText: 'Go to Today' });
    await expect(todayItem).toBeVisible();

    await cmdkInput.focus();
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/today/, { timeout: 5_000 });
    await expect(dialog).not.toBeVisible();
  });

  test('shows dynamic Go to <project> commands', async ({ page }) => {
    await seedProject({ name: 'My Test Project' });

    await page.goto('/today');
    await waitForPageReady(page);

    // Open command palette
    await page.keyboard.press('Meta+k');

    const dialog = page.locator('[aria-label="Command palette"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Type the project name
    await page.keyboard.type('My Test Project');

    // Dynamic "Go to My Test Project" command should appear
    const projectItem = page.locator('[cmdk-item]', { hasText: 'My Test Project' });
    await expect(projectItem).toBeVisible({ timeout: 5_000 });
  });

  test('dismisses on Escape', async ({ page }) => {
    await page.goto('/today');
    await waitForPageReady(page);

    await page.keyboard.press('Meta+k');
    const dialog = page.locator('[aria-label="Command palette"]');
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible({ timeout: 3_000 });
  });
});
