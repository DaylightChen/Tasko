/**
 * CalendarWeekBlock — a timed-event block rendered inside the week view time grid.
 *
 * Per UX §28:
 *   - Priority left-border (same color scale as month chip's priority stripe).
 *   - Title + time-of-day displayed.
 *   - Click → opens Task modal.
 *   - Right-click → context menu (Open / Edit date… / Move to project… / Delete).
 *   - NO drag in v1 (binding resolution §1.1 — calendar drag CUT).
 *   - role="button" with full aria-label.
 *
 * Positioning is handled by the parent (CalendarWeekView) via inline styles:
 *   gridRow, gridColumn, height, gridRowStart.
 */
import type { Item, ItemId, LocalDate } from '@tasko/types';
import { useCallback, useRef, useState } from 'react';
import { useTaskModalStore } from '../../store/task-modal';
import styles from './styles.module.css';

export interface CalendarWeekBlockProps {
  item: Item;
  today: LocalDate;
}

const PRIORITY_LABELS: Record<Item['priority'], string> = {
  none: 'none',
  low: 'low',
  medium: 'medium',
  high: 'high',
};

function formatTime(time: string): string {
  const parts = time.split(':').map(Number);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  if (m === 0) return `${h12} ${suffix}`;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function CalendarWeekBlock({ item, today }: CalendarWeekBlockProps) {
  const taskModal = useTaskModalStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const blockRef = useRef<HTMLButtonElement>(null);

  const isOverdue = item.due_date < today && item.status !== 'done';
  const isCompleted = item.status === 'done';

  const timeLabel = item.due_time ? formatTime(item.due_time) : '';
  const dateLabel = item.due_time ? `${item.due_date} at ${item.due_time}` : item.due_date;
  const ariaLabel = `Event: ${item.title}, ${dateLabel}, priority ${PRIORITY_LABELS[item.priority]}`;

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
    taskModal.openEdit(item.id as ItemId);
    closeContextMenu();
  }, [taskModal, item.id, closeContextMenu]);

  const handleContextDelete = useCallback(() => {
    taskModal.openEdit(item.id as ItemId);
    closeContextMenu();
  }, [taskModal, item.id, closeContextMenu]);

  return (
    <>
      <button
        ref={blockRef}
        type="button"
        className={styles.block}
        data-priority={item.priority}
        data-overdue={isOverdue ? '' : undefined}
        data-completed={isCompleted ? '' : undefined}
        data-item-id={item.id}
        data-week-block=""
        aria-label={ariaLabel}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
      >
        {timeLabel && <span className={styles.time}>{timeLabel}</span>}
        <span className={styles.title}>{item.title}</span>
      </button>
      {contextMenu && (
        <WeekBlockContextMenu
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

interface WeekBlockContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onOpen: () => void;
  onEditDate: () => void;
  onMove: () => void;
  onDelete: () => void;
}

function WeekBlockContextMenu({
  x,
  y,
  onClose,
  onOpen,
  onEditDate,
  onMove,
  onDelete,
}: WeekBlockContextMenuProps) {
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

export default CalendarWeekBlock;
