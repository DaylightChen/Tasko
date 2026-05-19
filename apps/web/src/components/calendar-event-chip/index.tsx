/**
 * CalendarEventChip — renders a single event chip inside a calendar day cell.
 *
 * Variants:
 *   - timed: has due_time set
 *   - all-day: no due_time, no start_date (single day)
 *   - multi-day: has start_date (appears on multiple days)
 *
 * Multi-day positioning:
 *   Per-day-cell chips share data-item-id and data-day-position ('start'|'middle'|'end')
 *   so CSS can visually connect adjacent chips of the same item.
 *   The start cell shows the title; middle cells show a thin continuation bar;
 *   the end cell shows the title + "Day M of M".
 *
 * Priority left-border: 2px per priority color (none = no border).
 * Overdue treatment: title text=overdue, priority border replaced with overdue 2px.
 * Completed treatment: strike-through + opacity 0.6.
 *
 * Click → opens Task modal (taskModalStore.openEdit).
 * Right-click → context menu (Open / Edit date… / Move to project… / Delete).
 * No drag interaction (binding resolution §1.1 — drag CUT from v1).
 */
import type { Item, ItemId, LocalDate } from '@tasko/types';
import type React from 'react';
import { useCallback, useRef, useState } from 'react';
import { useTaskModalStore } from '../../store/task-modal';
import styles from './styles.module.css';

export type DayPosition = 'start' | 'middle' | 'end' | 'single';

export interface CalendarEventChipProps {
  item: Item;
  /** The calendar date this chip is being rendered in. */
  cellDate: LocalDate;
  /** Today's date for overdue calculation. */
  today: LocalDate;
  /** Position of this chip in a multi-day span. */
  dayPosition: DayPosition;
  /** Total span length (1 for single-day items). */
  spanDays: number;
  /** Day number within the span (1-based). */
  spanDay: number;
  /** Callback when user requests delete. */
  onDeleteRequest: (item: Item) => void;
  /** Callback when user requests "Move to project…". */
  onMoveRequest: (item: Item) => void;
}

const PRIORITY_LABELS: Record<Item['priority'], string> = {
  none: 'none',
  low: 'low',
  medium: 'medium',
  high: 'high',
};

export function CalendarEventChip({
  item,
  cellDate,
  today,
  dayPosition,
  spanDays,
  spanDay,
  onDeleteRequest,
  onMoveRequest,
}: CalendarEventChipProps) {
  const taskModal = useTaskModalStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const chipRef = useRef<HTMLButtonElement>(null);

  const isOverdue = item.due_date < today && item.status !== 'done';
  const isCompleted = item.status === 'done';

  const variant =
    dayPosition === 'middle'
      ? 'middle'
      : item.due_time !== null
        ? 'timed'
        : spanDays > 1
          ? 'multi-day'
          : 'all-day';

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      taskModal.openEdit(item.id as ItemId);
    },
    [taskModal, item.id],
  );

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        taskModal.openEdit(item.id as ItemId);
      }
    },
    [taskModal, item.id],
  );

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const handleContextOpen = useCallback(() => {
    taskModal.openEdit(item.id as ItemId);
    closeContextMenu();
  }, [taskModal, item.id, closeContextMenu]);

  const handleContextEditDate = useCallback(() => {
    taskModal.openEdit(item.id as ItemId);
    closeContextMenu();
  }, [taskModal, item.id, closeContextMenu]);

  const handleContextMove = useCallback(() => {
    onMoveRequest(item);
    closeContextMenu();
  }, [onMoveRequest, item, closeContextMenu]);

  const handleContextDelete = useCallback(() => {
    onDeleteRequest(item);
    closeContextMenu();
  }, [onDeleteRequest, item, closeContextMenu]);

  // Build aria-label per accessibility §3.8
  const spanLabel = spanDays > 1 ? `, Day ${spanDay} of ${spanDays}` : '';
  const dateLabel = item.due_time ? `${item.due_date} at ${item.due_time}` : item.due_date;
  const ariaLabel = `Event: ${item.title}, ${dateLabel}${spanLabel}, priority ${PRIORITY_LABELS[item.priority]}`;

  // Middle day: thin continuation bar only
  if (dayPosition === 'middle') {
    return (
      <>
        <button
          ref={chipRef}
          type="button"
          className={styles.chip}
          data-variant="middle"
          data-priority={item.priority}
          data-overdue={isOverdue ? '' : undefined}
          data-completed={isCompleted ? '' : undefined}
          data-item-id={item.id}
          data-day-position="middle"
          aria-label={ariaLabel}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          onKeyDown={handleKeyDown}
        />
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={closeContextMenu}
            onOpen={handleContextOpen}
            onEditDate={handleContextEditDate}
            onMove={handleContextMove}
            onDelete={handleContextDelete}
          />
        )}
      </>
    );
  }

  const showSpanLabel = spanDays > 1 && (dayPosition === 'start' || dayPosition === 'end');
  const spanText = showSpanLabel ? ` Day ${spanDay} of ${spanDays}` : '';

  return (
    <>
      <button
        ref={chipRef as React.RefObject<HTMLButtonElement>}
        type="button"
        className={styles.chip}
        data-variant={variant}
        data-priority={item.priority}
        data-overdue={isOverdue ? '' : undefined}
        data-completed={isCompleted ? '' : undefined}
        data-item-id={item.id}
        data-day-position={dayPosition}
        aria-label={ariaLabel}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
      >
        <span className={styles.title}>
          {item.due_time && <span className={styles.time}>{item.due_time}</span>}
          {item.title}
          {spanText && <span className={styles.spanLabel}>{spanText}</span>}
        </span>
      </button>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
          onOpen={handleContextOpen}
          onEditDate={handleContextEditDate}
          onMove={handleContextMove}
          onDelete={handleContextDelete}
        />
      )}
    </>
  );
}

// ─── Context menu ─────────────────────────────────────────────────────────────

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onOpen: () => void;
  onEditDate: () => void;
  onMove: () => void;
  onDelete: () => void;
}

function ContextMenu({ x, y, onClose, onOpen, onEditDate, onMove, onDelete }: ContextMenuProps) {
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClose();
    },
    [onClose],
  );

  return (
    <>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop is a pointer-only dismiss target */}
      <div className={styles.contextBackdrop} onClick={handleBackdropClick} aria-hidden="true" />
      <menu
        className={styles.contextMenu}
        style={{ top: y, left: x }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
      >
        <li>
          <button type="button" role="menuitem" className={styles.contextItem} onClick={onOpen}>
            Open
          </button>
        </li>
        <li>
          <button type="button" role="menuitem" className={styles.contextItem} onClick={onEditDate}>
            Edit date…
          </button>
        </li>
        <li>
          <button type="button" role="menuitem" className={styles.contextItem} onClick={onMove}>
            Move to project…
          </button>
        </li>
        <li className={styles.contextSeparator} />
        <li>
          <button
            type="button"
            role="menuitem"
            className={`${styles.contextItem} ${styles.contextItemDestructive}`}
            onClick={onDelete}
          >
            Delete
          </button>
        </li>
      </menu>
    </>
  );
}

// Re-export for convenience
export { CalendarEventChip as default };
