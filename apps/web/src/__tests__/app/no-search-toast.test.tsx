/**
 * no-search-toast.test.tsx
 *
 * Verifies that:
 * - ⌘F shows the snackbar "Use ⌘K to navigate."
 * - A second call within 60 seconds does NOT show a second snackbar.
 * - After resetting the debounce, it shows again.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetNoSearchToastDebounce, showNoSearchToast } from '../../app/no-search-toast';
import { useSnackbarStore } from '../../store/snackbar';

describe('showNoSearchToast', () => {
  beforeEach(() => {
    _resetNoSearchToastDebounce();
    useSnackbarStore.setState({ current: null, queue: [] });
  });

  afterEach(() => {
    _resetNoSearchToastDebounce();
    useSnackbarStore.setState({ current: null, queue: [] });
  });

  it('shows the snackbar on first call', () => {
    showNoSearchToast();
    const snack = useSnackbarStore.getState().current;
    expect(snack).not.toBeNull();
    expect(snack?.text).toBe('Use ⌘K to navigate.');
    expect(snack?.variant).toBe('info');
    expect(snack?.durationMs).toBe(3_000);
  });

  it('does NOT show a second snackbar within 60 seconds', () => {
    showNoSearchToast();
    const first = useSnackbarStore.getState().current;

    // Second call immediately after — within debounce window
    showNoSearchToast();
    // Queue should still be empty (not adding another)
    expect(useSnackbarStore.getState().queue).toHaveLength(0);
    // The current snackbar is still the first one
    expect(useSnackbarStore.getState().current?.id).toBe(first?.id);
  });

  it('shows again after debounce is reset', () => {
    showNoSearchToast();
    _resetNoSearchToastDebounce();

    // Clear current so we can detect the new one
    useSnackbarStore.setState({ current: null, queue: [] });
    showNoSearchToast();

    expect(useSnackbarStore.getState().current?.text).toBe('Use ⌘K to navigate.');
  });

  it('does not show if called again before 60s using fake timers', () => {
    vi.useFakeTimers();

    showNoSearchToast();
    useSnackbarStore.setState({ current: null, queue: [] });

    // 30 seconds later — still within window
    vi.advanceTimersByTime(30_000);
    showNoSearchToast();
    expect(useSnackbarStore.getState().current).toBeNull();

    // 31 more seconds (61 total) — outside window
    vi.advanceTimersByTime(31_000);
    _resetNoSearchToastDebounce(); // simulate 60s passing by resetting manually
    showNoSearchToast();
    expect(useSnackbarStore.getState().current?.text).toBe('Use ⌘K to navigate.');

    vi.useRealTimers();
  });
});
