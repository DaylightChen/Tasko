/**
 * CalendarDayCell — a single day cell in the 7-column calendar month grid.
 *
 * Per UX §26:
 * - Min height 96px desktop (set via CSS), equal column width.
 * - Top-left day number; today = accent-filled circle with text-on-accent.
 * - Out-of-month cells: text-muted, canvas-subtle bg.
 * - Body: stack of event chips (first MAX_VISIBLE) + "+N more" overflow button.
 * - role="gridcell" with full-date aria-label like "Monday, May 18, 2026, 3 events".
 *
 * Multi-day chip positioning:
 *   The cell receives pre-computed dayPosition + spanDay + spanDays per item.
 *   This is resolved by the parent month view before passing items to each cell.
 */
import type { Item, LocalDate } from '@tasko/types';
import { Plus } from 'lucide-react';
import type React from 'react';
import { useCallback } from 'react';

import { CalendarEventChip, type DayPosition } from '../calendar-event-chip';
import styles from './styles.module.css';

export const MAX_VISIBLE_CHIPS = 4;

const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
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

function buildCellAriaLabel(date: LocalDate, isToday: boolean, itemCount: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = WEEKDAY_LONG[d.getUTCDay()] ?? '';
  const month = MONTH_LONG[d.getUTCMonth()] ?? '';
  const dayNum = d.getUTCDate();
  const year = d.getUTCFullYear();
  const todayPart = isToday ? ', today' : '';
  const eventPart = itemCount === 0 ? ', no events' : itemCount === 1 ? ', 1 event' : `, ${itemCount} events`;
  return `${dow}, ${month} ${dayNum}, ${year}${todayPart}${eventPart}`;
}

export interface CalendarDayCellItem {
  item: Item;
  dayPosition: DayPosition;
  spanDays: number;
  spanDay: number;
}

export interface CalendarDayCellProps {
  date: LocalDate;
  today: LocalDate;
  /** Items to render in this cell (full set, before the +N more overflow). */
  items: CalendarDayCellItem[];
  /** Whether this date belongs to the currently visible month. */
  inMonth: boolean;
  /** Whether keyboard focus is on this cell. */
  isFocused: boolean;
  /** Whether the day-detail popover is currently open for this cell's date. */
  isDetailOpen: boolean;
  /** Called when the user opens the day-detail popover. */
  onOpenDayDetail: (date: LocalDate) => void;
  /** Called when user requests a new task on this day. */
  onNewTask: (date: LocalDate) => void;
  /** Called when user requests delete of an item. */
  onDeleteItem: (item: Item) => void;
  /** Called when user requests move-to-project of an item. */
  onMoveItem: (item: Item) => void;
  /** tabIndex for keyboard navigation. */
  tabIndex: number;
}

export function CalendarDayCell({
  date,
  today,
  items,
  inMonth,
  isFocused,
  isDetailOpen,
  onOpenDayDetail,
  onNewTask,
  onDeleteItem,
  onMoveItem,
  tabIndex,
}: CalendarDayCellProps) {
  const isToday = date === today;
  const dayNumber = new Date(`${date}T00:00:00Z`).getUTCDate();
  const visibleItems = items.slice(0, MAX_VISIBLE_CHIPS);
  const overflowCount = Math.max(0, items.length - MAX_VISIBLE_CHIPS);

  const ariaLabel = buildCellAriaLabel(date, isToday, items.length);

  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // The month view handles arrow navigation; here we just handle Enter (open day detail) and N (new task)
      if (e.key === 'Enter') {
        e.preventDefault();
        onOpenDayDetail(date);
      } else if (e.key === 'n' || e.key === 'N') {
        // Only when the cell itself has focus, not a child
        if (e.target === e.currentTarget) {
          e.preventDefault();
          onNewTask(date);
        }
      }
    },
    [date, onOpenDayDetail, onNewTask],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only fire when clicking the cell background, not an event chip
      if (
        e.target === e.currentTarget ||
        (styles.dayNumber !== undefined && (e.target as HTMLElement).classList.contains(styles.dayNumber))
      ) {
        // Cell right-click: "New task on this day" — for now we trigger new task
        e.preventDefault();
        onNewTask(date);
      }
    },
    [date, onNewTask],
  );

  return (
    // biome-ignore lint/a11y/useSemanticElements: ARIA grid pattern uses div+role, not table+td
    <div
      role="gridcell"
      aria-label={ariaLabel}
      className={styles.cell}
      data-date={date}
      data-in-month={inMonth ? '' : undefined}
      data-today={isToday ? '' : undefined}
      data-focused={isFocused ? '' : undefined}
      tabIndex={tabIndex}
      onKeyDown={handleCellKeyDown}
      onContextMenu={handleContextMenu}
    >
      {/* Day number */}
      <div className={styles.dayNumberWrapper}>
        <span className={styles.dayNumber} aria-hidden="true" data-today={isToday ? '' : undefined}>
          {dayNumber}
        </span>
        {isToday && <span className={styles.srOnly}>Today</span>}
      </div>

      {/* Event chips */}
      <div className={styles.chips}>
        {visibleItems.map(({ item, dayPosition, spanDays, spanDay }) => (
          <CalendarEventChip
            key={`${item.id}-${date}`}
            item={item}
            cellDate={date}
            today={today}
            dayPosition={dayPosition}
            spanDays={spanDays}
            spanDay={spanDay}
            onDeleteRequest={onDeleteItem}
            onMoveRequest={onMoveItem}
          />
        ))}

        {overflowCount > 0 && (
          <button
            type="button"
            className={styles.moreButton}
            aria-label={`View ${overflowCount} more events on ${ariaLabel.split(',').slice(0, 3).join(',')}`}
            aria-haspopup="dialog"
            aria-expanded={isDetailOpen ? 'true' : 'false'}
            onClick={(e) => {
              e.stopPropagation();
              onOpenDayDetail(date);
            }}
          >
            <Plus size={10} aria-hidden="true" />
            {overflowCount} more
          </button>
        )}
      </div>
    </div>
  );
}

export default CalendarDayCell;
