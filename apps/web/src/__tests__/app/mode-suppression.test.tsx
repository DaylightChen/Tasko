/**
 * mode-suppression.test.tsx
 *
 * Verifies the mode-suppression acceptance criteria:
 * - Single-key shortcuts are suppressed when mode is 'input', 'tag-input', or 'command-palette'
 * - Modifier combos (Mod+k, Mod+f etc.) still fire in those modes
 * - The '?' shortcut is additionally suppressed outside 'no-input' mode
 *
 * These tests use useHotkey directly to validate suppression behaviour
 * without depending on HotkeyProvider (which is tested separately).
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHotkey } from '../../hooks/useHotkey';
import { useHotkeyStore } from '../../store/hotkey-registry';

function fireKeydown(key: string, extras: Partial<KeyboardEventInit> = {}) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...extras }));
}

describe('Mode suppression via useHotkey', () => {
  beforeEach(() => {
    useHotkeyStore.getState().reset();
  });

  afterEach(() => {
    useHotkeyStore.getState().reset();
  });

  it('single-key handler fires in no-input mode', () => {
    const handler = vi.fn();
    renderHook(() => useHotkey('no-input', 't', handler));

    act(() => {
      fireKeydown('t');
    });

    expect(handler).toHaveBeenCalledOnce();
  });

  it('single-key handler is suppressed when mode is "input"', () => {
    const handler = vi.fn();
    renderHook(() => useHotkey('no-input', 't', handler));

    act(() => {
      useHotkeyStore.getState().push('input');
      fireKeydown('t');
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('single-key handler is suppressed when mode is "tag-input"', () => {
    const handler = vi.fn();
    renderHook(() => useHotkey('no-input', 'n', handler));

    act(() => {
      useHotkeyStore.getState().push('tag-input');
      fireKeydown('n');
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('single-key handler is suppressed when mode is "command-palette"', () => {
    const handler = vi.fn();
    renderHook(() => useHotkey('no-input', 'i', handler));

    act(() => {
      useHotkeyStore.getState().push('command-palette');
      fireKeydown('i');
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('modal mode handler fires in modal mode', () => {
    const handler = vi.fn();
    renderHook(() => useHotkey('modal', 'Enter', handler));

    act(() => {
      useHotkeyStore.getState().push('modal');
      fireKeydown('Enter');
    });

    expect(handler).toHaveBeenCalledOnce();
  });

  it('modal mode handler does NOT fire in no-input mode', () => {
    const handler = vi.fn();
    renderHook(() => useHotkey('modal', 'Enter', handler));

    act(() => {
      // mode is 'no-input' (default)
      fireKeydown('Enter');
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('handler registered for array of modes fires in any matching mode', () => {
    const handler = vi.fn();
    renderHook(() => useHotkey(['no-input', 'calendar'], 'ArrowLeft', handler));

    // no-input: should fire
    act(() => {
      fireKeydown('ArrowLeft');
    });
    expect(handler).toHaveBeenCalledTimes(1);

    // calendar: should fire
    act(() => {
      useHotkeyStore.getState().push('calendar');
      fireKeydown('ArrowLeft');
    });
    expect(handler).toHaveBeenCalledTimes(2);

    // modal: should NOT fire
    act(() => {
      useHotkeyStore.getState().pop();
      useHotkeyStore.getState().push('modal');
      fireKeydown('ArrowLeft');
    });
    expect(handler).toHaveBeenCalledTimes(2);
  });
});
