import { useState } from 'react';

export interface FocusedRowState {
  focusedId: string | null;
  setFocus: (id: string | null) => void;
  moveFocus: (delta: number) => void;
}

/**
 * useFocusedRow — tracks which row in a list has keyboard focus.
 * `moveFocus(delta)` shifts focus by delta (1 = next, -1 = prev), clamped to the list bounds.
 */
export function useFocusedRow<T extends { id: string }>(items: T[]): FocusedRowState {
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const setFocus = (id: string | null) => {
    setFocusedId(id);
  };

  const moveFocus = (delta: number) => {
    if (items.length === 0) return;

    const currentIndex = focusedId !== null ? items.findIndex((item) => item.id === focusedId) : -1;

    let nextIndex: number;
    if (currentIndex === -1) {
      nextIndex = delta > 0 ? 0 : items.length - 1;
    } else {
      nextIndex = currentIndex + delta;
    }

    // Clamp to valid range
    nextIndex = Math.max(0, Math.min(items.length - 1, nextIndex));
    const nextItem = items[nextIndex];
    if (nextItem) {
      setFocusedId(nextItem.id);
    }
  };

  return { focusedId, setFocus, moveFocus };
}
