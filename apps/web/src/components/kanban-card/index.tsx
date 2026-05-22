/**
 * KanbanCard — a card in the Kanban board representing a single Task item.
 *
 * Per UX §25:
 *   - Priority left-edge stripe (full-height, 2-3px wide).
 *   - Title (up to 2 lines with ellipsis on 3rd).
 *   - Meta row: up to 2 tag chips + "+N" overflow, subtask progress chip,
 *     date chip ONLY if today or overdue.
 *   - Multi-selected variant: 4px accent left stripe; inline priority dot.
 *   - Click → opens Task modal.
 *   - Right-click → context menu.
 *   - ARIA: role="listitem" with full aria-label per microcopy §29.
 *
 * The card itself does NOT attach dnd-kit listeners — the parent KanbanColumn
 * wraps each card in a useSortable HOC so the card component stays pure.
 */
import type { Item, ItemId, LocalDate } from '@tasko/types';
import { useCallback, useRef, useState } from 'react';
import { useTags } from '../../api/tags';
import { todayLocal } from '../../lib/date-fmt';
import { useTaskModalStore } from '../../store/task-modal';
import styles from './styles.module.css';

const MAX_VISIBLE_TAGS = 2;

const PRIORITY_LABELS: Record<Item['priority'], string> = {
  none: 'none',
  low: 'low',
  medium: 'medium',
  high: 'high',
};

const STATUS_LABELS: Record<Item['status'], string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
};

function buildAriaLabel(item: Item, today: LocalDate): string {
  const priorityPart = `priority ${PRIORITY_LABELS[item.priority]}`;
  const statusPart = `status ${STATUS_LABELS[item.status]}`;
  const tagCount = item.tags.length;
  const tagsPart = tagCount > 0 ? `, ${tagCount} tag${tagCount === 1 ? '' : 's'}` : '';

  const diff = item.due_date < today ? -1 : item.due_date === today ? 0 : 1;
  let datePart = '';
  if (diff === 0) datePart = ', due today';
  else if (diff < 0) datePart = ', overdue';

  return `Task: "${item.title}", ${priorityPart}, ${statusPart}${tagsPart}${datePart}`;
}

export interface KanbanCardProps {
  item: Item;
  isDragging?: boolean;
  isSelected?: boolean;
  /** dnd-kit drag handle props — passed from sortable wrapper */
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

export function KanbanCard({ item, isDragging = false, isSelected = false }: KanbanCardProps) {
  const taskModal = useTaskModalStore();
  const today = todayLocal();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const isOverdue = item.due_date < today && item.status !== 'done';
  const isCompleted = item.status === 'done';

  // Tags: show first 2, then "+N" overflow. Resolve TagId → name from the
  // shared tags cache; fall back to id if not in the list yet (transient).
  const { data: tagsData } = useTags(true);
  const tagNameById = new Map<string, string>((tagsData?.tags ?? []).map((t) => [t.id, t.name]));
  const visibleTags = item.tags.slice(0, MAX_VISIBLE_TAGS);
  const overflowTagCount = item.tags.length - visibleTags.length;

  // Subtask progress
  const subtaskTotal = item.subtasks.length;
  const subtaskDone = item.subtasks.filter((s) => s.completed_at !== null).length;

  // Date chip: only show if today or overdue
  const showDateChip = item.due_date === today || isOverdue;

  const ariaLabel = buildAriaLabel(item, today);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // Let ⌘/Ctrl/Shift clicks bubble to the <ul> for multi-select delegation
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.stopPropagation();
      if (contextMenu) return;
      taskModal.openEdit(item.id as ItemId);
    },
    [taskModal, item.id, contextMenu],
  );

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        e.stopPropagation();
        taskModal.openEdit(item.id as ItemId);
      }
    },
    [taskModal, item.id],
  );

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  return (
    <>
      <div
        ref={cardRef}
        className={styles.card}
        data-item-id={item.id}
        data-priority={item.priority}
        data-overdue={isOverdue ? '' : undefined}
        data-completed={isCompleted ? '' : undefined}
        data-dragging={isDragging ? '' : undefined}
        data-selected={isSelected ? '' : undefined}
        aria-label={ariaLabel}
        aria-selected={isSelected}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
      >
        {/* Priority stripe */}
        <div className={styles.priorityStripe} data-priority={item.priority} aria-hidden="true" />

        {/* Card body */}
        <div className={styles.body}>
          <div className={styles.titleRow}>
            {/* Inline priority dot (visible only when selected) */}
            <span className={styles.inlinePriorityDot} data-priority={item.priority} aria-hidden="true" />
            <span className={styles.title}>{item.title}</span>
          </div>

          {/* Meta row */}
          {(visibleTags.length > 0 || subtaskTotal > 0 || showDateChip) && (
            <div className={styles.metaRow}>
              {/* Tag chips */}
              {visibleTags.map((tagId) => {
                const name = tagNameById.get(tagId) ?? tagId;
                return (
                  <span key={tagId} className={styles.tagChip} title={name}>
                    #{name}
                  </span>
                );
              })}
              {overflowTagCount > 0 && <span className={styles.tagChip}>+{overflowTagCount}</span>}

              {/* Subtask progress */}
              {subtaskTotal > 0 && (
                <span
                  className={styles.subtaskChip}
                  aria-label={`${subtaskDone} of ${subtaskTotal} subtasks complete`}
                  title={`${subtaskDone} of ${subtaskTotal} subtasks complete`}
                >
                  {subtaskDone}/{subtaskTotal}
                </span>
              )}

              {/* Date chip (only today or overdue) */}
              {showDateChip && (
                <span
                  className={styles.dateChip}
                  data-today={item.due_date === today ? '' : undefined}
                  data-overdue={isOverdue ? '' : undefined}
                  aria-label={isOverdue ? 'Overdue' : 'Due today'}
                >
                  {isOverdue ? item.due_date : 'Today'}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <KanbanCardContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={item}
          onClose={closeContextMenu}
          onOpen={() => {
            taskModal.openEdit(item.id as ItemId);
            closeContextMenu();
          }}
        />
      )}
    </>
  );
}

interface KanbanCardContextMenuProps {
  x: number;
  y: number;
  item: Item;
  onClose: () => void;
  onOpen: () => void;
}

function KanbanCardContextMenu({ x, y, onClose, onOpen }: KanbanCardContextMenuProps) {
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
          <button
            type="button"
            role="menuitem"
            className={styles.contextItem}
            onClick={() => {
              onOpen();
            }}
          >
            Edit tags
          </button>
        </li>
        <li>
          <button type="button" role="menuitem" className={styles.contextItem} onClick={onClose}>
            Move to project…
          </button>
        </li>
        <li>
          <button type="button" role="menuitem" className={styles.contextItem} onClick={onClose}>
            Reschedule
          </button>
        </li>
        <li>
          <button type="button" role="menuitem" className={styles.contextItem} onClick={onClose}>
            Set priority
          </button>
        </li>
        <li className={styles.contextSeparator} />
        <li>
          <button
            type="button"
            role="menuitem"
            className={`${styles.contextItem} ${styles.contextItemDestructive}`}
            onClick={onClose}
          >
            Delete
          </button>
        </li>
      </menu>
    </>
  );
}

export default KanbanCard;
