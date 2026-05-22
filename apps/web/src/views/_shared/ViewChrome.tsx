import type React from 'react';
import { QuickAddInput } from '../../components/quick-add-input';
import { SortDropdown } from '../../components/sort-dropdown';
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
 * ⌘Z global undo is handled by GlobalUndo in main.tsx (task-12).
 */
export function ViewChrome({
  title,
  sortValue,
  onSortChange,
  quickAddPlaceholder = 'Add task',
  quickAddInitialFocus = false,
  children,
}: ViewChromeProps) {
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
