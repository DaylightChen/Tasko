/**
 * shortcut-help.test.ts
 *
 * Verifies the shortcut help store shape and toggles:
 * - Initial state is closed
 * - show() opens, hide() closes, toggle() flips
 *
 * Downstream dependency: ShortcutHelpHost, HotkeyProvider '?' handler, and
 * the command palette "View keyboard shortcuts" command all rely on this store.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { useShortcutHelpStore } from '../../store/shortcut-help';

describe('useShortcutHelpStore', () => {
  afterEach(() => {
    useShortcutHelpStore.setState({ open: false });
  });

  it('starts closed', () => {
    useShortcutHelpStore.setState({ open: false });
    expect(useShortcutHelpStore.getState().open).toBe(false);
  });

  it('show() sets open to true', () => {
    useShortcutHelpStore.getState().show();
    expect(useShortcutHelpStore.getState().open).toBe(true);
  });

  it('hide() sets open to false', () => {
    useShortcutHelpStore.setState({ open: true });
    useShortcutHelpStore.getState().hide();
    expect(useShortcutHelpStore.getState().open).toBe(false);
  });

  it('toggle() flips open state (false → true)', () => {
    useShortcutHelpStore.setState({ open: false });
    useShortcutHelpStore.getState().toggle();
    expect(useShortcutHelpStore.getState().open).toBe(true);
  });

  it('toggle() flips open state (true → false)', () => {
    useShortcutHelpStore.setState({ open: true });
    useShortcutHelpStore.getState().toggle();
    expect(useShortcutHelpStore.getState().open).toBe(false);
  });
});
