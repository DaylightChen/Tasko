/**
 * HOTKEY_MAP — central binding table per frontend-architecture.md §8.3.
 *
 * Each entry maps { mode → { spec → actionId } }.
 * Actions are resolved at runtime by the HotkeyProvider via injected handlers.
 *
 * 'global' bindings fire regardless of current mode (with suppression rules).
 */

export type HotkeyActionId =
  // Global
  | 'openCommandPalette'
  | 'toggleSidebar'
  | 'undo'
  | 'focusSnackbarAction'
  | 'showNoSearchToast'
  | 'toggleShortcutHelp'
  // no-input
  | 'goToToday'
  | 'goToInbox'
  | 'focusQuickAdd'
  | 'moveFocusDown'
  | 'moveFocusUp'
  | 'moveFocusLeft'
  | 'moveFocusRight'
  | 'toggleFocusedCheckbox'
  | 'openFocusedModal'
  | 'setPriority1'
  | 'setPriority2'
  | 'setPriority3'
  | 'setPriority4'
  | 'deleteFocusedRow'
  | 'cancelOperation'
  // modal/sheet
  | 'saveModal'
  | 'closeModal';

/**
 * Map of mode → (spec → actionId).
 * 'global' bindings are checked in every mode.
 */
export const HOTKEY_MAP: Record<string, Record<string, HotkeyActionId>> = {
  global: {
    'Mod+k': 'openCommandPalette',
    'Mod+\\': 'toggleSidebar',
    'Mod+z': 'undo',
    'Mod+Shift+z': 'focusSnackbarAction',
    'Mod+f': 'showNoSearchToast',
    '?': 'toggleShortcutHelp',
  },
  'no-input': {
    t: 'goToToday',
    i: 'goToInbox',
    n: 'focusQuickAdd',
    '/': 'focusQuickAdd',
    j: 'moveFocusDown',
    k: 'moveFocusUp',
    h: 'moveFocusLeft',
    l: 'moveFocusRight',
    ArrowDown: 'moveFocusDown',
    ArrowUp: 'moveFocusUp',
    ArrowLeft: 'moveFocusLeft',
    ArrowRight: 'moveFocusRight',
    Space: 'toggleFocusedCheckbox',
    x: 'toggleFocusedCheckbox',
    Enter: 'openFocusedModal',
    o: 'openFocusedModal',
    '1': 'setPriority1',
    '2': 'setPriority2',
    '3': 'setPriority3',
    '4': 'setPriority4',
    Backspace: 'deleteFocusedRow',
    Delete: 'deleteFocusedRow',
    Escape: 'cancelOperation',
  },
  modal: {
    'Mod+Enter': 'saveModal',
    'Mod+s': 'saveModal',
    Escape: 'closeModal',
  },
  sheet: {
    'Mod+Enter': 'saveModal',
    'Mod+s': 'saveModal',
    Escape: 'closeModal',
  },
};
