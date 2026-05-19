/**
 * ShortcutHelpHost — renders the shortcut help overlay singleton.
 * Uses useShortcutHelpStore to control visibility.
 */
import { ShortcutHelpOverlay } from '../components/shortcut-help-overlay';
import { useShortcutHelpStore } from '../store/shortcut-help';

export function ShortcutHelpHost() {
  const { open, hide } = useShortcutHelpStore();
  return <ShortcutHelpOverlay open={open} onClose={hide} />;
}
