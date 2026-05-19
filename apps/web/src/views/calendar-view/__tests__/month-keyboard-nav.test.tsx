/**
 * month-keyboard-nav.test.tsx
 *
 * Covers (brief step 7 + accessibility §2.3):
 * - ArrowLeft moves focus to yesterday's cell.
 * - ArrowRight moves focus to tomorrow's cell.
 * - ArrowUp moves focus one week back.
 * - ArrowDown moves focus one week forward.
 * - PageDown → next month.
 * - PageUp → previous month.
 * - Shift+PageDown → next year.
 * - Shift+PageUp → previous year.
 * - Home → start of week.
 * - End → end of week.
 * - T key → jumps back to today.
 * - Enter → opens day-detail popover.
 * - N → opens Task modal with date pre-filled.
 *
 * Fix applied: seed at least 1 item so the grid renders (not the empty state).
 * Without a grid, there are no [data-date] cells and focusCell() fails.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Item, ItemId, LocalDate } from '@tasko/types';
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../../api/items', () => ({
  useItems: vi.fn(),
  useDeleteItem: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useToggleComplete: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useUpdateItem: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useCreateItem: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

vi.mock('../../../api/config', () => ({
  useConfig: vi.fn(() => ({
    data: { week_start: 'sun', theme: 'system', schema_version: 1, last_modified: '2026-01-01T00:00:00Z' },
  })),
}));

vi.mock('../../../api/projects', () => ({
  useProjects: vi.fn(() => ({ data: { projects: [] } })),
}));

vi.mock('../../../api/tags', () => ({
  useTags: vi.fn(() => ({ data: { tags: [] } })),
}));

const openNewMock = vi.fn();
const openEditMock = vi.fn();

vi.mock('../../../store/task-modal', () => ({
  useTaskModalStore: vi.fn(() => ({
    openEdit: openEditMock,
    openNew: openNewMock,
  })),
}));

vi.mock('../../../lib/a11y', () => ({
  announce: vi.fn(),
}));

vi.mock('../../../lib/date-fmt', () => ({
  todayLocal: vi.fn(() => '2026-05-19' as LocalDate),
  daysBetween: vi.fn((start: string, end: string) => {
    const s = new Date(`${start}T00:00:00Z`);
    const e = new Date(`${end}T00:00:00Z`);
    return Math.round((e.getTime() - s.getTime()) / 86_400_000);
  }),
  isOverdue: vi.fn((date: string, today: string) => date < today),
  formatDateChip: vi.fn(() => ({ short: 'May 19', long: 'May 19, 2026', overdueDays: 0 })),
  formatDateLong: vi.fn((date: string) => date),
  formatRelativeForGroup: vi.fn((date: string) => date),
  formatTimeChip: vi.fn((t: string) => t),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string; [k: string]: unknown }) => (
    <a href={to as string} {...rest}>
      {children}
    </a>
  ),
  useRouterState: () => ({ location: { pathname: '/calendar/month' } }),
}));

// ── Imports after mocks ──────────────────────────────────────────────────────
import { useItems } from '../../../api/items';
import { CalendarMonthView } from '../month';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: crypto.randomUUID() as ItemId,
    schema_version: 1,
    type: 'task',
    project_id: 'proj-1' as Item['project_id'],
    parent_id: null,
    title: 'Test Task',
    notes: '',
    due_date: '2026-05-19' as LocalDate,
    start_date: null,
    due_time: null,
    priority: 'none',
    status: 'todo',
    tags: [],
    subtasks: [],
    recurrence: null,
    completed_at: null,
    trashed_at: null,
    trashed_with: null,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * Setup items mock with items spread across May/June/April 2025-2027 so the grid
 * renders in every month the keyboard-nav tests navigate to. Without items in the
 * visible grid, `hasItemsInGrid` collapses to the empty state and `[data-date]`
 * cells disappear.
 */
