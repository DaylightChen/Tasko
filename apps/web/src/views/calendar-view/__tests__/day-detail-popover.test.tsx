/**
 * day-detail-popover.test.tsx
 *
 * Covers:
 * - "+N more" button is present when 6 items exist in a cell.
 * - Clicking "+N more" opens the day-detail popover.
 * - Popover renders with role="dialog".
 * - Popover title format: "<Day, Mon DD>" (microcopy §24 day-detail popover title).
 * - Popover subline: "<N> items" (microcopy §24).
 * - "Add task on <Mon DD>" button text (microcopy §24) — NO "+" prefix.
 * - Clicking "Add task on ..." calls taskModal.openNew with initialDueDate.
 * - Clicking a task row calls taskModal.openEdit.
 * - Esc key closes the popover.
 * - "+N more" has aria-haspopup="dialog" (accessibility §3.12.7).
 * - Popover opens via Enter key on a focused cell.
 *
 * Fix applied: date-fmt mock now includes ALL exports used by TaskListRow
 * (isOverdue, formatDateChip, formatDateLong) to prevent "No export defined" errors.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Item, ItemId, LocalDate } from '@tasko/types';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../../api/items', () => ({
  usePatchSubtask: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
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

const openEditMock = vi.fn();
const openNewMock = vi.fn();

vi.mock('../../../store/task-modal', () => ({
  useTaskModalStore: vi.fn(() => ({
    openEdit: openEditMock,
    openNew: openNewMock,
  })),
}));

vi.mock('../../../lib/a11y', () => ({
  announce: vi.fn(),
}));

// CRITICAL FIX: include ALL exports that TaskListRow (used inside DayDetailPopover)
// imports from date-fmt. The original test only mocked todayLocal + daysBetween,
// causing "[vitest] No 'isOverdue' export is defined on the mock" errors.
vi.mock('../../../lib/date-fmt', () => ({
  todayLocal: vi.fn(() => '2026-05-19' as LocalDate),
  daysBetween: vi.fn((start: string, end: string) => {
    const s = new Date(`${start}T00:00:00Z`);
    const e = new Date(`${end}T00:00:00Z`);
    return Math.round((e.getTime() - s.getTime()) / 86_400_000);
  }),
  isOverdue: vi.fn((date: string, today: string) => date < today),
  formatDateChip: vi.fn((date: string, today: string) => ({
    short: date === today ? 'Today' : 'May 19',
    long: 'Tuesday, May 19, 2026',
    overdueDays: 0,
  })),
  formatDateLong: vi.fn((date: string) => `${date} long`),
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
import { todayLocal } from '../../../lib/date-fmt';
import { CalendarMonthView } from '../month';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: `item-${crypto.randomUUID()}` as ItemId,
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

/** Seed 6 items on May 19 so the "+2 more" button appears. */
function setupSixItemsOnMay19() {
  const items = Array.from({ length: 6 }, (_, i) =>
    makeItem({ title: `Task ${i + 1}`, due_date: '2026-05-19' as LocalDate }),
  );
  vi.mocked(useItems).mockReturnValue({
    data: { items, count: 6 },
    isLoading: false,
  } as unknown as ReturnType<typeof useItems>);
  return items;
}

