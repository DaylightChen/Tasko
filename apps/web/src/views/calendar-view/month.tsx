/**
 * CalendarMonthView — the main calendar month view.
 *
 * Layout:
 *  - Page title "Calendar"
 *  - Header: "< May 2026 >" chevrons + view toggle Month/Week + filter chips bar
 *  - 7-column grid: weekday headers + 6 rows of day cells (42 cells total)
 *  - Day cells with event chips + "+N more" overflow → DayDetailPopover
 *
 * Filter state lives in URL search params (?month=2026-05&filter_project_id=...&show_completed=true).
 *
 * Keyboard navigation per accessibility §2.3:
 *   ← → day, ↑ ↓ week, PgUp/PgDn month, Shift+PgUp/PgDn year,
 *   Home/End week, T today, Enter day-detail, N new task.
 *
 * Drag-to-reschedule is CUT (binding resolution §1.1). Click only.
 *
 * week_start: read from useConfig(). Defaults to 'sun' if config not loaded.
 * TODO: wire to settings when config is available — falls back to 'sun'.
 */
import type { Item, ItemId, LocalDate } from '@tasko/types';
import { Calendar, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useConfig } from '../../api/config';
import { useProjects } from '../../api/projects';
import { useTags } from '../../api/tags';
import { CalendarDayCell, type CalendarDayCellItem } from '../../components/calendar-day-cell';
import type { DayPosition } from '../../components/calendar-event-chip';
import { EmptyState } from '../../components/empty-state';
import { FilterChip } from '../../components/filter-chip';
import { IconButton } from '../../components/icon-button';
import { announce } from '../../lib/a11y';
import { todayLocal } from '../../lib/date-fmt';
import { useTaskModalStore } from '../../store/task-modal';
import { DayDetailPopover } from './day-detail';
import {
  type CalendarFilters,
  activeFilterCount,
  buildCalendarFilterParams,
  parseCalendarFilters,
  removeFilter,
} from './filters';
import styles from './month.module.css';
import { useCalendarItems } from './use-calendar-items';

// ─── Constants ────────────────────────────────────────────────────────────────

const WEEKDAY_SHORT_SUN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_SHORT_MON = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = [
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

// ─── Date utilities ───────────────────────────────────────────────────────────

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

function addMonths(date: LocalDate, n: number): LocalDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return toLocalDate(d);
}

function addYears(date: LocalDate, n: number): LocalDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + n);
  return toLocalDate(d);
}

/** Return the LocalDate of the first day of a given month (YYYY-MM). */
function firstDayOfMonth(yearMonth: string): LocalDate {
  return `${yearMonth}-01` as LocalDate;
}

/** Return "YYYY-MM" from a LocalDate. */
function toYearMonth(date: LocalDate): string {
  return date.slice(0, 7);
}

/** Return the start of the week containing `date`, given weekStart. */
function startOfWeek(date: LocalDate, weekStart: 'sun' | 'mon'): LocalDate {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0=Sun
  const offset = weekStart === 'mon' ? (dow === 0 ? -6 : 1 - dow) : -dow;
  d.setUTCDate(d.getUTCDate() + offset);
  return toLocalDate(d);
}

/** Return the end of the week containing `date`, given weekStart. */
function endOfWeek(date: LocalDate, weekStart: 'sun' | 'mon'): LocalDate {
  return addDays(startOfWeek(date, weekStart), 6);
}

/**
 * Build the 42 dates (6 rows × 7 cols) for a month grid.
 * The grid always starts on the weekStart day of the week containing the 1st.
 */
function buildMonthGrid(yearMonth: string, weekStart: 'sun' | 'mon'): LocalDate[] {
  const first = firstDayOfMonth(yearMonth);
  const gridStart = startOfWeek(first, weekStart);
  const dates: LocalDate[] = [];
  for (let i = 0; i < 42; i++) {
    dates.push(addDays(gridStart, i));
  }
  return dates;
}

