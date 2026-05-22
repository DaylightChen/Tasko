/**
 * global-undo.test.tsx
 *
 * Covers the global ⌘Z handler (task-12; replaces ViewChrome's previous local handler):
 * - ⌘Z fires undoStore.pop() (apply called, current resets to null)
 * - ⌘Z is ignored when an <input> has focus
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUndoStore } from '../../store/undo';
import { GlobalUndo } from '../global-undo';

describe('GlobalUndo — ⌘Z handler', () => {
  afterEach(() => {
    cleanup();
    act(() => {
      useUndoStore.getState().clear();
    });
    vi.clearAllMocks();
  });

  beforeEach(() => {
    act(() => {
      useUndoStore.getState().clear();
    });
  });

  it('calls apply() and clears undoStore.current when ⌘Z is pressed outside an input', () => {
    const applyFn = vi.fn();

    act(() => {
      useUndoStore.getState().push({ label: 'Test action', apply: applyFn });
    });

    render(<GlobalUndo />);

    expect(useUndoStore.getState().current).not.toBeNull();

    act(() => {
      fireEvent.keyDown(document, { key: 'z', metaKey: true });
    });

    expect(applyFn).toHaveBeenCalledTimes(1);
    expect(useUndoStore.getState().current).toBeNull();
  });

  it('does NOT call apply() when ⌘Z is pressed while an input is focused', () => {
    const applyFn = vi.fn();

    act(() => {
      useUndoStore.getState().push({ label: 'Test action', apply: applyFn });
    });

    const { container } = render(
      <>
        <GlobalUndo />
        <input data-testid="text-field" />
      </>,
    );

    const input = container.querySelector('input[data-testid="text-field"]') as HTMLInputElement;
    act(() => {
      input.focus();
    });

    act(() => {
      fireEvent.keyDown(document, { key: 'z', metaKey: true });
    });

    expect(applyFn).not.toHaveBeenCalled();
    expect(useUndoStore.getState().current).not.toBeNull();
  });
});
