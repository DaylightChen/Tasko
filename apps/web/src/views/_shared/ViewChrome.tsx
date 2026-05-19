import type React from 'react';
import { useEffect } from 'react';
import { QuickAddInput } from '../../components/quick-add-input';
import { SortDropdown } from '../../components/sort-dropdown';
import { useUndoStore } from '../../store/undo';
import styles from './ViewChrome.module.css';

export interface ViewChromeProps {
  title: string;
  sortValue: string;
  onSortChange: (value: string) => void;
  quickAddPlaceholder?: string;
  quickAddInitialFocus?: boolean;
  children?: React.ReactNode;
}

/**
 * ViewChrome — universal layout wrapper for smart-list views.
 *
 * Renders:
 *   - <header>: <h1>{title}</h1> + SortDropdown + FilterChips placeholder
 *   - QuickAddInput row
 *   - children (the list content)
 *
 * Also registers a lightweight ⌘Z / Ctrl+Z handler that calls undoStore.pop()
 * when the active element is not in an input/textarea/contenteditable.
 * Task-18 will move this into the hotkey registry.
 */
export function ViewChrome({
  title,
  sortValue,
  onSortChange,
  quickAddPlaceholder = 'Add task',
  quickAddInitialFocus = false,
  children,
}: ViewChromeProps) {
  const undo = useUndoStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod || e.key !== 'z') return;

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

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
        <div className={styles.controls}>
          <SortDropdown value={sortValue} onChange={onSortChange} />
          {/* FilterChips strip placeholder — task-14 wires this */}
        </div>
      </header>

      <div className={styles.quickAdd}>
        <QuickAddInput placeholder={quickAddPlaceholder} autoFocus={quickAddInitialFocus} />
      </div>

      <div className={styles.content}>{children}</div>
    </div>
  );
}