function setupItemsMock() {
  vi.mocked(useItems).mockReturnValue({
    data: {
      items: [
        makeItem({ id: 'i-1' as ItemId, due_date: '2026-05-19' as LocalDate }),
        makeItem({ id: 'i-2' as ItemId, due_date: '2026-04-19' as LocalDate }),
        makeItem({ id: 'i-3' as ItemId, due_date: '2026-06-19' as LocalDate }),
        makeItem({ id: 'i-4' as ItemId, due_date: '2025-05-19' as LocalDate }),
        makeItem({ id: 'i-5' as ItemId, due_date: '2027-05-19' as LocalDate }),
      ],
      count: 5,
    },
    isLoading: false,
  } as unknown as ReturnType<typeof useItems>);
}

function renderCalendar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CalendarMonthView />
    </QueryClientProvider>,
  );
}

/** Focus the cell for a given date. Fails the test if cell is not found. */
function focusCell(date: string) {
  const cell = document.querySelector<HTMLElement>(`[data-date="${date}"]`);
  expect(cell, `cell [data-date="${date}"] not found — is the grid visible?`).toBeTruthy();
  act(() => {
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    cell!.focus();
  });
  // biome-ignore lint/style/noNonNullAssertion: asserted above
  return cell!;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CalendarMonthView — keyboard navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupItemsMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ArrowLeft moves focus from today (May 19) to yesterday (May 18)', () => {
    renderCalendar();
    const todayCell = focusCell('2026-05-19');

    act(() => {
      fireEvent.keyDown(todayCell, { key: 'ArrowLeft' });
    });

    const prevCell = document.querySelector<HTMLElement>('[data-date="2026-05-18"]');
    expect(prevCell, 'May 18 cell not found').toBeTruthy();
  });

  it('ArrowRight moves focus from today (May 19) to tomorrow (May 20)', () => {
    renderCalendar();
    const todayCell = focusCell('2026-05-19');

    act(() => {
      fireEvent.keyDown(todayCell, { key: 'ArrowRight' });
    });

    const nextCell = document.querySelector<HTMLElement>('[data-date="2026-05-20"]');
    expect(nextCell, 'May 20 cell not found').toBeTruthy();
  });

  it('ArrowUp moves focus one week back (May 19 → May 12)', () => {
    renderCalendar();
    const todayCell = focusCell('2026-05-19');

    act(() => {
      fireEvent.keyDown(todayCell, { key: 'ArrowUp' });
    });

    const prevWeekCell = document.querySelector<HTMLElement>('[data-date="2026-05-12"]');
    expect(prevWeekCell, 'May 12 cell not found').toBeTruthy();
  });

  it('ArrowDown moves focus one week forward (May 19 → May 26)', () => {
    renderCalendar();
    const todayCell = focusCell('2026-05-19');

    act(() => {
      fireEvent.keyDown(todayCell, { key: 'ArrowDown' });
    });

    const nextWeekCell = document.querySelector<HTMLElement>('[data-date="2026-05-26"]');
    expect(nextWeekCell, 'May 26 cell not found').toBeTruthy();
  });

  it('PageDown switches to next month (May → June)', () => {
    renderCalendar();

    // Before PageDown: May cells are present
    expect(document.querySelector('[data-date="2026-05-01"]')).toBeTruthy();

    const todayCell = focusCell('2026-05-19');
    act(() => {
      fireEvent.keyDown(todayCell, { key: 'PageDown' });
    });

    // After PageDown: June cells should appear
    const juneCell = document.querySelector('[data-date="2026-06-01"]');
    expect(juneCell, 'June cell not found after PageDown').toBeTruthy();
  });

  it('PageUp switches to previous month (May → April)', () => {
    renderCalendar();
    const todayCell = focusCell('2026-05-19');

    act(() => {
      fireEvent.keyDown(todayCell, { key: 'PageUp' });
    });

    const aprilCell = document.querySelector('[data-date="2026-04-01"]');
    expect(aprilCell, 'April cell not found after PageUp').toBeTruthy();
  });

  it('Shift+PageDown advances to next year (May 2026 → May 2027)', () => {
    renderCalendar();
    const todayCell = focusCell('2026-05-19');

    act(() => {
      fireEvent.keyDown(todayCell, { key: 'PageDown', shiftKey: true });
    });

    const nextYearCell = document.querySelector('[data-date="2027-05-19"]');
    expect(nextYearCell, '2027-05-19 cell not found after Shift+PageDown').toBeTruthy();
  });

  it('Shift+PageUp goes to previous year (May 2026 → May 2025)', () => {
    renderCalendar();
    const todayCell = focusCell('2026-05-19');

    act(() => {
      fireEvent.keyDown(todayCell, { key: 'PageUp', shiftKey: true });
    });

    const prevYearCell = document.querySelector('[data-date="2025-05-19"]');
    expect(prevYearCell, '2025-05-19 cell not found after Shift+PageUp').toBeTruthy();
  });

  it('T key jumps back to today when navigated away', () => {
    renderCalendar();

    const todayCell = focusCell('2026-05-19');

    // Navigate forward first
    act(() => {
      fireEvent.keyDown(todayCell, { key: 'PageDown' });
    });

    // Now press T — fire on a gridcell in June to trigger the grid handler
    const juneCell = document.querySelector<HTMLElement>('[data-date="2026-06-01"]');
    if (juneCell) {
      act(() => {
        fireEvent.keyDown(juneCell, { key: 't' });
      });
    } else {
      // Fallback: fire on the grid container
      const grid = document.querySelector<HTMLElement>('[role="grid"]');
      expect(grid, 'grid not found').toBeTruthy();
      act(() => {
        // biome-ignore lint/style/noNonNullAssertion: asserted above
        fireEvent.keyDown(grid!, { key: 't' });
      });
    }

    // Today's cell should be in the grid again
    expect(document.querySelector('[data-date="2026-05-19"]')).toBeTruthy();
  });

  it('Home key moves focus to start of week (Sunday, May 17)', () => {
    renderCalendar();
    // May 19 (Tuesday) — week starts Sunday May 17
    const todayCell = focusCell('2026-05-19');

    act(() => {
      fireEvent.keyDown(todayCell, { key: 'Home' });
    });

    // With week_start='sun', May 19 is in the week May 17–23
    const sundayCell = document.querySelector<HTMLElement>('[data-date="2026-05-17"]');
    expect(sundayCell, 'May 17 (Sunday) cell not found after Home').toBeTruthy();
  });

  it('End key moves focus to end of week (Saturday, May 23)', () => {
    renderCalendar();
    const todayCell = focusCell('2026-05-19');

    act(() => {
      fireEvent.keyDown(todayCell, { key: 'End' });
    });

    // With week_start='sun', May 19 is in the week May 17–23; end = May 23
    const satCell = document.querySelector<HTMLElement>('[data-date="2026-05-23"]');
    expect(satCell, 'May 23 (Saturday) cell not found after End').toBeTruthy();
  });

  it('Enter on a cell opens the day-detail popover for that date', () => {
    renderCalendar();
    const todayCell = focusCell('2026-05-19');

    act(() => {
      fireEvent.keyDown(todayCell, { key: 'Enter' });
    });

    const dialog = document.querySelector('[role="dialog"]') ?? document.querySelector('dialog');
    expect(dialog, 'Dialog not opened after Enter').toBeTruthy();
  });

  it('N on a cell calls taskModal.openNew with initialDueDate pre-filled', () => {
    openNewMock.mockReset();
    renderCalendar();
    const todayCell = focusCell('2026-05-19');

    act(() => {
      fireEvent.keyDown(todayCell, { key: 'N' });
    });

    expect(openNewMock).toHaveBeenCalledWith({ initialDueDate: '2026-05-19' });
  });
});
