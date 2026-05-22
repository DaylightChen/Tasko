/**
 * month-view.test.tsx
 *
 * Covers:
 * - Renders today's cell with the accent-filled circle (data-today attr).
 * - Multi-day item spanning 5 days renders 5 chips with correct day labels.
 * - "+N more" overflow button appears when a cell has > MAX_VISIBLE_CHIPS items.
 * - Items render on their due_date.
 * - Page title is "Calendar" (microcopy §24).
 * - Month/year header format: "<Month> <Year>" e.g. "May 2026" (microcopy §24).
 * - Grid has role="grid" with aria-label "Calendar, May 2026" (accessibility §3.8).
 * - Weekday column headers use role="columnheader".
 * - Day cell has role="gridcell" (accessibility §3.8).
 * - Today's gridcell aria-label includes "today" and full date.
 * - Event chip aria-label matches "Event: <title>, ..., priority <level>".
 * - Event chip is a <button type="button">.
 * - Multi-day data-day-position attributes on start/middle/end chips.
 * - Prior-month cells rendered with/without data-in-month.
 * - "+N more" aria-haspopup="dialog" (accessibility §3.12.7).
 * - "does NOT show +N more" when exactly 4 items.
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

vi.mock('../../../store/task-modal', () => ({
  useTaskModalStore: vi.fn(() => ({
    openEdit: vi.fn(),
    openNew: vi.fn(),
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

function setupItemsMock(items: Item[]) {
  vi.mocked(useItems).mockReturnValue({
    data: { items, count: items.length },
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

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CalendarMonthView — page chrome (microcopy §24)', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('page title is "Calendar" (microcopy §24)', () => {
    setupItemsMock([makeItem()]);
    renderCalendar();
    expect(screen.getByRole('heading', { level: 1, name: 'Calendar' })).toBeTruthy();
  });

  it('month/year header format is "<Month> <Year>" e.g. "May 2026" (microcopy §24)', () => {
    setupItemsMock([makeItem()]);
    renderCalendar();
    expect(screen.getByText('May 2026')).toBeTruthy();
  });

  it('month view toggle button is labeled "Month" (microcopy §24)', () => {
    setupItemsMock([makeItem()]);
    renderCalendar();
    expect(screen.getByRole('button', { name: 'Month' })).toBeTruthy();
  });

  it('week view link is labeled "Week" (microcopy §24)', () => {
    setupItemsMock([makeItem()]);
    renderCalendar();
    const weekLink = document.querySelector('a[href="/calendar/week"]');
    expect(weekLink).toBeTruthy();
    expect(weekLink?.textContent?.trim()).toBe('Week');
  });
});

describe('CalendarMonthView — ARIA grid structure (accessibility §3.8)', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('grid has role="grid" with aria-label "Calendar, May 2026"', () => {
    setupItemsMock([makeItem()]);
    renderCalendar();
    const grid = document.querySelector('[role="grid"]');
    expect(grid).toBeTruthy();
    expect(grid?.getAttribute('aria-label')).toBe('Calendar, May 2026');
  });

  it('weekday headers have role="columnheader"', () => {
    setupItemsMock([makeItem()]);
    renderCalendar();
    const headers = document.querySelectorAll('[role="columnheader"]');
    expect(headers.length).toBe(7);
  });

  it('day cells have role="gridcell"', () => {
    setupItemsMock([makeItem()]);
    renderCalendar();
    const cells = document.querySelectorAll('[role="gridcell"]');
    expect(cells.length).toBe(42); // 6 rows × 7 cols
  });

  it('today\'s gridcell aria-label includes "today"', () => {
    setupItemsMock([makeItem()]);
    renderCalendar();
    const todayCell = document.querySelector('[data-date="2026-05-19"]');
    expect(todayCell).toBeTruthy();
    const label = todayCell?.getAttribute('aria-label') ?? '';
    expect(label).toMatch(/today/i);
  });

  it('today\'s gridcell aria-label includes full date "Tuesday, May 19, 2026"', () => {
    setupItemsMock([makeItem()]);
    renderCalendar();
    const todayCell = document.querySelector('[data-date="2026-05-19"]');
    const label = todayCell?.getAttribute('aria-label') ?? '';
    expect(label).toMatch(/Tuesday/i);
    expect(label).toMatch(/May 19, 2026/);
  });
});

describe('CalendarMonthView — today cell treatment', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("today's cell has data-today attribute (needs at least 1 item to render grid)", () => {
    // Must seed at least 1 item so the grid renders (not empty state)
    setupItemsMock([makeItem({ due_date: '2026-05-19' as LocalDate })]);
    renderCalendar();

    const todayCell = document.querySelector('[data-date="2026-05-19"]');
    expect(todayCell).toBeTruthy();
    expect(todayCell?.hasAttribute('data-today')).toBe(true);
  });

  it("today's day number span has data-today attribute", () => {
    setupItemsMock([makeItem({ due_date: '2026-05-19' as LocalDate })]);
    renderCalendar();

    const todayNumbers = document.querySelectorAll('[data-today]');
    expect(todayNumbers.length).toBeGreaterThan(0);
  });

  it('non-today cell does NOT have data-today attribute', () => {
    setupItemsMock([makeItem({ due_date: '2026-05-20' as LocalDate })]);
    renderCalendar();

    const nonTodayCell = document.querySelector('[data-date="2026-05-20"]');
    expect(nonTodayCell).toBeTruthy();
    expect(nonTodayCell?.hasAttribute('data-today')).toBe(false);
  });
});

describe('CalendarMonthView — month rendering', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('renders an item on its due_date cell', () => {
    const item = makeItem({ title: 'May 19 Task', due_date: '2026-05-19' as LocalDate });
    setupItemsMock([item]);
    renderCalendar();

    expect(screen.getAllByText('May 19 Task').length).toBeGreaterThan(0);
  });

  it('multi-day item (May 18-22) renders chips on all 5 days', () => {
    const item = makeItem({
      title: 'Multi Day',
      due_date: '2026-05-22' as LocalDate,
      start_date: '2026-05-18' as LocalDate,
    });
    setupItemsMock([item]);
    renderCalendar();

    // Title chips should appear on start and end days
    const chips = screen.getAllByText('Multi Day');
    // start + end cells show the title; middle cells show continuation bar only
    expect(chips.length).toBeGreaterThanOrEqual(2);
  });

  it('multi-day item shows "Day 1 of 5" on the start cell', () => {
    const item = makeItem({
      title: 'Span Task',
      due_date: '2026-05-22' as LocalDate,
      start_date: '2026-05-18' as LocalDate,
    });
    setupItemsMock([item]);
    renderCalendar();

    expect(screen.getAllByText(/Day 1 of 5/).length).toBeGreaterThan(0);
  });

  it('multi-day item shows "Day 5 of 5" on the end cell', () => {
    const item = makeItem({
      title: 'Span Task',
      due_date: '2026-05-22' as LocalDate,
      start_date: '2026-05-18' as LocalDate,
    });
    setupItemsMock([item]);
    renderCalendar();

    expect(screen.getAllByText(/Day 5 of 5/).length).toBeGreaterThan(0);
  });

  it('shows "+N more" button when a cell has more than 4 items', () => {
    // Put 6 items all on May 19
    const items = Array.from({ length: 6 }, (_, i) =>
      makeItem({ title: `Task ${i + 1}`, due_date: '2026-05-19' as LocalDate }),
    );
    setupItemsMock(items);
    renderCalendar();

    // Should show "+2 more" (6 items - 4 visible)
    expect(screen.getByText(/2 more/i)).toBeTruthy();
  });
});

describe('CalendarMonthView — multi-day data-day-position', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('multi-day item (May 18-22) produces chips on all 5 days', () => {
    const item = makeItem({
      title: 'Sprint Planning',
      start_date: '2026-05-18' as LocalDate,
      due_date: '2026-05-22' as LocalDate,
    });
    setupItemsMock([item]);
    renderCalendar();

    const chips = document.querySelectorAll(`[data-item-id="${item.id}"]`);
    expect(chips.length).toBe(5);
  });

  it('start cell (May 18) has data-day-position="start"', () => {
    const item = makeItem({
      start_date: '2026-05-18' as LocalDate,
      due_date: '2026-05-22' as LocalDate,
    });
    setupItemsMock([item]);
    renderCalendar();

    const startCell = document.querySelector('[data-date="2026-05-18"]');
    const startChip = startCell?.querySelector(`[data-item-id="${item.id}"]`);
    expect(startChip).toBeTruthy();
    expect(startChip?.getAttribute('data-day-position')).toBe('start');
  });

  it('end cell (May 22) has data-day-position="end"', () => {
    const item = makeItem({
      start_date: '2026-05-18' as LocalDate,
      due_date: '2026-05-22' as LocalDate,
    });
    setupItemsMock([item]);
    renderCalendar();

    const endCell = document.querySelector('[data-date="2026-05-22"]');
    const endChip = endCell?.querySelector(`[data-item-id="${item.id}"]`);
    expect(endChip).toBeTruthy();
    expect(endChip?.getAttribute('data-day-position')).toBe('end');
  });

  it('middle cells (May 19-21) have data-day-position="middle"', () => {
    const item = makeItem({
      start_date: '2026-05-18' as LocalDate,
      due_date: '2026-05-22' as LocalDate,
    });
    setupItemsMock([item]);
    renderCalendar();

    for (const date of ['2026-05-19', '2026-05-20', '2026-05-21']) {
      const cell = document.querySelector(`[data-date="${date}"]`);
      const chip = cell?.querySelector(`[data-item-id="${item.id}"]`);
      expect(chip, `Middle chip on ${date}`).toBeTruthy();
      expect(chip?.getAttribute('data-day-position'), `data-day-position on ${date}`).toBe('middle');
    }
  });
});

describe('CalendarMonthView — event chip ARIA (accessibility §3.8)', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('event chip aria-label matches "Event: <title>, ..., priority <level>"', () => {
    setupItemsMock([
      makeItem({ title: 'Write tests', due_date: '2026-05-19' as LocalDate, priority: 'high' }),
    ]);
    renderCalendar();

    const chip = document.querySelector('[data-item-id]');
    expect(chip).toBeTruthy();
    const label = chip?.getAttribute('aria-label') ?? '';
    expect(label).toMatch(/^Event: Write tests/);
    expect(label).toMatch(/priority high/);
  });

  it('event chip is a <button> element (not div)', () => {
    setupItemsMock([makeItem({ due_date: '2026-05-19' as LocalDate })]);
    renderCalendar();
    const chip = document.querySelector('[data-item-id]');
    expect(chip?.tagName.toLowerCase()).toBe('button');
  });

  it('event chip has type="button"', () => {
    setupItemsMock([makeItem({ due_date: '2026-05-19' as LocalDate })]);
    renderCalendar();
    const chip = document.querySelector('[data-item-id]');
    expect(chip?.getAttribute('type')).toBe('button');
  });
});

describe('CalendarMonthView — "+N more" overflow button', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('does NOT show "+N more" when exactly 4 items in a cell', () => {
    const items = [1, 2, 3, 4].map((i) =>
      makeItem({ title: `Task ${i}`, due_date: '2026-05-19' as LocalDate }),
    );
    setupItemsMock(items);
    renderCalendar();

    const moreBtn = document.querySelector('[aria-haspopup="dialog"]');
    expect(moreBtn).toBeNull();
  });

  it('shows "+2 more" when 6 items in a cell (6 - 4 = 2 overflow)', () => {
    const items = [1, 2, 3, 4, 5, 6].map((i) =>
      makeItem({ title: `Task ${i}`, due_date: '2026-05-19' as LocalDate }),
    );
    setupItemsMock(items);
    renderCalendar();

    const moreText = screen.getByText(/2 more/i);
    expect(moreText).toBeTruthy();
  });

  it('"+N more" button has aria-haspopup="dialog" (accessibility §3.12.7)', () => {
    const items = [1, 2, 3, 4, 5].map((i) =>
      makeItem({ title: `Task ${i}`, due_date: '2026-05-19' as LocalDate }),
    );
    setupItemsMock(items);
    renderCalendar();

    const moreBtn = document.querySelector('[aria-haspopup="dialog"]');
    expect(moreBtn).toBeTruthy();
    expect(moreBtn?.getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('"+N more" button has aria-expanded="false" before popover opens (accessibility §3.12.7)', () => {
    const items = [1, 2, 3, 4, 5].map((i) =>
      makeItem({ title: `Task ${i}`, due_date: '2026-05-19' as LocalDate }),
    );
    setupItemsMock(items);
    renderCalendar();

    const moreBtn = document.querySelector('[aria-haspopup="dialog"]');
    expect(moreBtn?.getAttribute('aria-expanded')).toBe('false');
  });

  it('"+N more" button has aria-expanded="true" after popover opens (accessibility §3.12.7)', () => {
    const items = [1, 2, 3, 4, 5].map((i) =>
      makeItem({ title: `Task ${i}`, due_date: '2026-05-19' as LocalDate }),
    );
    setupItemsMock(items);
    renderCalendar();

    const moreBtn = document.querySelector('[aria-haspopup="dialog"]');
    expect(moreBtn).toBeTruthy();
    act(() => {
      // biome-ignore lint/style/noNonNullAssertion: asserted above
      fireEvent.click(moreBtn!);
    });
    // Re-query since state changed and React re-rendered
    const moreBtnAfter = document.querySelector('[aria-haspopup="dialog"]');
    expect(moreBtnAfter?.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('CalendarMonthView — prior-month cells', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('prior-month cells lack data-in-month attribute', () => {
    setupItemsMock([makeItem()]);
    renderCalendar();

    // With week_start='sun' and May 2026, the grid starts at April 26
    const priorCell = document.querySelector('[data-date="2026-04-26"]');
    expect(priorCell).toBeTruthy();
    expect(priorCell?.hasAttribute('data-in-month')).toBe(false);
  });

  it('current-month cells have data-in-month attribute', () => {
    setupItemsMock([makeItem()]);
    renderCalendar();

    const mayCell = document.querySelector('[data-date="2026-05-01"]');
    expect(mayCell).toBeTruthy();
    expect(mayCell?.hasAttribute('data-in-month')).toBe(true);
  });
});
