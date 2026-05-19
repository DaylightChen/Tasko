import { useSnackbarStore } from '../store/snackbar';

// Module-level debounce: don't show again within 60 seconds.
let lastShownAt = 0;
const DEBOUNCE_MS = 60_000;

/**
 * Show the "Use ⌘K to navigate." toast when the user presses ⌘F.
 * Silently no-ops if the toast was shown within the last 60 seconds.
 */
export function showNoSearchToast(): void {
  const now = Date.now();
  if (now - lastShownAt < DEBOUNCE_MS) return;
  lastShownAt = now;
  useSnackbarStore.getState().show({
    variant: 'info',
    text: 'Use ⌘K to navigate.',
    durationMs: 3_000,
  });
}

/** Reset the debounce timer (for tests). */
export function _resetNoSearchToastDebounce(): void {
  lastShownAt = 0;
}
