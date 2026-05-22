/**
 * keyboard-help.spec.ts
 *
 * Validates: Task-18 keyboard shortcut help overlay — press "?" → overlay
 * appears; press "?" again (or Escape) → dismisses.
 *
 * Requires: dev server running on localhost:5173.
 */
import { expect, test } from '@playwright/test';

test.describe('Keyboard help overlay', () => {
  test('? toggles the shortcut help overlay', async ({ page }) => {
    await page.goto('/today');
    await page.waitForLoadState('networkidle');

    // Ensure no modal or input is focused before pressing ?
    await page.keyboard.press('Escape');

    // Press ? to open help overlay
    await page.keyboard.press('Shift+/');

    // Overlay should appear — look for the heading
    const overlay = page.locator('[role="dialog"]', { hasText: /keyboard shortcuts/i });
    await expect(overlay).toBeVisible({ timeout: 5_000 });

    // Press ? again to dismiss
    await page.keyboard.press('Shift+/');
    await expect(overlay).not.toBeVisible({ timeout: 3_000 });
  });

  test('Escape also dismisses the overlay', async ({ page }) => {
    await page.goto('/today');
    await page.waitForLoadState('networkidle');

    await page.keyboard.press('Shift+/');
    const overlay = page.locator('[role="dialog"]', { hasText: /keyboard shortcuts/i });
    await expect(overlay).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press('Escape');
    await expect(overlay).not.toBeVisible({ timeout: 3_000 });
  });
});
