import type { Item, LocalDate, TagId } from '@tasko/types';
import { ChevronRight, Layers, LayoutGrid, MoreHorizontal, Repeat, SquareCheckBig } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { daysBetween, formatDateChip, formatDateLong, isOverdue } from '../../lib/date-fmt';
import { Checkbox } from '../checkbox';
import { MultiDayChip } from '../multi-day-chip';
import styles from './styles.module.css';

// ─── Priority dot ──────────────────────────────────────────────────────────────

const PRIORITY_META = {
  none: { size: 6, hollow: true, label: 'Priority: none' },
  low: { size: 6, hollow: false, label: 'Priority: low' },
  medium: { size: 8, hollow: false, label: 'Priority: medium' },
  high: { size: 10, hollow: false, label: 'Priority: high' },
} as const;

interface PriorityDotProps {
  priority: Item['priority'];
  onClick?: (() => void) | undefined;
}

function PriorityDot({ priority, onClick }: PriorityDotProps) {
  const meta = PRIORITY_META[priority];
  return (
    <button
      type="button"
      className={styles.priorityDot}
      style={{
        width: meta.size,
        height: meta.size,
      }}
      data-priority={priority}
      data-hollow={meta.hollow ? '' : undefined}
      aria-label={meta.label}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      tabIndex={0}
    />
  );
}

// ─── Item type icon ────────────────────────────────────────────────────────────

function TypeIcon({ type }: { type: Item['type'] }) {
  if (type === 'epic') return <Layers size={16} aria-hidden="true" className={styles.typeIcon} />;
  if (type === 'feature') return <LayoutGrid size={16} aria-hidden="true" className={styles.typeIcon} />;
  // task / subtask default
  return <SquareCheckBig size={16} aria-hidden="true" className={styles.typeIcon} />;
}

// ─── Date chip ────────────────────────────────────────────────────────────────

interface DateChipProps {
  date: LocalDate;
  today: LocalDate;
  onClick?: (() => void) | undefined;
}

function DateChip({ date, today, onClick }: DateChipProps) {
  const { short, long, overdueDays } = formatDateChip(date, today);

  return (
    <button
      type="button"
      className={styles.dateChip}
      data-overdue={overdueDays !== undefined ? '' : undefined}
      aria-label={long}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      {short}
    </button>
  );
}

// ─── Tag chips ────────────────────────────────────────────────────────────────

interface TagChipsProps {
  tagIds: TagId[];
  onTagClick?: ((tagId: TagId) => void) | undefined;
}

function TagChips({ tagIds, onTagClick }: TagChipsProps) {
  const [expanded, setExpanded] = useState(false);
  const MAX_VISIBLE = 2;

  if (tagIds.length === 0) return null;

  const visible = expanded ? tagIds : tagIds.slice(0, MAX_VISIBLE);
  const overflow = tagIds.length - MAX_VISIBLE;

  return (
    <span className={styles.tagChips}>
      {visible.map((tagId) => (
        <button
          key={tagId}
          type="button"
          className={styles.tagChip}
          aria-label={`Filter by tag ${tagId}`}
          onClick={(e) => {
            e.stopPropagation();
            onTagClick?.(tagId);
          }}
        >
          #{tagId}
        </button>
      ))}
      {!expanded && overflow > 0 && (
        <button
          type="button"
          className={styles.tagOverflow}
          aria-label={`${overflow} more tags`}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(true);
          }}
        >
          +{overflow}
        </button>
      )}
    </span>
  );
}

// ─── Subtask progress chip ────────────────────────────────────────────────────

interface SubtaskChipProps {
  done: number;
  total: number;
  onClick?: (() => void) | undefined;
}

function SubtaskChip({ done, total, onClick }: SubtaskChipProps) {
  return (
    <button
      type="button"
      className={styles.subtaskChip}
      aria-label={`${done} of ${total} subtasks complete`}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      {done}/{total}
    </button>
  );
}

// ─── TaskListRow props ─────────────────────────────────────────────────────────

export interface TaskListRowProps {
  item: Item;
  isFocused?: boolean;
  isSelected?: boolean;
  isMultiSelected?: boolean;
  showProjectBreadcrumb?: boolean;
  density?: 'cozy' | 'comfortable';
  todayLocalDate: LocalDate;
  project?: { name: string; folder?: { name: string } };
  inlineEditMode?: boolean;
  onClick?: () => void;
  onToggleCheckbox?: () => void;
  onTitleClickInlineEdit?: () => void;
  onTitleCommitInlineEdit?: (newTitle: string) => void;
  onDateClick?: () => void;
  onPriorityClick?: () => void;
  onTagClick?: (tagId: TagId) => void;
  onSubtaskChipClick?: () => void;
  onMenuOpen?: () => void;
  onOpenChevronClick?: () => void;
  onScheduleTodayKeyboard?: () => void;
  onDeleteRequest?: () => void;
  onScheduleSwipe?: () => void;
  onDeleteSwipe?: () => void;
}