/** Count total span days for a multi-day item. */
function spanLength(item: Item): number {
  if (item.start_date === null) return 1;
  const start = new Date(`${item.start_date}T00:00:00Z`);
  const end = new Date(`${item.due_date}T00:00:00Z`);
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

/** Which day within the span is `cellDate` (1-based). */
function spanDayOf(item: Item, cellDate: LocalDate): number {
  if (item.start_date === null) return 1;
  const start = new Date(`${item.start_date}T00:00:00Z`);
  const cell = new Date(`${cellDate}T00:00:00Z`);
  const ms = cell.getTime() - start.getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

/** Compute DayPosition for an item on a given cell date. */
function computeDayPosition(item: Item, cellDate: LocalDate): DayPosition {
  if (item.start_date === null) return 'single';
  if (cellDate === item.start_date) return 'start';
  if (cellDate === item.due_date) return 'end';
  return 'middle';
}

// ─── CalendarFiltersBar ───────────────────────────────────────────────────────

export interface CalendarFiltersBarProps {
  filters: CalendarFilters;
  onFiltersChange: (f: CalendarFilters) => void;
  projectsById: Map<string, string>;
  tagsById: Map<string, string>;
}

export function CalendarFiltersBar({
  filters,
  onFiltersChange,
  projectsById,
  tagsById,
}: CalendarFiltersBarProps) {
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [subMenu, setSubMenu] = useState<'project' | 'tag' | null>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  const chipCount = activeFilterCount(filters);

  const handleRemoveProject = useCallback(
    () => onFiltersChange(removeFilter(filters, 'filter_project_id')),
    [filters, onFiltersChange],
  );
  const handleRemoveTag = useCallback(
    () => onFiltersChange(removeFilter(filters, 'filter_tag_id')),
    [filters, onFiltersChange],
  );
  const handleRemoveCompleted = useCallback(
    () => onFiltersChange(removeFilter(filters, 'show_completed')),
    [filters, onFiltersChange],
  );
  const handleClearAll = useCallback(() => onFiltersChange({ show_completed: false }), [onFiltersChange]);

  const handleToggleShowCompleted = useCallback(() => {
    const next = { ...filters, show_completed: !filters.show_completed };
    onFiltersChange(next);
    announce(filters.show_completed ? 'Filter removed: Show completed.' : 'Filter applied: Show completed.');
    setFilterMenuOpen(false);
    setSubMenu(null);
  }, [filters, onFiltersChange]);

  const handleSelectProject = useCallback(
    (projectId: string, projectName: string) => {
      onFiltersChange({ ...filters, filter_project_id: projectId });
      announce(`Filter applied: Project ${projectName}.`);
      setFilterMenuOpen(false);
      setSubMenu(null);
    },
    [filters, onFiltersChange],
  );

  const handleSelectTag = useCallback(
    (tagId: string, tagName: string) => {
      onFiltersChange({ ...filters, filter_tag_id: tagId });
      announce(`Filter applied: Tag ${tagName}.`);
      setFilterMenuOpen(false);
      setSubMenu(null);
    },
    [filters, onFiltersChange],
  );

  const handleCloseMenu = useCallback(() => {
    setFilterMenuOpen(false);
    setSubMenu(null);
  }, []);

  // Close filter menu on outside click
  useEffect(() => {
    if (!filterMenuOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        handleCloseMenu();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [filterMenuOpen, handleCloseMenu]);

  const projectName = filters.filter_project_id
    ? (projectsById.get(filters.filter_project_id) ?? filters.filter_project_id)
    : undefined;
  const tagName = filters.filter_tag_id
    ? (tagsById.get(filters.filter_tag_id) ?? filters.filter_tag_id)
    : undefined;

  const projectEntries = Array.from(projectsById.entries());
  const tagEntries = Array.from(tagsById.entries());

  return (
    <div className={styles.filtersBar}>
      {/* Active chips */}
      {projectName && (
        <FilterChip facet="Project" value={projectName} onRemove={handleRemoveProject} tone="accent" />
      )}
      {tagName && <FilterChip facet="Tag" value={tagName} onRemove={handleRemoveTag} tone="accent" />}
      {filters.show_completed && (
        <FilterChip
          facet="Show"
          value="completed"
          label="Show completed"
          onRemove={handleRemoveCompleted}
          tone="accent"
        />
      )}

      {/* Clear all */}
      {chipCount >= 2 && (
        <button type="button" className={styles.clearAllBtn} onClick={handleClearAll}>
          Clear all
        </button>
      )}

      {/* + Filter trigger */}
      <div ref={filterMenuRef} className={styles.filterMenuWrapper}>
        <button
          type="button"
          className={styles.filterTrigger}
          aria-label="Filter"
          aria-expanded={filterMenuOpen}
          aria-haspopup="menu"
          onClick={() => {
            setFilterMenuOpen((o) => !o);
            setSubMenu(null);
          }}
        >
          <Filter size={14} aria-hidden="true" />
          Filter
        </button>

        {filterMenuOpen && (
          <menu
            className={styles.filterMenu}
            onKeyDown={(e) => {
              if (e.key === 'Escape') handleCloseMenu();
            }}
          >
            {subMenu === null && (
              <>
                <button
                  type="button"
                  role="menuitem"
                  className={styles.filterMenuItem}
                  onClick={() => setSubMenu('project')}
                >
                  <span className={styles.filterMenuCheck} aria-hidden="true" />
                  Filter by project…
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={styles.filterMenuItem}
                  onClick={() => setSubMenu('tag')}
                >
                  <span className={styles.filterMenuCheck} aria-hidden="true" />
                  Filter by tag…
                </button>
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={filters.show_completed}
                  className={styles.filterMenuItem}
                  onClick={handleToggleShowCompleted}
                >
                  <span className={styles.filterMenuCheck} aria-hidden="true">
                    {filters.show_completed ? '✓' : ''}
                  </span>
                  Show completed
                </button>
              </>
            )}

            {subMenu === 'project' && (
              <>
                <button
                  type="button"
                  className={styles.filterMenuBack}
                  onClick={() => setSubMenu(null)}
                  aria-label="Back to filter menu"
                >
                  ← Projects
                </button>
                {projectEntries.length === 0 && <div className={styles.filterMenuEmpty}>No projects</div>}
                {projectEntries.map(([id, name]) => (
                  <button
                    key={id}
                    type="button"
                    role="menuitem"
                    className={styles.filterMenuItem}
                    data-selected={filters.filter_project_id === id ? '' : undefined}
                    onClick={() => handleSelectProject(id, name)}
                  >
                    {name}
                  </button>
                ))}
              </>
            )}

            {subMenu === 'tag' && (
              <>
                <button
                  type="button"
                  className={styles.filterMenuBack}
                  onClick={() => setSubMenu(null)}
                  aria-label="Back to filter menu"
                >
                  ← Tags
                </button>
                {tagEntries.length === 0 && <div className={styles.filterMenuEmpty}>No tags</div>}
                {tagEntries.map(([id, name]) => (
                  <button
                    key={id}
                    type="button"
                    role="menuitem"
                    className={styles.filterMenuItem}
                    data-selected={filters.filter_tag_id === id ? '' : undefined}
                    onClick={() => handleSelectTag(id, name)}
                  >
                    {name}
                  </button>
                ))}
              </>
            )}
          </menu>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CalendarMonthView() {
  const today = todayLocal();

  // Month navigation state — stored locally; could be URL param (deferred polish)
  const initialMonth = toYearMonth(today);
  const [currentMonth, setCurrentMonth] = useState(initialMonth);

  // Filter state — URL search params
  const [filters, setFilters] = useState<CalendarFilters>(() => {
    if (typeof window === 'undefined') return { show_completed: false };
    return parseCalendarFilters(new URLSearchParams(window.location.search));
  });

  // Sync filter state to URL without full navigation
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = buildCalendarFilterParams(filters);
    const search = params.toString();
    const newUrl = `${window.location.pathname}${search ? `?${search}` : ''}`;
    window.history.replaceState(null, '', newUrl);
  }, [filters]);

  const { data: configData } = useConfig();
  const weekStart: 'sun' | 'mon' = configData?.week_start ?? 'sun';
  // TODO: week_start defaults to 'sun' until config loads. Settings view shows 'mon' as default per microcopy
  // but the config API may return either. Using 'sun' fallback documented as known deviation.

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

  // Build grid
  const gridDates = useMemo(() => buildMonthGrid(currentMonth, weekStart), [currentMonth, weekStart]);

  // Calendar items
  const { byDate, isLoading, items } = useCalendarItems(filters);

  // Day-detail popover
  const [detailDate, setDetailDate] = useState<LocalDate | null>(null);

  // Focused cell for keyboard nav
  const todayInGrid = gridDates.includes(today) ? today : null;
  const firstInMonth = gridDates.find((d) => toYearMonth(d) === currentMonth) ?? gridDates[0] ?? today;
  const [focusedDate, setFocusedDate] = useState<LocalDate>(() => todayInGrid ?? firstInMonth);

  // Ref to the grid container — we find cells by data-date attribute for programmatic focus
  const gridRef = useRef<HTMLDivElement>(null);

  // When month changes, update focused date
  useEffect(() => {
    const newGrid = buildMonthGrid(currentMonth, weekStart);
    const newFirst = newGrid.find((d) => toYearMonth(d) === currentMonth) ?? newGrid[0] ?? today;
    setFocusedDate((prev) => {
      if (toYearMonth(prev) === currentMonth) return prev;
      return newFirst;
    });
  }, [currentMonth, weekStart, today]);

  // Focus the focused cell when focusedDate changes
  useEffect(() => {
    if (!gridRef.current) return;
    const el = gridRef.current.querySelector<HTMLElement>(`[data-date="${focusedDate}"]`);
    if (el) el.focus({ preventScroll: false });
  }, [focusedDate]);

  // ─── Keyboard navigation ───────────────────────────────────────────────────

  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Don't intercept if focus is in a sub-element (chip, button, etc.)
      // The grid container catches events that bubble up from cells.
      const isCell = (e.target as HTMLElement).getAttribute('role') === 'gridcell';
      if (!isCell) return;

      switch (e.key) {
        case 'ArrowLeft': {
          e.preventDefault();
          const next = addDays(focusedDate, -1);
          if (toYearMonth(next) !== currentMonth) setCurrentMonth(toYearMonth(next));
          setFocusedDate(next);
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          const next = addDays(focusedDate, 1);
          if (toYearMonth(next) !== currentMonth) setCurrentMonth(toYearMonth(next));
          setFocusedDate(next);
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const next = addDays(focusedDate, -7);
          if (toYearMonth(next) !== currentMonth) setCurrentMonth(toYearMonth(next));
          setFocusedDate(next);
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          const next = addDays(focusedDate, 7);
          if (toYearMonth(next) !== currentMonth) setCurrentMonth(toYearMonth(next));
          setFocusedDate(next);
          break;
        }
        case 'PageUp': {
          e.preventDefault();
          if (e.shiftKey) {
            const next = addYears(focusedDate, -1);
            setCurrentMonth(toYearMonth(next));
            setFocusedDate(next);
          } else {
            const next = addMonths(focusedDate, -1);
            setCurrentMonth(toYearMonth(next));
            setFocusedDate(next);
          }
          break;
        }
        case 'PageDown': {
          e.preventDefault();
          if (e.shiftKey) {
            const next = addYears(focusedDate, 1);
            setCurrentMonth(toYearMonth(next));
            setFocusedDate(next);
          } else {
            const next = addMonths(focusedDate, 1);
            setCurrentMonth(toYearMonth(next));
            setFocusedDate(next);
          }
          break;
        }
        case 'Home': {
          e.preventDefault();
          setFocusedDate(startOfWeek(focusedDate, weekStart));
          break;
        }
        case 'End': {
          e.preventDefault();
          setFocusedDate(endOfWeek(focusedDate, weekStart));
          break;
        }
        case 'T':
        case 't': {
          e.preventDefault();
          if (toYearMonth(today) !== currentMonth) setCurrentMonth(toYearMonth(today));
          setFocusedDate(today);
          break;
        }
        case 'Enter': {
          e.preventDefault();
          setDetailDate(focusedDate);
          break;
        }
        case 'n':
        case 'N': {
          e.preventDefault();
          taskModal.openNew({ initialDueDate: focusedDate });
          break;
        }
      }
    },
    [focusedDate, currentMonth, weekStart, today, taskModal],
  );

  // ─── Delete/Move handlers ─────────────────────────────────────────────────

  const handleDeleteItem = useCallback(
    (item: Item) => {
      // Delegate to the delete mutation — for now open modal for confirmation
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

  // ─── Build per-cell items ─────────────────────────────────────────────────

  const cellItems = useMemo(() => {
    const result = new Map<LocalDate, CalendarDayCellItem[]>();
    for (const date of gridDates) {
      const dayItems = byDate.get(date) ?? [];
      result.set(
        date,
        dayItems.map((item) => {
          const dayPosition = computeDayPosition(item, date);
          const totalSpan = spanLength(item);
          const dayNum = spanDayOf(item, date);
          return { item, dayPosition, spanDays: totalSpan, spanDay: dayNum };
        }),
      );
    }
    return result;
  }, [gridDates, byDate]);

  // ─── Month header ─────────────────────────────────────────────────────────

  const [year, month] = currentMonth.split('-').map(Number);
  const monthName = MONTH_NAMES[(month ?? 1) - 1] ?? '';
  const headerLabel = `${monthName} ${year}`;

  const weekdayHeaders = weekStart === 'mon' ? WEEKDAY_SHORT_MON : WEEKDAY_SHORT_SUN;

  // ─── Empty state ──────────────────────────────────────────────────────────

  const hasItemsInGrid = gridDates.some((d) => (byDate.get(d) ?? []).length > 0);
  const hasFilters = activeFilterCount(filters) > 0;

  const isEmpty = !isLoading && !hasItemsInGrid;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={styles.root}>
      {/* Page title */}
      <h1 className={styles.pageTitle}>Calendar</h1>

      {/* Calendar chrome */}
      <div className={styles.chrome}>
        <div className={styles.chromeLeft}>
          {/* Month navigation */}
          <div className={styles.monthNav}>
            <IconButton
              icon={ChevronLeft}
              aria-label="Previous month"
              tooltip="Previous month"
              size="sm"
              onClick={() => {
                const prev = addMonths(firstDayOfMonth(currentMonth), -1);
                setCurrentMonth(toYearMonth(prev));
              }}
            />
            <button type="button" className={styles.monthLabel} aria-live="polite" aria-atomic="true">
              {headerLabel}
            </button>
            <IconButton
              icon={ChevronRight}
              aria-label="Next month"
              tooltip="Next month"
              size="sm"
              onClick={() => {
                const next = addMonths(firstDayOfMonth(currentMonth), 1);
                setCurrentMonth(toYearMonth(next));
              }}
            />
          </div>
        </div>

        <div className={styles.chromeRight}>
          {/* View toggle — Month active; Week links to /calendar/week (task-15) */}
          {/* biome-ignore lint/a11y/useSemanticElements: view toggle group uses div+aria-label per component pattern */}
          <div className={styles.viewToggle} role="group" aria-label="Calendar view">
            <button type="button" className={styles.viewToggleBtn} data-active="" aria-pressed="true">
              Month
            </button>
            <a href="/calendar/week" className={styles.viewToggleLink}>
              Week
            </a>
          </div>
        </div>
      </div>

      {/* Filter chips bar */}
      <CalendarFiltersBar
        filters={filters}
        onFiltersChange={setFilters}
        projectsById={projectsById}
        tagsById={tagsById}
      />

      {/* Empty state */}
      {isEmpty && !hasFilters && (
        <EmptyState
          icon={Calendar}
          headline="No events this month."
          subline="Press N to create one on the focused day."
        />
      )}

      {isEmpty && hasFilters && (
        <EmptyState
          icon={Calendar}
          headline="No matches."
          subline="Try removing a filter."
          action={{ label: 'Clear filters', onClick: () => setFilters({ show_completed: false }) }}
        />
      )}

      {/* Calendar grid */}
      {!isEmpty && (
        // biome-ignore lint/a11y/useSemanticElements: ARIA grid pattern uses div+role, replacing with table would break keyboard nav implementation
        <div
          role="grid"
          ref={gridRef}
          aria-label={`Calendar, ${headerLabel}`}
          className={styles.grid}
          onKeyDown={handleGridKeyDown}
        >
          {/* Weekday column headers */}
          {/* biome-ignore lint/a11y/useSemanticElements: ARIA grid uses div+role patterns, not table */}
          {/* biome-ignore lint/a11y/useFocusableInteractive: header row in ARIA grid is a navigation landmark, not interactive */}
          <div role="row" tabIndex={-1} className={styles.weekdayRow}>
            {weekdayHeaders.map((day) => (
              // biome-ignore lint/a11y/useSemanticElements: ARIA grid uses div+role patterns, not table
              <div key={day} role="columnheader" aria-label={day} className={styles.weekdayHeader}>
                {day}
              </div>
            ))}
          </div>

          {/* Day cells (6 rows × 7 cols) */}
          {Array.from({ length: 6 }, (_, rowIdx) => {
            const rowFirstDate = gridDates[rowIdx * 7];
            return (
              // biome-ignore lint/a11y/useSemanticElements: ARIA grid uses div+role patterns, not table
              // biome-ignore lint/a11y/useFocusableInteractive: row containers in ARIA grid are navigation landmarks, not interactive
              <div key={rowFirstDate} role="row" tabIndex={-1} className={styles.weekRow}>
                {gridDates.slice(rowIdx * 7, rowIdx * 7 + 7).map((date) => {
                  const inMonth = toYearMonth(date) === currentMonth;
                  const dayCellItems = cellItems.get(date) ?? [];
                  const isFocused = date === focusedDate;
                  return (
                    <CalendarDayCell
                      key={date}
                      date={date}
                      today={today}
                      items={dayCellItems}
                      inMonth={inMonth}
                      isFocused={isFocused}
                      isDetailOpen={detailDate === date}
                      onOpenDayDetail={setDetailDate}
                      onNewTask={(d) => taskModal.openNew({ initialDueDate: d })}
                      onDeleteItem={handleDeleteItem}
                      onMoveItem={handleMoveItem}
                      tabIndex={isFocused ? 0 : -1}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Day-detail popover */}
      {detailDate && (
        <DayDetailPopover
          date={detailDate}
          items={byDate.get(detailDate) ?? []}
          onClose={() => setDetailDate(null)}
        />
      )}
    </div>
  );
}

export default CalendarMonthView;
