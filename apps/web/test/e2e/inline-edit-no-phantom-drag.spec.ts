/**
 * inline-edit-no-phantom-drag.spec.ts
 *
 * Regression test for: clicking a task title to inline-edit, then pressing
 * Enter to commit, left the row in `data-state="…drag-source-placeholder"`.
 * Symptom: the row's checkbox, priority dot, date chips, and tag chips
 * disappear — only the title text remains. A blinking caret stays visible
 * because the row is in placeholder mode.
 *
 * Root cause: dnd-kit's `useSortable` returns an `onKeyDown` listener that
 * the row spread on its <li>. Enter bubbles from the inline-edit <input>
 * to the <li>, dnd-kit's KeyboardSensor sees Enter on the activator, and
 * activates a phantom keyboard drag with no follow-up keystroke to end it.
 *
 * Fix in lib/dnd-keydown.ts: guard the forwarded onKeyDown so it skips
 * keydowns that bubbled from a text-entry descendant (INPUT / TEXTAREA /
 * contentEditable).
 *
 * Non-destructive: clicks the title, presses Enter immediately, asserts the
 * row is restored. Does not type anything into the input (so the title is
 * never modified — `editValue.trim() || item.title` falls back to the
 * original title and the commit becomes a no-op).
 *
 * Requires: dev server running on localhost:5173 with at least one task
 * visible in /today.
 */
import { expect, test } from '@playwright/test';

test('clicking a task title then pressing Enter does not leave the row in drag-placeholder state', async ({
  page,
}) => {
  await page.goto('/today');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(300);

  const title = page.locator('button[data-state="inline-editable"]').first();
  const count = await page.locator('button[data-state="inline-editable"]').count();
  test.skip(count === 0, 'No tasks in dev data dir — cannot run inline-edit assertion');

  // Identify the row LI so we can re-locate it after the input mounts.
  const itemId = await title.evaluate((el) => el.closest<HTMLLIElement>('li')?.dataset.itemId ?? null);
  expect(itemId).toBeTruthy();
  const row = page.locator(`li[data-item-id="${itemId}"]`);

  await expect(title).toBeVisible();

  // Enter inline-edit mode.
  await title.click();
  const input = page.locator('input[aria-label="Edit task title"]');
  await expect(input).toBeVisible();

  // Press Enter immediately — no typing — so the value is unchanged and the
  // commit is a no-op. We're testing the keyboard side-effect on dnd-kit,
  // not the patch path.
  await input.press('Enter');

  // The row must NOT be stuck in placeholder mode.
  await expect(row).toHaveAttribute('data-state', /^(?!.*\bdrag-source-placeholder\b).*$/);

  // And the input must have been replaced by the title button again.
  await expect(input).toHaveCount(0);
  await expect(row.locator('button[data-state="inline-editable"]')).toBeVisible();
});
