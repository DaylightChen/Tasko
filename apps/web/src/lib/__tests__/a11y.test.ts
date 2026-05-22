/**
 * Tests for lib/a11y.ts
 * Covers: announce() creates live regions, sets text after tick, polite vs assertive.
 *
 * Note: The a11y module uses module-level singletons. We can't truly reset them between
 * tests without dynamic re-import. Instead, tests observe the resulting DOM state,
 * calling announce() fresh each time and verifying the element structure.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

// Import announce after module is loaded
import { announce } from '../a11y';

afterEach(() => {
  vi.useRealTimers();
});

describe('announce', () => {
  it('creates a [role="status"][aria-live="polite"] element in document.body', () => {
    vi.useFakeTimers();
    announce('Hello polite');
    const el = document.querySelector('[role="status"][aria-live="polite"]');
    expect(el).toBeTruthy();
  });

  it('creates a [role="alert"][aria-live="assertive"] element in document.body', () => {
    vi.useFakeTimers();
    announce('Error!', 'assertive');
    const el = document.querySelector('[role="alert"][aria-live="assertive"]');
    expect(el).toBeTruthy();
  });

  it('live region is positioned off-screen', () => {
    vi.useFakeTimers();
    announce('Test off-screen');
    const el = document.querySelector('[role="status"]') as HTMLElement | null;
    expect(el).toBeTruthy();
    expect(el?.style.left).toBe('-10000px');
  });

  it('sets textContent on the polite region after a tick', () => {
    vi.useFakeTimers();
    announce('Task added.', 'polite');
    const el = document.querySelector('[role="status"]') as HTMLElement | null;
    expect(el).toBeTruthy();
    // Before tick, textContent was cleared to ''
    expect(el?.textContent).toBe('');
    // After tick (50ms in implementation), text is set
    vi.advanceTimersByTime(100);
    expect(el?.textContent).toBe('Task added.');
  });

  it('sets textContent on the assertive region after a tick', () => {
    vi.useFakeTimers();
    announce('Critical error', 'assertive');
    const el = document.querySelector('[role="alert"]') as HTMLElement | null;
    expect(el).toBeTruthy();
    vi.advanceTimersByTime(100);
    expect(el?.textContent).toBe('Critical error');
  });

  it('does not throw when called multiple times', () => {
    expect(() => {
      announce('first');
      announce('second');
    }).not.toThrow();
  });

  it('has aria-atomic="true" on live regions', () => {
    announce('check atomic');
    const el = document.querySelector('[role="status"]');
    expect(el?.getAttribute('aria-atomic')).toBe('true');
  });
});
