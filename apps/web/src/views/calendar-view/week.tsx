/**
 * CalendarWeekView — the calendar week view.
 *
 * Layout:
 *   - Page title "Calendar"
 *   - Header: "< Mon DD – Mon DD, Year >" chevrons + view toggle Month/Week + filter chips bar
 *   - All-day strip: chips for items with due_time === null OR multi-day spans
 *   - Time grid: 24 rows (hours 0-23) × 7 columns (days)
 *
 * Week navigation via URL search param ?week=<YYYY-MM-DD> (Monday or Sunday of week per week_start).
 * Chevron navigation moves ±7 days.
 *
 * Drag is CUT for v1 (binding resolution §1.1).
 *
 * Keyboard nav per accessibility §2.3:
 *   ← → arrows move focus across all-day strip cells
 *   T jumps to today's week
 *   N opens Task modal with current focused date pre-filled
 *   ↑ ↓ scroll the time grid
 */
import type { Item, ItemId, LocalDate } from '@tasko/types';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useConfig } from '../../api/config';
import { useProjects } from '../../api/projects';
import { useTags } from '../../api/tags';
import { CalendarEventChip } from '../../components/calendar-event-chip';
import type { DayPosition } from '../../components/calendar-event-chip';
import { CalendarWeekBlock } from '../../components/calendar-week-block';
import { EmptyState } from '../../components/empty-state';
import { IconButton } from '../../components/icon-button';
import { todayLocal } from '../../lib/date-fmt';
import { useTaskModalStore } from '../../store/task-modal';
import type { CalendarFilters } from './filters';
import { buildCalendarFilterParams, parseCalendarFilters } from './filters';
import { CalendarFiltersBar } from './month';
import { useCalendarItems } from './use-calendar-items';
import styles from './week.module.css';

// ─── Date utilities ───────────────────────────────────────────────────────────

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY_SHORT_SUN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_SHORT_MON = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const HOUR_LABELS = [
  '12 AM',
  '1 AM',
  '2 AM',
  '3 AM',
  '4 AM',
  '5 AM',
  '6 AM',
  '7 AM',
  '8 AM',
  '9 AM',
  '10 AM',
  '11 AM',
  '12 PM',
  '1 PM',
  '2 PM',
  '3 PM',
  '4 PM',
  '5 PM',
  '6 PM',
  '7 PM',
  '8 PM',
  '9 PM',
  '10 PM',
  '11 PM',
];

