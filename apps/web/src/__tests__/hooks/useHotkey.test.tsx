/**
 * useHotkey.test.tsx
 *
 * Verifies mode-aware hotkey suppression:
 * - Handler fires when mode matches.
 * - Handler does NOT fire when mode doesn't match.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHotkey } from '../../hooks/useHotkey';
import { useHotkeyStore } from '../../store/hotkey-registry';

function fireKeydown(key: string, extras: Partial<KeyboardEventInit> = {}) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...extras }));
}

describe('useHotkey', () => {
  beforeEach(() => {
    useHotkeyStore.getState().reset();
  });

  afterEach(() => {
    useHotkeyStore.getState().reset();
  });

  it('calls handler when mode matches and key matches', () => {
    const handler = vi.fn();
    renderHook(() => useHotkey('no-input', 't', handler));

    act(() => {
      fireKeydown('t');
    });

    expect(handler).toHaveBeenCalledOnce();
  });

  it('does not call handler when a different mode is active', () => {
    const handler = vi.fn();
    renderHook(() => useHotkey('no-input', 't', handler));

    act(() => {
      useHotkeyStore.getState().push('input');
      fireKeydown('t');
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('calls handler when mode is restored after pop', () => {
    const handler = vi.fn();
    renderHook(() => useHotkey('no-input', 'i', handler));

    act(() => {
      useHotkeyStore.getState().push('input');
      useHotkeyStore.getState().pop();
      fireKeydown('i');
    });

    expect(handler).toHaveBeenCalledOnce();
  });

  it('accepts an array of modes', () => {
    const handler = vi.fn();
    renderHook(() => useHotkey(['no-input', 'modal'], 'Enter', handler));

    // no-input mode (default / empty stack) → fires
    act(() => {
      fireKeydown('Enter');
    });
    expect(handler).toHaveBeenCalledTimes(1);

    // modal mode → fires
    act(() => {
      useHotkeyStore.getState().push('modal');
      fireKeydown('Enter');
    });
    expect(handler).toHaveBeenCalledTimes(2);

    // input mode → does NOT fire
    act(() => {
      useHotkeyStore.getState().pop(); // remove modal
      useHotkeyStore.getState().push('input');
      fireKeydown('Enter');
    });
    expect(handler).toHaveBeenCalledTimes(2);
  });
});
