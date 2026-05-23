/**
 * E2E "page is ready" wait helper.
 *
 * `page.waitForLoadState('networkidle')` never settles in Tasko because the
 * app opens a persistent SSE connection to /api/events for cross-tab live
 * sync. Specs that wait on `networkidle` time out at 30s.
 *
 * Use this helper instead: it waits for the document parse, then a short
 * timer for React to mount + initial data fetch to land. The 300ms tail
 * mirrors the pattern proven by inline-edit-no-phantom-drag.spec.ts.
 *
 * For tests that need a specific element to be ready, prefer waiting on
 * that locator directly — this helper is only the baseline "shell is up."
 */
import type { Page } from '@playwright/test';

export async function waitForPageReady(page: Page, settleMs = 300): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(settleMs);
}