// ─── Should we show the date chip? ────────────────────────────────────────────

function shouldShowDateChip(date: LocalDate, today: LocalDate): boolean {
  const diff = daysBetween(today, date);
  // Show: today (0), tomorrow (1), overdue (< 0), or > 7 days out
  return diff <= 1 || diff > 7;
}

// ─── Build row aria-label ─────────────────────────────────────────────────────

function buildAriaLabel(item: Item, today: LocalDate, project?: { name: string }): string {
  const typeLabel = item.type === 'epic' ? 'Epic' : item.type === 'feature' ? 'Feature' : 'Task';
  let label = `${typeLabel}: "${item.title}"`;
  label += `, priority ${item.priority}`;
  if (shouldShowDateChip(item.due_date, today)) {
    label += `, due ${formatDateLong(item.due_date, today)}`;
  }
  if (item.tags.length > 0) {
    label += `, ${item.tags.length} tag${item.tags.length === 1 ? '' : 's'}`;
  }
  if (item.recurrence != null) {
    label += ', recurring';
  }
  if (item.start_date != null && item.start_date !== item.due_date) {
    const day = daysBetween(item.start_date, today) + 1;
    const total = daysBetween(item.start_date, item.due_date) + 1;
    label += `, day ${day} of ${total}`;
  }
  if (project) {
    label += `, in ${project.name}`;
  }
  if (isOverdue(item.due_date, today)) {
    const days = Math.abs(daysBetween(today, item.due_date));
    label += `, overdue by ${days} days`;
  }
  return label;
}

// ─── Mobile swipe hook ────────────────────────────────────────────────────────

