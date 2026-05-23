/**
 * click-vs-drag.spec.ts
 *
 * Regression for the v0.1 DnD UX bug: clicking a task row could activate a
 * drag because the PointerSensor used `delay: 100ms, tolerance: 5px`. Modal-
 * open latency could exceed the delay window, so the row briefly entered
 * `data-state="drag-source-placeholder"` and occasionally reordered tasks
 * the user never intended to move.
 *
 * Fix: mouse uses `distance: 8` (drag only after movement), touch uses
 * `delay: 250` (drag only after a hold). This spec exercises the mouse
 * path because Playwright's headless chromium uses mouse events by default.
 *
 * Requires: dev server running on localhost:5173 (Vite proxy → :7373).
 */
import { expect, test } from '@playwright/test';
import { cleanupAll } from './_helpers/cleanup';
import { seedItems } from './_helpers/setup';
import { waitForPageReady } from './_helpers/wait';

const TODAY = new Date().toISOString().slice(0, 10);

test.describe('Click vs. drag activation', () => {
  test.beforeEach(async () => {
    await cleanupAll();
  });

  test.afterEach(async () => {
    await cleanupAll();
  });

  test('a slow click on a row never enters drag-source-placeholder state', async ({ page }) => {
    await seedItems([
      { title: 'Click target alpha', due_date: TODAY },
      { title: 'Click target beta', due_date: TODAY },
    ]);

    await page.goto('/today');
    await waitForPageReady(page);

    const row = page.locator('li[data-item-id]').first();
    await expect(row).toBeVisible();
    const box = await row.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    // Hold the mouse button down for 350ms — longer than the old 100ms
    // activation delay — without moving the cursor. With the new MouseSensor
    // (`distance: 8`) this must not start a drag because the pointer never
    // travelled. Under the old config this could (and did) flicker the row
    // into `drag-source-placeholder`.
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(350);

    const stateDuringHold = (await row.getAttribute('data-state')) ?? '';
    expect(stateDuringHold).not.toContain('drag-source-placeholder');

    await page.mouse.up();

    const stateAfterRelease = (await row.getAttribute('data-state')) ?? '';
    expect(stateAfterRelease).not.toContain('drag-source-placeholder');
  });

  test('an intentional drag (>= 8px movement) DOES activate drag mode', async ({ page }) => {
    await seedItems([
      { title: 'Drag source', due_date: TODAY },
      { title: 'Drag below', due_date: TODAY },
    ]);

    await page.goto('/today');
    await waitForPageReady(page);

    const row = page.locator('li[data-item-id]').first();
    await expect(row).toBeVisible();
    const box = await row.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    await page.mouse.move(x, y);
    await page.mouse.down();
    // Move 30px down in 6 steps so dnd-kit registers movement past the 8px
    // distance threshold. Steps matter — a single jump skips intermediate
    // pointermove events that dnd-kit's PointerEvent listener relies on.
    await page.mouse.move(x, y + 30, { steps: 6 });

    // Drag has activated — the row carries drag-source-placeholder and a
    // DragOverlay clone exists in the DOM.
    await expect(row).toHaveAttribute('data-state', /drag-source-placeholder/);

    await page.mouse.up();
  });
});
