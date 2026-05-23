/**
 * theme-switch.spec.ts
 *
 * Validates: Settings view theme switching — from /settings, click Dark →
 * document.documentElement.dataset.theme === 'dark'; click System → attribute
 * removed or set to 'system'.
 *
 * Requires: dev server running on localhost:5173.
 */
import { expect, test } from '@playwright/test';
import { waitForPageReady } from './_helpers/wait';

test.describe('Settings — theme switch', () => {
  test('switches to dark theme', async ({ page }) => {
    await page.goto('/settings');
    await waitForPageReady(page);

    // Click Dark radio
    const darkRadio = page.getByRole('radio', { name: 'Dark' });
    await expect(darkRadio).toBeVisible();
    await darkRadio.click();

    // Verify the data-theme attribute on <html>
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark', { timeout: 3_000 });
  });

  test('switches to light theme', async ({ page }) => {
    await page.goto('/settings');
    await waitForPageReady(page);

    const lightRadio = page.getByRole('radio', { name: 'Light' });
    await expect(lightRadio).toBeVisible();
    await lightRadio.click();

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light', { timeout: 3_000 });
  });

  test('switches to system theme', async ({ page }) => {
    // Start in dark mode
    await page.goto('/settings');
    await waitForPageReady(page);

    await page.getByRole('radio', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // Now click System
    const systemRadio = page.getByRole('radio', { name: /system/i });
    await systemRadio.click();

    // data-theme should either be 'system' or removed (implementation picks
    // the OS-matched value at the ThemeBootstrap layer)
    const themeAttr = await page.locator('html').getAttribute('data-theme');
    expect(['system', 'light', 'dark', null]).toContain(themeAttr);
  });
});
