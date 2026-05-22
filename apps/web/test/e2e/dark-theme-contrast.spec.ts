/**
 * dark-theme-contrast.spec.ts
 *
 * Regression test for: task title rendered invisible in dark mode because
 * the title is a native <button> and the UA-default `buttonface` background
 * (light gray/white in OS light mode) bleeds through, while the explicit
 * `color: var(--color-text)` resolves to light in dark theme. Result:
 * white-on-white pill where the title should be.
 *
 * Two-layer fix:
 *   1. `:root[data-theme="dark"] { color-scheme: dark; }` — canonical browser
 *      hint that makes native form controls use dark UA defaults.
 *   2. Explicit `background: transparent; border: 0` on the .title button so
 *      it never depends on UA defaults regardless of color-scheme.
 *
 * This spec asserts BOTH layers:
 *   - the computed background-color of the title button is transparent /
 *     matches the row background (not the OS buttonface)
 *   - the title text and its background have meaningful luminance contrast
 *     (>= 3:1 — a conservative floor for body text against its immediate bg)
 *
 * Non-destructive: forces theme=dark via the config API, restores theme=light
 * at the end. Does not create/modify any tasks. Requires that the dev server
 * has at least one item in /all to assert against — if there are zero items,
 * the spec is skipped with a soft message rather than failing.
 *
 * Requires: dev server running on localhost:5173 (Vite proxy → :7373).
 */
import { expect, test } from '@playwright/test';

const API_BASE = 'http://127.0.0.1:7373/api';

test.describe('Dark theme — task title contrast', () => {
  test.beforeEach(async ({ page }) => {
    await page.request.patch(`${API_BASE}/config`, { data: { theme: 'dark' } });
  });

  test.afterEach(async ({ page }) => {
    await page.request.patch(`${API_BASE}/config`, { data: { theme: 'light' } });
  });

  test('title button has transparent background and visible text contrast', async ({ page }) => {
    await page.goto('/all');
    await page.waitForLoadState('domcontentloaded');
    // Wait for the SPA to mount and apply data-theme=dark
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');

    // Resolve the title button — TaskListRow renders the inline-editable title
    // as <button data-state="inline-editable">…</button>. If the dev data dir
    // has no items, skip gracefully rather than failing.
    const title = page.locator('button[data-state="inline-editable"]').first();
    const titleCount = await page.locator('button[data-state="inline-editable"]').count();
    test.skip(titleCount === 0, 'No tasks in the dev data dir — cannot run dark-theme contrast assertions');

    await expect(title).toBeVisible();

    const measurements = await title.evaluate((el) => {
      const cs = getComputedStyle(el as HTMLElement);
      // Walk up to the first non-transparent ancestor for the effective bg
      let bgEl: HTMLElement | null = el as HTMLElement;
      let effectiveBg = cs.backgroundColor;
      while (bgEl && (effectiveBg === 'rgba(0, 0, 0, 0)' || effectiveBg === 'transparent')) {
        bgEl = bgEl.parentElement;
        if (!bgEl) break;
        effectiveBg = getComputedStyle(bgEl).backgroundColor;
      }
      return {
        ownBg: cs.backgroundColor,
        textColor: cs.color,
        effectiveBg,
      };
    });

    // 1. The title button itself must not have an opaque UA bg leaking through.
    expect(
      ['rgba(0, 0, 0, 0)', 'transparent'].includes(measurements.ownBg),
      `title own background should be transparent (was: ${measurements.ownBg})`,
    ).toBe(true);

    // 2. The effective rendered surface must contrast with the text. Compute
    // relative luminance and require ratio >= 3:1 — conservative for body text.
    const ratio = contrastRatio(measurements.textColor, measurements.effectiveBg);
    expect(
      ratio,
      `text (${measurements.textColor}) vs effective bg (${measurements.effectiveBg}) had ratio ${ratio.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(3);
  });
});

function parseRgb(s: string): [number, number, number] {
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`Cannot parse color: ${s}`);
  const parts = (m[1] ?? '').split(',').map((p) => Number.parseFloat(p.trim()));
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const chan = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(parseRgb(a));
  const lb = relativeLuminance(parseRgb(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
