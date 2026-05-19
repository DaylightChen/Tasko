import { useEffect } from 'react';
import { useUndoStore } from '../store/undo';

/**
 * GlobalUndo — registers a single global ⌘Z / Ctrl+Z listener that calls
 * undoStore.pop() when no text input is focused.
 *
 * Mount once in main.tsx (or app root). Task-18 will replace this with the
 * hotkey registry; this ad-hoc listener is task-12's interim solution.
 *
 * Note: ViewChrome previously had a duplicate ⌘Z handler — it has been removed
 * from ViewChrome so this component is the single source of truth.
 */
export function GlobalUndo() {
  const undo = useUndoStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod || e.key !== 'z' || e.shiftKey) return;

      // Don't intercept if focus is in a text editing context
      const active = document.activeElement;
      if (active instanceof HTMLInputElement) return;
      if (active instanceof HTMLTextAreaElement) return;
      if (active instanceof HTMLElement && active.isContentEditable) return;

      e.preventDefault();
      undo.pop();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [undo]);

  return null;
}
