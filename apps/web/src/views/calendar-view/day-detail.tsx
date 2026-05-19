/**
 * DayDetailPopover — anchored popover (Sheet on mobile) showing all items for a day.
 *
 * Per UX §34:
 * - Header: date (text-h2) + "<N> items" subline (microcopy §24).
 * - Body: scrolling list of TaskListRow (full-fidelity rows).
 * - Footer: "Add task on <Mon DD>" button (microcopy §24) → opens Task modal
 *   with initialDueDate pre-filled.
 *
 * ARIA: role="dialog" aria-modal="false" (anchored popover, not full modal).
 * Esc closes. Tab cycles through rows. Focus returns to trigger on close.
 *
 * "+N more" link that opens this is in CalendarDayCell.
 */
import type { Item, ItemId, LocalDate } from '@tasko/types';
import { X } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { useDeleteItem, useToggleComplete } from '../../api/items';
import { TaskListRow } from '../../components/task-list-row';
import { todayLocal } from '../../lib/date-fmt';
import { useTaskModalStore } from '../../store/task-modal';
import styles from './day-detail.module.css';

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Format "Wed, May 22" for the header (microcopy §24 Day-detail popover title). */
function formatDayDetailTitle(date: LocalDate): string {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = WEEKDAY_SHORT[d.getUTCDay()] ?? '';
  const month = MONTH_SHORT[d.getUTCMonth()] ?? '';
  const day = d.getUTCDate();
  return `${dow}, ${month} ${day}`;
}

/** Format "May 22" for the add button (microcopy §24 "Add task on <Mon DD>"). */
function formatMonthDay(date: LocalDate): string {
  const d = new Date(`${date}T00:00:00Z`);
  const month = MONTH_SHORT[d.getUTCMonth()] ?? '';
  const day = d.getUTCDate();
  return `${month} ${day}`;
}

export interface DayDetailPopoverProps {
  date: LocalDate;
  items: Item[];
  onClose: () => void;
  /** Anchor element ref for positioning (optional — popover defaults to centered). */
  anchorRef?: React.RefObject<HTMLElement | null>;
}

export function DayDetailPopover({ date, items, onClose }: DayDetailPopoverProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const taskModal = useTaskModalStore();
  const today = todayLocal();
  const toggleComplete = useToggleComplete();
  const deleteItem = useDeleteItem();

  // Focus the close button on mount
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  // Esc to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose]);

  // Click outside to close
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [onClose]);

  const handleAddTask = useCallback(() => {
    taskModal.openNew({ initialDueDate: date });
    onClose();
  }, [taskModal, date, onClose]);

  const handleRowClick = useCallback(
    (item: Item) => {
      taskModal.openEdit(item.id as ItemId);
      onClose();
    },
    [taskModal, onClose],
  );

  const handleToggleCheckbox = useCallback(
    (item: Item) => {
      const nextStatus = item.status === 'done' ? 'todo' : 'done';
      toggleComplete.mutate({ id: item.id as ItemId, nextStatus });
    },
    [toggleComplete],
  );

  const title = formatDayDetailTitle(date);
  const monthDay = formatMonthDay(date);
  const itemCount = items.length;
  const subline = itemCount === 1 ? '1 item' : `${itemCount} items`;

  return (
    <>
      {/* Backdrop */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop is pointer-only dismiss */}
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />

      <dialog
        ref={dialogRef as React.RefObject<HTMLDialogElement | null>}
        open
        aria-label={title}
        aria-modal="false"
        className={styles.popover}
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerText}>
            <h2 className={styles.title}>{title}</h2>
            <p className={styles.subline}>{subline}</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeButton}
            aria-label="Close (Esc)"
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Body: scrolling task list */}
        <ul
          className={styles.body}
          aria-label={`Tasks on ${title}`}
          style={{ listStyle: 'none', margin: 0, padding: 0 }}
        >
          {items.map((item) => (
            <TaskListRow
              key={item.id}
              item={item}
              todayLocalDate={today}
              isFocused={false}
              isMultiSelected={false}
              inlineEditMode={false}
              onClick={() => handleRowClick(item)}
              onToggleCheckbox={() => handleToggleCheckbox(item)}
              onTitleClickInlineEdit={() => {}}
              onTitleCommitInlineEdit={() => {}}
              onDeleteRequest={() => deleteItem.mutate({ id: item.id as ItemId, title: item.title })}
              onScheduleTodayKeyboard={() => {}}
              onOpenChevronClick={() => handleRowClick(item)}
            />
          ))}
        </ul>

        {/* Footer */}
        <div className={styles.footer}>
          <button type="button" className={styles.addButton} onClick={handleAddTask}>
            Add task on {monthDay}
          </button>
        </div>
      </dialog>
    </>
  );
}

export default DayDetailPopover;
