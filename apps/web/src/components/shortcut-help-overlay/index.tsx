/**
 * ShortcutHelpOverlay — floating panel (bottom-right) showing the keyboard shortcut reference.
 *
 * Content from microcopy §13.
 * Triggered by: ? key (no-input mode), command palette "View keyboard shortcuts", Settings link.
 * Dismiss: ? again, Esc, click outside.
 * ARIA: role="dialog" aria-label="Keyboard shortcuts".
 */
import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './styles.module.css';

export interface ShortcutHelpOverlayProps {
  open: boolean;
  onClose: () => void;
}

// Shortcut data from microcopy §13
const SECTIONS: Array<{
  heading: string;
  entries: Array<{ keys: string[]; action: string }>;
}> = [
  {
    heading: 'NAVIGATE',
    entries: [
      { keys: ['T'], action: 'Today' },
      { keys: ['I'], action: 'Inbox' },
      { keys: ['N'], action: 'New task (quick-add)' },
      { keys: ['/'], action: 'Focus quick-add input' },
      { keys: ['⌘K'], action: 'Command palette' },
      { keys: ['⌘\\'], action: 'Toggle sidebar' },
    ],
  },
  {
    heading: 'ROW (when focused, no input active)',
    entries: [
      { keys: ['↑', '↓'], action: 'Move focus' },
      { keys: ['Space'], action: 'Toggle checkbox' },
      { keys: ['Enter', 'O'], action: 'Open modal' },
      { keys: ['1–4'], action: 'Set priority' },
      { keys: ['T'], action: 'Schedule to today' },
      { keys: ['⌘⇧M'], action: 'Move to project…' },
      { keys: ['Backspace'], action: 'Soft-delete' },
    ],
  },
  {
    heading: 'MODAL',
    entries: [
      { keys: ['⌘Enter', '⌘S'], action: 'Save' },
      { keys: ['Esc'], action: 'Cancel' },
    ],
  },
  {
    heading: 'CALENDAR',
    entries: [
      { keys: ['←', '→'], action: 'Day' },
      { keys: ['↑', '↓'], action: 'Week' },
      { keys: ['PgUp', 'PgDn'], action: 'Month' },
      { keys: ['T'], action: 'Jump to today' },
      { keys: ['N'], action: 'New task on focused day' },
    ],
  },
  {
    heading: 'GLOBAL',
    entries: [{ keys: ['?'], action: 'Show / hide this panel' }],
  },
];

export function ShortcutHelpOverlay({ open, onClose }: ShortcutHelpOverlayProps) {
  const panelRef = useRef<HTMLDialogElement>(null);

  // Dismiss on Esc
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // Dismiss on click outside
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Use capture so it fires before other handlers
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <dialog ref={panelRef} aria-label="Keyboard shortcuts" open className={styles.overlay}>
      <div className={styles.header}>
        <h2 className={styles.title}>Keyboard shortcuts</h2>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close keyboard shortcuts"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.body}>
        {SECTIONS.map((section) => (
          <section key={section.heading} className={styles.section}>
            <h3 className={styles.sectionTitle}>{section.heading}</h3>
            {section.entries.map((entry, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static list, order never changes
              <div key={i} className={styles.row}>
                <div className={styles.keyGroup}>
                  {entry.keys.map((k, ki) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static list
                    <span key={ki} className={styles.key}>
                      {k}
                    </span>
                  ))}
                </div>
                <span className={styles.action}>{entry.action}</span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </dialog>,
    document.body,
  );
}
