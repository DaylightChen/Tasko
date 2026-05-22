/**
 * HotkeyProvider — real implementation replacing the task-04 no-op stub.
 *
 * Responsibilities:
 * 1. Registers a single capture-phase document.keydown listener.
 * 2. Auto-pushes 'input' when any <input>/<textarea>/[contenteditable] gains focus;
 *    pops when it loses focus.
 * 3. Suppresses single-key shortcuts when currentMode is 'input', 'tag-input', or 'command-palette'
 *    (modifier-combos are always allowed).
 * 4. Per UX §4.12: ⌘K inside a textarea is suppressed (the textarea owns ⌘K for markdown links).
 */
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { isModKey, matchHotkey } from '../lib/keyboard';
import { useCommandPaletteStore } from '../store/command-palette';
import { useHotkeyStore } from '../store/hotkey-registry';
import { useShortcutHelpStore } from '../store/shortcut-help';
import { useSidebarStore } from '../store/sidebar';
import { useUndoStore } from '../store/undo';
import { showNoSearchToast } from './no-search-toast';

interface Props {
  children: ReactNode;
}

// Modes in which single-key (no-modifier) shortcuts are suppressed.
const INPUT_MODES = new Set(['input', 'tag-input', 'command-palette']);

function isInputElement(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || (el as HTMLElement).isContentEditable === true;
}

export function HotkeyProvider({ children }: Props) {
  // We use refs here to avoid re-mounting the effect when store values change.
  // The stores are accessed directly via .getState() inside the handler.
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // ── Auto-push/pop 'input' mode on focus events ─────────────────────────
    const onFocusIn = (e: FocusEvent) => {
      if (isInputElement(e.target as Element | null)) {
        useHotkeyStore.getState().push('input');
      }
    };

    const onFocusOut = (e: FocusEvent) => {
      if (isInputElement(e.target as Element | null)) {
        useHotkeyStore.getState().pop();
      }
    };

    document.body.addEventListener('focusin', onFocusIn);
    document.body.addEventListener('focusout', onFocusOut);

    // ── Main keydown handler (capture phase) ────────────────────────────────
    const onKeyDown = (e: KeyboardEvent) => {
      const { currentMode } = useHotkeyStore.getState();

      // Determine if this is a modifier-combo key press
      const hasModifier = isModKey(e) || e.altKey;
      // In input-like modes, suppress single-key shortcuts
      const suppressed = INPUT_MODES.has(currentMode) && !hasModifier;

      // Per UX §4.12: ⌘K inside a textarea is suppressed (textarea owns it for markdown links)
      const isTextarea = (e.target as Element)?.tagName?.toLowerCase() === 'textarea';
      const isModK = isModKey(e) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k';
      if (isTextarea && isModK) return;

      // ── Global bindings (always fire, except suppression rules above) ─────
      if (!suppressed) {
        // ⌘K → open command palette
        if (matchHotkey('Mod+k', e)) {
          e.preventDefault();
          useCommandPaletteStore.getState().openPalette();
          return;
        }

        // ⌘\ → toggle sidebar
        if (matchHotkey('Mod+\\', e)) {
          e.preventDefault();
          useSidebarStore.getState().toggle();
          return;
        }

        // ⌘Z → undo
        if (matchHotkey('Mod+z', e)) {
          e.preventDefault();
          useUndoStore.getState().pop();
          return;
        }

        // ⌘Shift+Z → focus most recent snackbar action button
        if (matchHotkey('Mod+Shift+z', e)) {
          e.preventDefault();
          const btn = document.querySelector<HTMLElement>('[data-snackbar-action]');
          btn?.focus();
          return;
        }

        // ⌘F → show no-search toast
        if (matchHotkey('Mod+f', e)) {
          e.preventDefault();
          showNoSearchToast();
          return;
        }
      }

      // ? → toggle shortcut help overlay (no-input mode only)
      if (!suppressed && currentMode === 'no-input' && matchHotkey('?', e)) {
        e.preventDefault();
        useShortcutHelpStore.getState().toggle();
        return;
      }
    };

    document.addEventListener('keydown', onKeyDown, true);

    cleanupRef.current = () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.removeEventListener('focusin', onFocusIn);
      document.body.removeEventListener('focusout', onFocusOut);
    };

    return () => {
      cleanupRef.current?.();
    };
  }, []);

  return <>{children}</>;
}
