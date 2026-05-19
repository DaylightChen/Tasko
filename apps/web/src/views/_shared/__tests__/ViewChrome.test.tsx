/**
 * ViewChrome.test.tsx
 *
 * Covers:
 * - ⌘Z fires undoStore.pop() (apply is called, current resets to null)
 * - ⌘Z is ignored when an <input> has focus
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUndoStore } from '../../../store/undo';
import { ViewChrome } from '../ViewChrome';

describe('ViewChrome — ⌘Z undo handler', () => {
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

    // Push a no-op undo entry
    act(() => {
      useUndoStore.getState().push({ label: 'Test action', apply: applyFn });
    });

    render(
      <ViewChrome title="Test" sortValue="due_asc" onSortChange={vi.fn()}>
        <div>content</div>
      </ViewChrome>,
    );

    // Verify entry was pushed
    expect(useUndoStore.getState().current).not.toBeNull();

    // Fire ⌘Z on document
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
      <ViewChrome title="Test" sortValue="due_asc" onSortChange={vi.fn()}>
        <input data-testid="text-field" />
      </ViewChrome>,
    );

    // Focus the input
    const input = container.querySelector('input[data-testid="text-field"]') as HTMLInputElement;
    act(() => {
      input.focus();
    });

    act(() => {
      fireEvent.keyDown(document, { key: 'z', metaKey: true });
    });

    expect(applyFn).not.toHaveBeenCalled();
    // Entry should still be present (not consumed)
    expect(useUndoStore.getState().current).not.toBeNull();
  });
});
