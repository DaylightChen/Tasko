/**
 * tag-chip-shows-name.spec.ts
 *
 * Regression test for: tag chips on task rows rendered as `#<ULID>` instead
 * of `#<tag-name>`. The `TagChips` subcomponents in task-list-row and
 * tree-row received `tagIds: TagId[]` but had no name lookup — they just
 * rendered `#{tagId}`. Same bug in kanban-card.
 *
 * Fix: each component now calls `useTags(true)` and resolves `tagId → name`
 * from the shared React Query cache (cheap subscription per row).
 *
 * Non-destructive: opens /all, finds at least one rendered tag chip, and
 * asserts the displayed text is NOT a ULID (does not match the 26-char
 * Crockford alphabet regex). Does not create / mutate / delete anything.
 *
 * Requires: dev server running on localhost:5173 with at least one task
 * carrying at least one tag.
 */
import { expect, test } from '@playwright/test';

test('tag chip on a task row shows the tag name, not the ULID', async ({ page }) => {
  await page.goto('/all');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(300);

  // Locate any tag chip — task-list-row's tagChip is a <button aria-label="Filter by tag …">
  const chips = page.locator('button[aria-label^="Filter by tag "]');
  const count = await chips.count();
  test.skip(count === 0, 'No tagged tasks in dev data dir — cannot run tag-chip assertion');

  // Inspect every visible chip
  const labels = await chips.evaluateAll((els) =>
    els.map((el) => ({
      text: (el.textContent ?? '').trim(),
      ariaLabel: el.getAttribute('aria-label') ?? '',
    })),
  );

  const ulidPattern = /^#[0-9A-HJKMNP-TV-Z]{26}$/;
  for (const { text, ariaLabel } of labels) {
    expect(
      ulidPattern.test(text),
      `chip text should be a name like "#urgent", not a raw ULID; got "${text}" (aria-label: "${ariaLabel}")`,
    ).toBe(false);

    // The chip text starts with "#" and has a non-empty name body.
    expect(text.startsWith('#'), `chip text should start with "#"; got "${text}"`).toBe(true);
    expect(text.length).toBeGreaterThan(1);
  }
});