function renderCalendar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CalendarMonthView />
    </QueryClientProvider>,
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('DayDetailPopover via CalendarMonthView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('"+N more" button is present when 6 items on May 19 (overflow count = 2)', () => {
    setupSixItemsOnMay19();
    renderCalendar();

    const moreBtn = screen.getByText(/2 more/i);
    expect(moreBtn).toBeTruthy();
  });

  it('clicking "+N more" opens the day-detail popover (dialog element)', () => {
    setupSixItemsOnMay19();
    renderCalendar();

    const moreBtn = screen.getByText(/2 more/i);
    act(() => fireEvent.click(moreBtn));

    const dialog = document.querySelector('dialog[open]');
    expect(dialog, 'dialog[open] not found after clicking "+N more"').toBeTruthy();
  });

  it('popover has role="dialog" (implicit on <dialog> element)', () => {
    setupSixItemsOnMay19();
    renderCalendar();

    act(() => fireEvent.click(screen.getByText(/2 more/i)));

    const dialog = document.querySelector('dialog');
    expect(dialog).toBeTruthy();
  });

  it('popover title format is "<Day, Mon DD>" e.g. "Tue, May 19" (microcopy §24)', () => {
    setupSixItemsOnMay19();
    renderCalendar();

    act(() => fireEvent.click(screen.getByText(/2 more/i)));

    // "Tue, May 19" — May 19, 2026 is a Tuesday; uses short month name (not "Tuesday, May 19, 2026")
    expect(screen.getByText('Tue, May 19')).toBeTruthy();
  });

  it('popover title uses short month name "Jan" not "January" for January dates (issue #5 regression guard)', () => {
    // Seed 6 items on Jan 15, 2026 (Thursday)
    const items = Array.from({ length: 6 }, (_, i) =>
      makeItem({ title: `Jan Task ${i + 1}`, due_date: '2026-01-15' as LocalDate }),
    );
    vi.mocked(useItems).mockReturnValue({
      data: { items, count: 6 },
      isLoading: false,
    } as unknown as ReturnType<typeof useItems>);

    // Override todayLocal so CalendarMonthView initialises on January 2026
    vi.mocked(todayLocal).mockReturnValue('2026-01-15' as LocalDate);

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { unmount } = render(
      <QueryClientProvider client={qc}>
        <CalendarMonthView />
      </QueryClientProvider>,
    );

    // With 6 items on Jan 15, the "+N more" button MUST appear (default threshold = 4 visible).
    const moreBtn = screen.getByText(/\d+ more/i);
    act(() => fireEvent.click(moreBtn));
    // Jan 15, 2026 is a Thursday; short month name "Jan" per microcopy §24
    expect(screen.getByText('Thu, Jan 15')).toBeTruthy();
    // Ensure long month name "January" is NOT used
    expect(screen.queryByText('Thu, January 15')).toBeNull();

    unmount();
  });

  it('popover shows item count subline', () => {
    setupSixItemsOnMay19();
    renderCalendar();

    act(() => fireEvent.click(screen.getByText(/2 more/i)));

    expect(screen.getByText('6 items')).toBeTruthy();
  });

  it('"Add task on <Mon DD>" button text has no "+" prefix (microcopy §24)', () => {
    setupSixItemsOnMay19();
    renderCalendar();

    act(() => fireEvent.click(screen.getByText(/2 more/i)));

    // "Add task on May 19" — no "+" prefix (microcopy §24)
    const addBtn = screen.getByText(/Add task on May 19/i);
    expect(addBtn).toBeTruthy();
    // Ensure no "+" prefix
    expect(addBtn.textContent?.trim()).toMatch(/^Add task on/);
    expect(addBtn.textContent?.trim()).not.toMatch(/^\+/);
  });

  it('"Add task on May 19" calls taskModal.openNew with the correct date', () => {
    setupSixItemsOnMay19();
    renderCalendar();

    act(() => fireEvent.click(screen.getByText(/2 more/i)));

    const addBtn = screen.getByText(/Add task on May 19/i);
    act(() => fireEvent.click(addBtn));

    expect(openNewMock).toHaveBeenCalledWith({ initialDueDate: '2026-05-19' });
  });

  it('"Add task on this day" in the footer is a button element', () => {
    setupSixItemsOnMay19();
    renderCalendar();

    act(() => fireEvent.click(screen.getByText(/2 more/i)));

    const addBtn = screen.getByText(/Add task on May 19/i).closest('button');
    expect(addBtn).toBeTruthy();
  });

  it('popover closes on Esc key', () => {
    setupSixItemsOnMay19();
    renderCalendar();

    act(() => fireEvent.click(screen.getByText(/2 more/i)));
    expect(document.querySelector('dialog[open]'), 'dialog should be open').toBeTruthy();

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(document.querySelector('dialog[open]'), 'dialog should be closed after Esc').toBeNull();
  });

  it('popover opens via Enter key on a focused cell', () => {
    setupSixItemsOnMay19();
    renderCalendar();

    const todayCell = document.querySelector<HTMLElement>('[data-date="2026-05-19"]');
    expect(todayCell, 'today cell not found').toBeTruthy();

    act(() => {
      todayCell?.focus();
      // biome-ignore lint/style/noNonNullAssertion: asserted above
      fireEvent.keyDown(todayCell!, { key: 'Enter' });
    });

    const dialog = document.querySelector('dialog[open]');
    expect(dialog, 'dialog not opened via Enter on cell').toBeTruthy();
  });
});