function toLocalDate(d: Date): LocalDate {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}` as LocalDate;
}

function addDays(date: LocalDate, n: number): LocalDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return toLocalDate(d);
}

function startOfWeek(date: LocalDate, weekStart: 'sun' | 'mon'): LocalDate {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0=Sun
  const offset = weekStart === 'mon' ? (dow === 0 ? -6 : 1 - dow) : -dow;
  d.setUTCDate(d.getUTCDate() + offset);
  return toLocalDate(d);
}

function buildWeekDates(weekStart: LocalDate): LocalDate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

function parseWeekParam(search: string): LocalDate | null {
  const params = new URLSearchParams(search);
  const w = params.get('week');
  if (w && /^\d{4}-\d{2}-\d{2}$/.test(w)) return w as LocalDate;
  return null;
}

function formatWeekRange(dates: LocalDate[]): string {
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (!first || !last) return '';

  const firstDate = new Date(`${first}T00:00:00Z`);
  const lastDate = new Date(`${last}T00:00:00Z`);

  const firstMonth = MONTH_SHORT[firstDate.getUTCMonth()] ?? '';
  const lastMonth = MONTH_SHORT[lastDate.getUTCMonth()] ?? '';
  const firstDay = firstDate.getUTCDate();
  const lastDay = lastDate.getUTCDate();
  const year = lastDate.getUTCFullYear();

  return `${firstMonth} ${firstDay} – ${lastMonth} ${lastDay}, ${year}`;
}

function getHourFromTime(time: string): number {
  const parts = time.split(':').map(Number);
  return parts[0] ?? 0;
}

function computeDayPosition(item: Item, cellDate: LocalDate): DayPosition {
  if (item.start_date === null) return 'single';
  if (cellDate === item.start_date) return 'start';
  if (cellDate === item.due_date) return 'end';
  return 'middle';
}

function spanLength(item: Item): number {
  if (item.start_date === null) return 1;
  const start = new Date(`${item.start_date}T00:00:00Z`);
  const end = new Date(`${item.due_date}T00:00:00Z`);
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

function spanDayOf(item: Item, cellDate: LocalDate): number {
  if (item.start_date === null) return 1;
  const start = new Date(`${item.start_date}T00:00:00Z`);
  const cell = new Date(`${cellDate}T00:00:00Z`);
  const ms = cell.getTime() - start.getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CalendarWeekView() {
  const today = todayLocal();

  const { data: configData } = useConfig();
  // System default is 'mon' (per packages/types schemas/config.ts) — match it
  // so the pre-config-loaded state lines up with the post-load state.
  const weekStart: 'sun' | 'mon' = configData?.week_start ?? 'mon';

  // Week from URL param or default to current week. The URL value may have
  // been written with a different weekStart preference (e.g. sun-saved then
  // user flipped to mon), so we anchor on the *middle* of that week to land
  // on the right Monday/Sunday regardless.
  const [weekStartDate, setWeekStartDate] = useState<LocalDate>(() => {
    if (typeof window === 'undefined') return startOfWeek(today, 'mon');
    const fromUrl = parseWeekParam(window.location.search);
    return fromUrl ? startOfWeek(addDays(fromUrl, 3), 'mon') : startOfWeek(today, 'mon');
  });

  // When weekStart config loads (or changes), re-align the current week start
  // to the matching weekStart preference. Anchor on the MIDDLE of the
  // currently-displayed week (prev + 3 days) so both weekStarts produce a
  // start-of-week within the same calendar week. Anchoring on prev directly
  // would shift sun→mon to the *previous* Monday (since the Sunday-start IS
  // the last day of the previous Monday-week).
  useEffect(() => {
    setWeekStartDate((prev) => startOfWeek(addDays(prev, 3), weekStart));
  }, [weekStart]);

  // Sync week param to URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    params.set('week', weekStartDate);
    const filterParams = buildCalendarFilterParams(filters);
    for (const [k, v] of filterParams.entries()) {
      params.set(k, v);
    }
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStartDate]);

  // Filter state — URL search params
  const [filters, setFilters] = useState<CalendarFilters>(() => {
    if (typeof window === 'undefined') return { show_completed: false };
    return parseCalendarFilters(new URLSearchParams(window.location.search));
  });

  // Sync filter state to URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = buildCalendarFilterParams(filters);
    params.set('week', weekStartDate);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
  }, [filters, weekStartDate]);

  const { data: projectsData } = useProjects();
  const { data: tagsData } = useTags();

  const projectsById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projectsData?.projects ?? []) map.set(p.id, p.name);
    return map;
  }, [projectsData]);

  const tagsById = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tagsData?.tags ?? []) map.set(t.id, t.name);
    return map;
  }, [tagsData]);

  const taskModal = useTaskModalStore();

  // Week dates (7 days)
  const weekDates = useMemo(() => buildWeekDates(weekStartDate), [weekStartDate]);
  const weekdayHeaders = weekStart === 'mon' ? WEEKDAY_SHORT_MON : WEEKDAY_SHORT_SUN;

  const weekRangeLabel = useMemo(() => formatWeekRange(weekDates), [weekDates]);

  // Calendar items
  const { byDate, isLoading } = useCalendarItems(filters);

  // Focused day column for keyboard nav (all-day strip)
  const [focusedDayIdx, setFocusedDayIdx] = useState<number | null>(null);

  // Ref to time grid for keyboard scroll
  const timeGridRef = useRef<HTMLDivElement>(null);

  // Navigate week
  const goToPrevWeek = useCallback(() => {
    setWeekStartDate((prev) => addDays(prev, -7));
  }, []);

  const goToNextWeek = useCallback(() => {
    setWeekStartDate((prev) => addDays(prev, 7));
  }, []);

  const goToTodayWeek = useCallback(() => {
    setWeekStartDate(startOfWeek(today, weekStart));
  }, [today, weekStart]);

  // ─── All-day items per day ─────────────────────────────────────────────────

  // All-day: items without due_time OR multi-day spans
  // Timed: items WITH due_time (single-day only)
  const { allDayByDate, timedByDate } = useMemo(() => {
    const allDayMap = new Map<LocalDate, Item[]>();
    const timedMap = new Map<LocalDate, Item[]>();

    for (const date of weekDates) {
      const dayItems = byDate.get(date) ?? [];
      const allDay: Item[] = [];
      const timed: Item[] = [];
      for (const item of dayItems) {
        if (item.due_time !== null && item.start_date === null) {
          timed.push(item);
        } else {
          allDay.push(item);
        }
      }
      allDayMap.set(date, allDay);
      timedMap.set(date, timed);
    }
    return { allDayByDate: allDayMap, timedByDate: timedMap };
  }, [byDate, weekDates]);

  // ─── Empty state ──────────────────────────────────────────────────────────

  const hasAnyItems = weekDates.some((d) => (byDate.get(d) ?? []).length > 0);
  const isEmpty = !isLoading && !hasAnyItems;

  // ─── Keyboard nav ─────────────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      switch (e.key) {
        case 'ArrowLeft': {
          e.preventDefault();
          setFocusedDayIdx((prev) => (prev === null ? 0 : Math.max(0, prev - 1)));
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          setFocusedDayIdx((prev) => (prev === null ? 0 : Math.min(6, prev + 1)));
          break;
        }
        case 'ArrowUp': {
          if (timeGridRef.current) {
            e.preventDefault();
            timeGridRef.current.scrollBy({ top: -48, behavior: 'smooth' });
          }
          break;
        }
        case 'ArrowDown': {
          if (timeGridRef.current) {
            e.preventDefault();
            timeGridRef.current.scrollBy({ top: 48, behavior: 'smooth' });
          }
          break;
        }
        case 'T':
        case 't': {
          e.preventDefault();
          goToTodayWeek();
          const todayIdx = weekDates.indexOf(today);
          if (todayIdx >= 0) setFocusedDayIdx(todayIdx);
          break;
        }
        case 'N':
        case 'n': {
          e.preventDefault();
          const focusedDate = focusedDayIdx !== null ? weekDates[focusedDayIdx] : today;
          taskModal.openNew({ initialDueDate: focusedDate ?? today });
          break;
        }
      }
    },
    [goToTodayWeek, weekDates, today, focusedDayIdx, taskModal],
  );

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleDeleteItem = useCallback(
    (item: Item) => {
      taskModal.openEdit(item.id as ItemId);
    },
    [taskModal],
  );

  const handleMoveItem = useCallback(
    (item: Item) => {
      taskModal.openEdit(item.id as ItemId);
    },
    [taskModal],
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={styles.root} onKeyDown={handleKeyDown} tabIndex={-1}>
      {/* Page title */}
      <h1 className={styles.pageTitle}>Calendar</h1>

      {/* Chrome */}
      <div className={styles.chrome}>
        <div className={styles.chromeLeft}>
          <div className={styles.weekNav}>
            <IconButton
              icon={ChevronLeft}
              aria-label="Previous week"
              tooltip="Previous week"
              size="sm"
              onClick={goToPrevWeek}
            />
            <span className={styles.weekRangeLabel} aria-live="polite" aria-atomic="true">
              {weekRangeLabel}
            </span>
            <IconButton
              icon={ChevronRight}
              aria-label="Next week"
              tooltip="Next week"
              size="sm"
              onClick={goToNextWeek}
            />
          </div>
        </div>

        <div className={styles.chromeRight}>
          {/* biome-ignore lint/a11y/useSemanticElements: view toggle group uses div+aria-label per component pattern */}
          <div className={styles.viewToggle} role="group" aria-label="Calendar view">
            <a href="/calendar" className={styles.viewToggleLink}>
              Month
            </a>
            <button type="button" className={styles.viewToggleBtn} data-active="" aria-pressed="true">
              Week
            </button>
          </div>
        </div>
      </div>

      {/* Filter chips bar */}
      <div className={styles.filtersBarWrapper}>
        <CalendarFiltersBar
          filters={filters}
          onFiltersChange={setFilters}
          projectsById={projectsById}
          tagsById={tagsById}
        />
      </div>

      {/* Empty state */}
      {isEmpty && (
        <div className={styles.emptyStateWrapper}>
          <EmptyState icon={Calendar} headline="No events this week." subline="A quiet week." />
        </div>
      )}

      {/* Week grid body */}
      {!isEmpty && (
        <section className={styles.body} aria-label={`Week of ${weekRangeLabel}`}>
          {/* Weekday header row */}
          <div className={styles.weekdayHeaderRow} aria-hidden="true">
            <div className={styles.timeGutter} />
            {weekDates.map((date, idx) => {
              const d = new Date(`${date}T00:00:00Z`);
              const dayOfWeek = weekdayHeaders[d.getUTCDay() % 7] ?? weekdayHeaders[idx] ?? '';
              const dayNum = d.getUTCDate();
              const isToday = date === today;
              return (
                <div key={date} className={styles.weekdayHeader} data-today={isToday ? '' : undefined}>
                  {dayOfWeek} {dayNum}
                </div>
              );
            })}
          </div>

          {/* All-day strip */}
          <div className={styles.allDayStrip} aria-label="All-day events">
            <div className={styles.allDayGutter}>All day</div>
            {weekDates.map((date, idx) => {
              const dayItems = allDayByDate.get(date) ?? [];
              const isFocused = focusedDayIdx === idx;
              return (
                // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard nav handled at container level via onKeyDown
                <div
                  key={date}
                  className={styles.allDayCell}
                  data-date={date}
                  data-focused={isFocused ? '' : undefined}
                  tabIndex={isFocused ? 0 : -1}
                  aria-label={`All-day events for ${date}${isFocused ? ', focused' : ''}`}
                  onClick={() => setFocusedDayIdx(idx)}
                  onFocus={() => setFocusedDayIdx(idx)}
                >
                  {dayItems.map((item) => {
                    const dayPosition = computeDayPosition(item, date);
                    const totalSpan = spanLength(item);
                    const dayNum = spanDayOf(item, date);
                    return (
                      <CalendarEventChip
                        key={`${item.id}-${date}`}
                        item={item}
                        cellDate={date}
                        today={today}
                        dayPosition={dayPosition}
                        spanDays={totalSpan}
                        spanDay={dayNum}
                        onDeleteRequest={handleDeleteItem}
                        onMoveRequest={handleMoveItem}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div className={styles.timeGrid} ref={timeGridRef} aria-label="Time grid">
            <div className={styles.timeGridContent}>
              {/* 24 hour rows */}
              {Array.from({ length: 24 }, (_, hourIdx) => {
                const hourLabel = HOUR_LABELS[hourIdx] ?? '';
                const hourKey = HOUR_LABELS[hourIdx] ?? `hour-${hourIdx}`;
                return [
                  // Hour gutter label — key uses hour label string, not array index
                  <div
                    key={`gutter-${hourKey}`}
                    className={styles.hourGutter}
                    style={{ gridRow: hourIdx + 1, gridColumn: 1 }}
                  >
                    {hourIdx > 0 && <span className={styles.hourGutterLabel}>{hourLabel}</span>}
                  </div>,
                  // 7 day cells for this hour — key uses date + hour label
                  ...weekDates.map((date, dayIdx) => {
                    const timedItems = timedByDate.get(date) ?? [];
                    const itemsThisHour = timedItems.filter((item) => {
                      if (!item.due_time) return false;
                      return getHourFromTime(item.due_time) === hourIdx;
                    });

                    return (
                      <div
                        key={`cell-${date}-${hourKey}`}
                        className={styles.timeCell}
                        style={{ gridRow: hourIdx + 1, gridColumn: dayIdx + 2 }}
                        data-date={date}
                        data-hour={hourIdx}
                      >
                        {itemsThisHour.map((item) => (
                          <div key={item.id} className={styles.timeCellBlock}>
                            <CalendarWeekBlock item={item} today={today} />
                          </div>
                        ))}
                      </div>
                    );
                  }),
                ];
              }).flat()}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default CalendarWeekView;
