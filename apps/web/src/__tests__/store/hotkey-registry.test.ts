/**
 * hotkey-registry.test.ts
 *
 * Verifies the hotkey store shape and state transitions:
 * - Initial state is 'no-input', empty stack
 * - push() adds to stack and updates currentMode
 * - pop() removes top and updates currentMode
 * - reset() clears stack and returns to 'no-input'
 * - Multiple pushes produce correct stack depth
 *
 * Downstream dependency: all mode-aware code (useHotkey, HotkeyProvider,
 * CommandPalette, Modal, Sheet) reads currentMode from this store.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useHotkeyStore } from '../../store/hotkey-registry';

describe('useHotkeyStore', () => {
  beforeEach(() => {
    useHotkeyStore.getState().reset();
  });

  afterEach(() => {
    useHotkeyStore.getState().reset();
  });

  it('starts with empty modeStack and currentMode = "no-input"', () => {
    const state = useHotkeyStore.getState();
    expect(state.modeStack).toHaveLength(0);
    expect(state.currentMode).toBe('no-input');
  });

  it('push() adds a mode and sets currentMode to that mode', () => {
    useHotkeyStore.getState().push('input');
    const state = useHotkeyStore.getState();
    expect(state.modeStack).toEqual(['input']);
    expect(state.currentMode).toBe('input');
  });

  it('push() of multiple modes stacks them LIFO', () => {
    useHotkeyStore.getState().push('input');
    useHotkeyStore.getState().push('modal');
    const state = useHotkeyStore.getState();
    expect(state.modeStack).toEqual(['input', 'modal']);
    expect(state.currentMode).toBe('modal');
  });

  it('pop() removes the top mode and returns to prior mode', () => {
    useHotkeyStore.getState().push('input');
    useHotkeyStore.getState().push('modal');
    useHotkeyStore.getState().pop();
    const state = useHotkeyStore.getState();
    expect(state.modeStack).toEqual(['input']);
    expect(state.currentMode).toBe('input');
  });

  it('pop() on single-entry stack returns to "no-input"', () => {
    useHotkeyStore.getState().push('command-palette');
    useHotkeyStore.getState().pop();
    const state = useHotkeyStore.getState();
    expect(state.modeStack).toHaveLength(0);
    expect(state.currentMode).toBe('no-input');
  });

  it('pop() on empty stack stays at "no-input" without throwing', () => {
    expect(() => useHotkeyStore.getState().pop()).not.toThrow();
    expect(useHotkeyStore.getState().currentMode).toBe('no-input');
  });

  it('reset() clears all modes and returns to "no-input"', () => {
    useHotkeyStore.getState().push('input');
    useHotkeyStore.getState().push('modal');
    useHotkeyStore.getState().push('command-palette');
    useHotkeyStore.getState().reset();
    const state = useHotkeyStore.getState();
    expect(state.modeStack).toHaveLength(0);
    expect(state.currentMode).toBe('no-input');
  });

  it('supports all valid HotkeyMode values', () => {
    const modes = [
      'no-input',
      'input',
      'modal',
      'sheet',
      'calendar',
      'kanban',
      'tree',
      'command-palette',
      'tag-input',
      'date-picker',
    ] as const;

    for (const mode of modes) {
      useHotkeyStore.getState().reset();
      useHotkeyStore.getState().push(mode);
      expect(useHotkeyStore.getState().currentMode).toBe(mode);
    }
  });
});