interface SwipeState {
  startX: number;
  currentX: number;
  active: boolean;
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * TaskListRow — the workhorse row used in flat list views.
 * role="listitem" inside a role="list" parent.
 * Full keyboard support, mobile swipe, priority dot, inline-edit title,
 * multi-day chip, date chip, tag chips, subtask progress chip, hover affordances.
 */
export function TaskListRow({
  item,
  isFocused = false,
  isSelected = false,
  isMultiSelected = false,
  density = 'cozy',
  todayLocalDate,
  project,
  inlineEditMode = false,
  onClick,
  onToggleCheckbox,
  onTitleClickInlineEdit,
  onTitleCommitInlineEdit,
  onDateClick,
  onPriorityClick,
  onTagClick,
  onSubtaskChipClick,
  onMenuOpen,
  onOpenChevronClick,
  onScheduleTodayKeyboard,
  onDeleteRequest,
  onScheduleSwipe,
  onDeleteSwipe,
}: TaskListRowProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [editValue, setEditValue] = useState(item.title);
  const hoverOutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Swipe state for mobile
  const swipeRef = useRef<SwipeState>({ startX: 0, currentX: 0, active: false });
  const [swipeOffset, setSwipeOffset] = useState(0);
  const rowRef = useRef<HTMLLIElement>(null);

  // Sync editValue when item.title changes externally
  useEffect(() => {
    setEditValue(item.title);
  }, [item.title]);

  const handleMouseEnter = useCallback(() => {
    if (hoverOutTimer.current) clearTimeout(hoverOutTimer.current);
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    hoverOutTimer.current = setTimeout(() => setIsHovered(false), 120);
  }, []);

  // Keyboard handling when row is focused
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLLIElement>) => {
      if (inlineEditMode) return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          onToggleCheckbox?.();
          break;
        case 'Enter':
        case 'o':
        case 'O':
          e.preventDefault();
          onClick?.();
          break;
        case '1':
        case '2':
        case '3':
        case '4':
          onPriorityClick?.();
          break;
        case 't':
        case 'T':
          onScheduleTodayKeyboard?.();
          break;
        case 'Delete':
        case 'Backspace':
          onDeleteRequest?.();
          break;
      }
    },
    [inlineEditMode, onClick, onToggleCheckbox, onPriorityClick, onScheduleTodayKeyboard, onDeleteRequest],
  );

  // Inline edit commit
  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onTitleCommitInlineEdit?.(editValue.trim() || item.title);
    } else if (e.key === 'Escape') {
      setEditValue(item.title);
      onTitleCommitInlineEdit?.(item.title); // cancel — signal parent to exit edit mode
    }
  };

  // Mobile swipe via PointerEvents
  const handlePointerDown = (e: React.PointerEvent<HTMLLIElement>) => {
    swipeRef.current = { startX: e.clientX, currentX: e.clientX, active: true };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLLIElement>) => {
    if (!swipeRef.current.active) return;
    swipeRef.current.currentX = e.clientX;
    const offset = e.clientX - swipeRef.current.startX;
    setSwipeOffset(offset);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLLIElement>) => {
    if (!swipeRef.current.active) return;
    swipeRef.current.active = false;
    const width = rowRef.current?.offsetWidth ?? 300;
    const offset = e.clientX - swipeRef.current.startX;

    if (offset > width * 0.3) {
      // Right swipe ≥ 30% → complete
      onToggleCheckbox?.();
    } else if (offset < -width * 0.5) {
      // Left swipe ≥ 50% → action drawer (stub: call swipe callbacks)
      onScheduleSwipe?.();
    }
    setSwipeOffset(0);
  };

  // Compute states
  const overdue = isOverdue(item.due_date, todayLocalDate);
  const isCompleted = item.status === 'done';
  const isLoading = false; // Will be wired in task-08

  const hasMultiDay = item.start_date != null && item.start_date !== item.due_date;

  const multiDayDay = hasMultiDay && item.start_date ? daysBetween(item.start_date, todayLocalDate) + 1 : 0;
  const multiDayTotal = hasMultiDay && item.start_date ? daysBetween(item.start_date, item.due_date) + 1 : 0;

  const subtasksDone = item.subtasks.filter((s) => s.status === 'done').length;
  const subtasksTotal = item.subtasks.length;
  const showDateChip = shouldShowDateChip(item.due_date, todayLocalDate);

  // Compute data-state value
  const dataStates: string[] = [];
  if (isHovered) dataStates.push('hover');
  if (isFocused) dataStates.push('focus');
  if (isSelected) dataStates.push('selected');
  if (isMultiSelected) dataStates.push('multi-selected');
  if (overdue) dataStates.push('overdue');
  if (hasMultiDay) dataStates.push('multi-day');
  if (isCompleted) dataStates.push('completed');
  if (isLoading) dataStates.push('loading');

  const ariaLabel = buildAriaLabel(item, todayLocalDate, project);

  return (
    <li
      ref={rowRef}
      className={styles.row}
      aria-label={ariaLabel}
      aria-busy={isLoading ? 'true' : undefined}
      data-state={dataStates.length > 0 ? dataStates.join(' ') : undefined}
      data-density={density}
      data-item-id={item.id}
      tabIndex={isFocused ? 0 : -1}
      style={
        swipeOffset !== 0 ? { transform: `translateX(${swipeOffset}px)`, transition: 'none' } : undefined
      }
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        // Only trigger modal if the click was directly on the row (not a child interactive element)
        if (e.target === e.currentTarget) {
          onClick?.();
        }
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Priority dot */}
      <PriorityDot priority={item.priority} onClick={onPriorityClick} />

      {/* Checkbox */}
      <Checkbox
        checked={isCompleted}
        onChange={() => onToggleCheckbox?.()}
        aria-label={`Mark ${item.title} complete`}
        size="md"
        disabled={false}
      />

      {/* Title area */}
      <div className={styles.titleArea}>
        {inlineEditMode ? (
          <input
            className={styles.inlineEditInput}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleEditKeyDown}
            onBlur={() => {
              onTitleCommitInlineEdit?.(editValue.trim() || item.title);
            }}
            // biome-ignore lint/a11y/noAutofocus: intentional — user clicked title to edit
            autoFocus
            aria-label="Edit task title"
          />
        ) : (
          <button
            type="button"
            className={styles.title}
            data-state="inline-editable"
            onClick={(e) => {
              e.stopPropagation();
              onTitleClickInlineEdit?.();
            }}
          >
            {item.title}
          </button>
        )}

        {/* Recurring icon */}
        {item.recurrence != null && (
          <span className={styles.recurringIcon} aria-label="Recurring" title="Recurring task">
            <Repeat size={12} aria-hidden="true" />
          </span>
        )}
      </div>

      {/* Meta chips */}
      <div className={styles.metaArea}>
        {/* Multi-day chip */}
        {hasMultiDay && <MultiDayChip day={Math.max(1, multiDayDay)} total={multiDayTotal} />}

        {/* Date chip */}
        {showDateChip && <DateChip date={item.due_date} today={todayLocalDate} onClick={onDateClick} />}

        {/* Tag chips */}
        {item.tags.length > 0 && <TagChips tagIds={item.tags as TagId[]} onTagClick={onTagClick} />}

        {/* Subtask progress chip */}
        {subtasksTotal > 0 && (
          <SubtaskChip done={subtasksDone} total={subtasksTotal} onClick={onSubtaskChipClick} />
        )}
      </div>

      {/* Hover affordances */}
      {(isHovered || isFocused) && (
        <div className={styles.hoverActions}>
          <button
            type="button"
            className={styles.hoverBtn}
            aria-label="More actions"
            title="More actions"
            onClick={(e) => {
              e.stopPropagation();
              onMenuOpen?.();
            }}
          >
            <MoreHorizontal size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.hoverBtn}
            aria-label="Open (O)"
            title="Open (O)"
            onClick={(e) => {
              e.stopPropagation();
              onOpenChevronClick?.();
            }}
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </li>
  );
}

export default TaskListRow;
