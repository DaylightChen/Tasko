/**
 * date-picker-renders.spec.ts
 *
 * Regression test for: clicking Due date / Start date in the Add task
 * modal opened an invisible picker — the `<dialog>` is absolutely positioned
 * by the UA stylesheet, so the floating-popover wrapper collapsed to 2px and
 * the wrapper's `overflow: hidden` then clipped the calendar to a 2x2 box.
 *
 * jsdom unit tests don't paint, so they reported the picker as "visible" via
 * aria-expanded + non-empty innerHTML. This spec is the only place we can
 * catch the visual clipping regression — it asserts the popover wrapper has
 * real dimensions matching the inner calendar.
 *
 * Non-destructive: opens the modal, clicks the date triggers, then Escapes
 * out without saving — does NOT mutate any data, so it deliberately does not
 * run `cleanupAll`. If a future maintainer adds save/seed steps here, wrap
 * them with the cleanup helpers per the rest of the suite.
 *
 * Requires: dev server running on localhost:5173 (Vite proxy → :7373).
 */
import { expect, test } from '@playwright/test';

test.describe('DatePicker — popover is actually painted, not clipped', () => {
  test('Due date and Start date pickers render the calendar at full size', async ({ page }) => {
    await page.goto('/today');
    await page.waitForLoadState('domcontentloaded');

    // Open the Add task modal via quick-add. Press Enter without saving;
    // the modal opens with a pre-filled title.
    const quickAdd = page.getByRole('textbox', { name: /add task/i });
    await expect(quickAdd).toBeVisible();
    await quickAdd.fill('regression-date-picker-renders');
    await quickAdd.press('Enter');

    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible();

    // ── Due date ──────────────────────────────────────────────────────────
    const dueBtn = modal.getByRole('button', { name: /pick a due date|due date:/i });
    await expect(dueBtn).toBeVisible();
    await dueBtn.click();

    await assertCalendarPainted(page, dueBtn);

    // Toggle the Due date picker closed by clicking the trigger again.
    // (Escape currently bubbles out of the <dialog> and closes the modal too —
    // that's a separate event-propagation bug worth fixing later; for this
    // regression spec we sidestep it to keep the test focused.)
    await dueBtn.click();
    await expect(page.locator('dialog[aria-label="Pick a date"]')).toHaveCount(0);

    // ── Start date ────────────────────────────────────────────────────────
    const startBtn = modal.getByRole('button', { name: /pick a start date|start date:/i });
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    await assertCalendarPainted(page, startBtn);

    // Close the Start date picker the same way.
    await startBtn.click();
    await expect(page.locator('dialog[aria-label="Pick a date"]')).toHaveCount(0);
  });
});

/**
 * Assert that the open DatePicker calendar dialog is actually painted at
 * its real size AND anchored near the trigger button — not clipped to ~2px
 * (overflow:hidden regression), not floating at viewport (0,0) (missing
 * anchorEl regression).
 *
 * Why this check rather than `toBeVisible()`: in the clipping regression,
 * the inner <dialog> reported a 340×377 boundingClientRect even though the
 * parent wrapper was 2×2 with overflow:hidden. `toBeVisible` and
 * `getBoundingClientRect` lied; only the wrapper's clipped paint box told
 * the truth. So we measure the wrapper, the actual rendering surface.
 * And in the anchoring regression, the picker still has full dimensions —
 * it just appears at the top-left corner instead of near its trigger.
 */
async function assertCalendarPainted(
  page: import('@playwright/test').Page,
  trigger: import('@playwright/test').Locator,
) {
  const calendar = page.locator('dialog[aria-label="Pick a date"]').first();
  await expect(calendar).toBeVisible();

  const measurements = await page.evaluate(() => {
    const dlg = document.querySelector<HTMLDialogElement>('dialog[aria-label="Pick a date"]');
    if (!dlg) return null;
    const dlgRect = dlg.getBoundingClientRect();
    const wrapper = dlg.parentElement;
    const wrapperRect = wrapper?.getBoundingClientRect() ?? null;
    return {
      dialog: { width: dlgRect.width, height: dlgRect.height },
      wrapper: wrapperRect
        ? { x: wrapperRect.x, y: wrapperRect.y, width: wrapperRect.width, height: wrapperRect.height }
        : null,
    };
  });

  expect(measurements, 'date dialog element should be present in DOM').not.toBeNull();
  if (!measurements) throw new Error('measurements unexpectedly null after assertion');
  const { dialog, wrapper } = measurements;

  // Dialog must actually have realistic calendar dimensions.
  expect(dialog.width).toBeGreaterThan(200);
  expect(dialog.height).toBeGreaterThan(200);

  // The wrapper around the dialog must NOT have collapsed (regression: 2x2).
  // We require it to be at least 90% of the dialog's own width/height —
  // i.e. the dialog is rendered inside it, not clipped by it.
  expect(wrapper).not.toBeNull();
  if (!wrapper) throw new Error('wrapper unexpectedly null after assertion');
  expect(wrapper.width).toBeGreaterThanOrEqual(dialog.width * 0.9);
  expect(wrapper.height).toBeGreaterThanOrEqual(dialog.height * 0.9);

  // Picker must be anchored near the trigger, not stranded at (0,0).
  // Floating-UI's `bottom-start` placement puts the popover's top-left
  // a few px below the trigger's bottom-left; we allow generous slack
  // for `flip`/`shift` middleware.
  const triggerBox = await trigger.boundingBox();
  expect(triggerBox, 'trigger button must have a bounding box').not.toBeNull();
  if (!triggerBox) throw new Error('triggerBox unexpectedly null after assertion');
  const dx = Math.abs(wrapper.x - triggerBox.x);
  const dy = Math.abs(wrapper.y - (triggerBox.y + triggerBox.height));
  expect(dx, `picker x (${wrapper.x}) should be near trigger x (${triggerBox.x}); got dx=${dx}`).toBeLessThan(
    50,
  );
  expect(
    dy,
    `picker y (${wrapper.y}) should be just below trigger bottom (${triggerBox.y + triggerBox.height}); got dy=${dy}`,
  ).toBeLessThan(50);
}
