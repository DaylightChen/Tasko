/**
 * keyboard-help.spec.ts
 *
 * Validates: Task-18 keyboard shortcut help overlay — press "?" → overlay
 * appears; press "?" again (or Escape) → dismisses.
 *
 * Requires: dev server running on localhost:5173.
 */
import { expect, test } from '@playwright/test';
import { cleanupAll } from './_helpers/cleanup';
import { seedItem } from './_helpers/setup';
import { waitForPageReady } from './_helpers/wait';

const TODAY = new Date().toISOString().slice(0, 10);

test.describe('Keyboard help overlay', () => {
  // We seed one item so /today renders the populated branch rather than the
  // first-run empty branch, which auto-focuses QuickAddInput and pushes the
  // hotkey provider into mode='input' (which suppresses `?`).
  test.beforeEach(async () => {
    await cleanupAll();
    await seedItem({ title: 'Hotkey probe', due_date: TODAY });
  });

  test.afterEach(async () => {
    await cleanupAll();
  });

  // Playwright's headless chromium does not apply an OS keyboard layout, so
  // `keyboard.press('Shift+/')` dispatches `e.key === '/'` (not `'?'`) and the
  // app's `?` hotkey never matches. Real users on real keyboards send `?`
  // directly, so dispatch a synthetic event with the correct `e.key`.
  async function pressQuestionMark(page: import('@playwright/test').Page): Promise<void> {
    await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true, bubbles: true }));
    });
  }

  test('? toggles the shortcut help overlay', async ({ page }) => {
    await page.goto('/today');
    await waitForPageReady(page);

    await pressQuestionMark(page);

    // The overlay is rendered as <dialog aria-label="Keyboard shortcuts">.
    // `[role="dialog"]` is an attribute selector and doesn't match `<dialog>`'s
    // implicit role — use the aria-label or `getByRole`.
    const overlay = page.locator('dialog[aria-label="Keyboard shortcuts"]');
    await expect(overlay).toBeVisible({ timeout: 5_000 });

    await pressQuestionMark(page);
    await expect(overlay).not.toBeVisible({ timeout: 3_000 });
  });

  test('Escape also dismisses the overlay', async ({ page }) => {
    await page.goto('/today');
    await waitForPageReady(page);

    await pressQuestionMark(page);
    // The overlay is rendered as <dialog aria-label="Keyboard shortcuts">.
    // `[role="dialog"]` is an attribute selector and doesn't match `<dialog>`'s
    // implicit role — use the aria-label or `getByRole`.
    const overlay = page.locator('dialog[aria-label="Keyboard shortcuts"]');
    await expect(overlay).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press('Escape');
    await expect(overlay).not.toBeVisible({ timeout: 3_000 });
  });
});
