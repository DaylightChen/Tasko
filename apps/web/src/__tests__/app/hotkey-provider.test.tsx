/**
 * hotkey-provider.test.tsx
 *
 * Verifies that HotkeyProvider auto-pushes 'input' mode when an <input>
 * gains focus, and pops when it loses focus.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HotkeyProvider } from '../../app/hotkey-provider';
import { useHotkeyStore } from '../../store/hotkey-registry';

describe('HotkeyProvider', () => {
  beforeEach(() => {
    useHotkeyStore.getState().reset();
  });

  afterEach(() => {
    useHotkeyStore.getState().reset();
  });

  it('pushes "input" mode when an <input> gains focus', () => {
    render(
      <HotkeyProvider>
        <input data-testid="text-input" type="text" />
      </HotkeyProvider>,
    );

    expect(useHotkeyStore.getState().currentMode).toBe('no-input');

    act(() => {
      fireEvent.focusIn(screen.getByTestId('text-input'));
    });

    expect(useHotkeyStore.getState().currentMode).toBe('input');
  });

  it('pops "input" mode when the <input> loses focus', () => {
    render(
      <HotkeyProvider>
        <input data-testid="text-input" type="text" />
      </HotkeyProvider>,
    );

    act(() => {
      fireEvent.focusIn(screen.getByTestId('text-input'));
    });
    expect(useHotkeyStore.getState().currentMode).toBe('input');

    act(() => {
      fireEvent.focusOut(screen.getByTestId('text-input'));
    });
    expect(useHotkeyStore.getState().currentMode).toBe('no-input');
  });

  it('mode returns to no-input after input blur when stack was empty', () => {
    render(
      <HotkeyProvider>
        <input data-testid="text-input" type="text" />
        <div data-testid="other" />
      </HotkeyProvider>,
    );

    act(() => {
      fireEvent.focusIn(screen.getByTestId('text-input'));
      fireEvent.focusOut(screen.getByTestId('text-input'));
    });

    expect(useHotkeyStore.getState().currentMode).toBe('no-input');
    expect(useHotkeyStore.getState().modeStack).toHaveLength(0);
  });
});
