/**
 * priority-menu-colors.spec.ts
 *
 * Regression test for: the priority pills in the Task modal used hardcoded
 * colors that didn't match the design-language tokens used on the task
 * row. The most visible mismatch: `Low` was green (#22c55e) in the menu
 * but renders gray on the task row (per docs/ux/design-language.md §2.7,
 * `priority-low` is `#9CA3AF` — "Subtle gray"). So picking "Low" in the
 * menu set the task row's dot to gray, surprising the user.
 *
 * Fix: PriorityMenu now uses `var(--color-priority-low/medium/high)` so
 * the dot in the menu matches what the row renders.
 *
 * Non-destructive: opens the Add task modal via quick-add, reads the
 * computed background-color of each priority pill's dot, and asserts the
 * menu's color exactly equals the design-token color the row would use.
 * Doesn't save the task.
 */
import { expect, test } from '@playwright/test';

test('priority menu pill colors match the design tokens used on the task row', async ({ page }) => {
  await page.goto('/today');
  await page.waitForLoadState('domcontentloaded');

  // Open the Add task modal via quick-add (no save)
  const quickAdd = page.getByRole('textbox', { name: /add task/i });
  await expect(quickAdd).toBeVisible();
  await quickAdd.fill('priority-color-regression');
  await quickAdd.press('Enter');

  const modal = page.locator('[role="dialog"]').first();
  await expect(modal).toBeVisible();

  // Read the design-language token values from :root + the actual dot bg
  // for each priority pill. We compare two computed strings — they should
  // be identical (same rgb).
  const result = await modal.evaluate((modalEl) => {
    function bg(el: Element | null | undefined) {
      return el ? getComputedStyle(el).backgroundColor : null;
    }
    const root = document.documentElement;
    const rootStyle = getComputedStyle(root);
    const tokenLow = rootStyle.getPropertyValue('--color-priority-low').trim();
    const tokenMedium = rootStyle.getPropertyValue('--color-priority-medium').trim();
    const tokenHigh = rootStyle.getPropertyValue('--color-priority-high').trim();

    // Each pill is a <label> wrapping a hidden <input type="radio"> + a
    // colored .dot span + a label. We can find each pill by its label text.
    const pills = Array.from(modalEl.querySelectorAll('label')).filter((el) =>
      /^(None|Low|Medium|High)$/i.test(el.textContent?.trim() ?? ''),
    );
    const byName: Record<string, Element | null> = { None: null, Low: null, Medium: null, High: null };
    for (const pill of pills) {
      const name = (pill.textContent ?? '').trim().match(/(None|Low|Medium|High)/i)?.[0] ?? '';
      byName[name] = pill.querySelector('[class*="dot"]');
    }
    return {
      tokenLow,
      tokenMedium,
      tokenHigh,
      dotLowBg: bg(byName.Low),
      dotMediumBg: bg(byName.Medium),
      dotHighBg: bg(byName.High),
    };
  });

  // Helper: normalize "#9ca3af" hex to "rgb(156, 163, 175)" so it can be
  // compared against the computed-style format.
  function hexToRgb(hex: string): string {
    const m = hex.replace('#', '').match(/^([0-9a-f]{6})$/i);
    if (!m) return hex;
    const v = m[0];
    const r = Number.parseInt(v.slice(0, 2), 16);
    const g = Number.parseInt(v.slice(2, 4), 16);
    const b = Number.parseInt(v.slice(4, 6), 16);
    return `rgb(${r}, ${g}, ${b})`;
  }

  expect(result.dotLowBg, 'Low dot must match --color-priority-low').toBe(hexToRgb(result.tokenLow));
  expect(result.dotMediumBg, 'Medium dot must match --color-priority-medium').toBe(
    hexToRgb(result.tokenMedium),
  );
  expect(result.dotHighBg, 'High dot must match --color-priority-high').toBe(hexToRgb(result.tokenHigh));

  // Close the modal — discard the pre-filled title to leave no trace.
  await page.keyboard.press('Escape');
  const discard = page.getByRole('button', { name: /discard/i });
  if (await discard.isVisible().catch(() => false)) {
    await discard.click();
  }
});
