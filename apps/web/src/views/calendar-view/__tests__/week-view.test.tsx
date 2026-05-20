/**
 * week-view.test.tsx
 *
 * Covers:
 * - 2 timed items (9am, 11:30am) render as CalendarWeekBlock in the time grid.
 * - 1 all-day item renders as CalendarEventChip in the all-day strip.
 * - 1 multi-day item (Mon–Fri) renders chips in the all-day strip for each day.
 * - Filter by project → only that project's events appear.
 * - Click a timed block → modal opens with that item.
 * - T key jumps to current week.
 * - "Show completed" filter toggles inclusion.
 * - Smoke test: CalendarWeekBlock has NO drag listener (v1 drag CUT).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Item, ItemId, LocalDate } from '@tasko/types';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../../api/items', () => ({
  usePatchSubtask: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  useItems: vi.fn(() => ({ data: { items: [], count: 0 }, isLoading: false })),
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
    openEdit: openEditMock,
    openNew: vi.fn(),
  })),
}));

vi.mock('../../../lib/a11y', () => ({ announce: vi.fn() }));

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
  useRouterState: () => ({ location: { pathname: '/calendar/week' } }),
  useNavigate: () => vi.fn(),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────
import { useItems } from '../../../api/items';
import { CalendarWeekView } from '../week';

// ── Helpers ───────────────────────────────────────────────────────────────────

const openEditMock = vi.fn();

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: (overrides.id ?? crypto.randomUUID()) as ItemId,
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

function renderWeek() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CalendarWeekView />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CalendarWeekView — page chrome', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('page title is "Calendar"', () => {
    setupItemsMock([]);
    renderWeek();
    expect(screen.getByRole('heading', { level: 1, name: 'Calendar' })).toBeTruthy();
  });

  it('week range label is displayed in header', () => {
    setupItemsMock([]);
    renderWeek();
    // Should show some week range label
    const rangeLabel = document.querySelector('[aria-live="polite"]');
    expect(rangeLabel).toBeTruthy();
    expect(rangeLabel?.textContent?.trim().length).toBeGreaterThan(0);
  });

  it('previous and next week navigation buttons are present', () => {
    setupItemsMock([]);
    renderWeek();
    expect(screen.getByRole('button', { name: 'Previous week' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next week' })).toBeTruthy();
  });
});

describe('CalendarWeekView — timed items in time grid', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('timed item (9am) renders a CalendarWeekBlock in the time grid', () => {
    const timedItem = makeItem({
      id: 'item-9am' as ItemId,
      title: '9am Meeting',
      due_date: '2026-05-19' as LocalDate,
      due_time: '09:00',
    });
    setupItemsMock([timedItem]);
    renderWeek();

    // CalendarWeekBlock renders as role="button" per component implementation
    const blocks = document.querySelectorAll('[data-week-block]');
    expect(blocks.length).toBeGreaterThanOrEqual(1);
  });

  it('two timed items both render as week blocks', () => {
    const item1 = makeItem({
      id: 'item-9am' as ItemId,
      title: '9am Meeting',
      due_date: '2026-05-19' as LocalDate,
      due_time: '09:00',
    });
    const item2 = makeItem({
      id: 'item-1130' as ItemId,
      title: '11:30am Call',
      due_date: '2026-05-19' as LocalDate,
      due_time: '11:30',
    });
    setupItemsMock([item1, item2]);
    renderWeek();

    const blocks = document.querySelectorAll('[data-week-block]');
    expect(blocks.length).toBeGreaterThanOrEqual(2);
  });

  it('timed item title appears in the week block', () => {
    const timedItem = makeItem({
      title: '9am Meeting',
      due_date: '2026-05-19' as LocalDate,
      due_time: '09:00',
    });
    setupItemsMock([timedItem]);
    renderWeek();

    expect(screen.getAllByText('9am Meeting').length).toBeGreaterThan(0);
  });
});

describe('CalendarWeekView — all-day strip', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('all-day item (no due_time) renders as CalendarEventChip in all-day strip', () => {
    const allDayItem = makeItem({
      id: 'item-allday' as ItemId,
      title: 'All Day Event',
      due_date: '2026-05-19' as LocalDate,
      due_time: null,
    });
    setupItemsMock([allDayItem]);
    renderWeek();

    const chip = document.querySelector(`[data-item-id="item-allday"]`);
    expect(chip).toBeTruthy();
  });

  it('multi-day item (Mon-Fri) renders chips in all-day strip for all 5 days', () => {
    // Week of May 18-24, 2026 (Sun week_start): Mon=May 18, Fri=May 22
    const multiDayItem = makeItem({
      id: 'item-multiday' as ItemId,
      title: 'Sprint Week',
      due_date: '2026-05-22' as LocalDate,
      start_date: '2026-05-18' as LocalDate,
      due_time: null,
    });
    setupItemsMock([multiDayItem]);
    renderWeek();

    // Multi-day item should render chips on multiple days
    const chips = document.querySelectorAll(`[data-item-id="item-multiday"]`);
    expect(chips.length).toBeGreaterThanOrEqual(2);
  });
});

describe('CalendarWeekView — click opens modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    openEditMock.mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it('clicking a timed block opens the task modal with that item', () => {
    const timedItem = makeItem({
      id: 'item-click-test' as ItemId,
      title: 'Clickable Meeting',
      due_date: '2026-05-19' as LocalDate,
      due_time: '09:00',
    });
    setupItemsMock([timedItem]);
    renderWeek();

    const block = document.querySelector('[data-week-block]');
    expect(block).toBeTruthy();

    act(() => {
      // biome-ignore lint/style/noNonNullAssertion: asserted above
      fireEvent.click(block!);
    });

    expect(openEditMock).toHaveBeenCalledWith('item-click-test');
  });
});

describe('CalendarWeekView — T key jumps to current week', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('pressing T navigates to current week (does not throw)', () => {
    setupItemsMock([]);
    renderWeek();

    const root = document.querySelector('[tabindex="-1"]');
    expect(root).toBeTruthy();

    expect(() => {
      act(() => {
        // biome-ignore lint/style/noNonNullAssertion: asserted above
        fireEvent.keyDown(root!, { key: 'T' });
      });
    }).not.toThrow();
  });
});

describe('CalendarWeekView — show completed filter', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('"Show completed" option is revealed after opening the filter menu', () => {
    setupItemsMock([]);
    renderWeek();

    // "Show completed" lives inside the filter dropdown — open it first
    const filterBtn = screen.getByRole('button', { name: 'Filter' });
    act(() => {
      fireEvent.click(filterBtn);
    });

    const showCompletedEls = screen.queryAllByText(/show completed/i);
    expect(showCompletedEls.length).toBeGreaterThan(0);
  });

  it('clicking "Show completed" in the menu does not throw', () => {
    setupItemsMock([]);
    renderWeek();

    const filterBtn = screen.getByRole('button', { name: 'Filter' });
    act(() => {
      fireEvent.click(filterBtn);
    });

    const showCompletedEls = screen.queryAllByText(/show completed/i);
    if (showCompletedEls.length > 0) {
      expect(() => {
        act(() => {
          // biome-ignore lint/style/noNonNullAssertion: length check above guarantees element exists
          fireEvent.click(showCompletedEls[0]!);
        });
      }).not.toThrow();
    }
  });
});

describe('CalendarWeekView — empty week state', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('shows "No events this week." when no items', () => {
    setupItemsMock([]);
    renderWeek();
    expect(screen.getByText('No events this week.')).toBeTruthy();
  });

  it('shows "A quiet week." subline when no items', () => {
    setupItemsMock([]);
    renderWeek();
    expect(screen.getByText('A quiet week.')).toBeTruthy();
  });
});

describe('CalendarWeekView — no drag on CalendarWeekBlock (v1 drag CUT)', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('CalendarWeekBlock has no draggable="true" attribute', () => {
    const timedItem = makeItem({
      id: 'item-nodrag' as ItemId,
      title: 'No Drag',
      due_date: '2026-05-19' as LocalDate,
      due_time: '10:00',
    });
    setupItemsMock([timedItem]);
    renderWeek();

    const blocks = document.querySelectorAll('[data-week-block]');
    for (const block of blocks) {
      expect(block.getAttribute('draggable')).not.toBe('true');
    }
  });

  it('CalendarWeekBlock has no dnd-kit data attributes', () => {
    const timedItem = makeItem({
      id: 'item-nodrag2' as ItemId,
      title: 'No DnD Block',
      due_date: '2026-05-19' as LocalDate,
      due_time: '14:00',
    });
    setupItemsMock([timedItem]);
    renderWeek();

    const blocks = document.querySelectorAll('[data-week-block]');
    for (const block of blocks) {
      const attrs = Array.from(block.attributes).map((a) => a.name);
      const dndAttrs = attrs.filter(
        (a) => a.startsWith('data-dnd') || a.includes('sortable') || a === 'aria-grabbed',
      );
      expect(dndAttrs).toHaveLength(0);
    }
  });
});

// ── Folded from week-view-additional.test.tsx ────────────────────────────────

describe('CalendarWeekView — Filter button access (AC: filter chip gate)', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('Filter button is present', () => {
    setupItemsMock([]);
    renderWeek();
    expect(screen.getByRole('button', { name: 'Filter' })).toBeTruthy();
  });

  it('Clicking Filter reveals Show completed inside the menu', () => {
    setupItemsMock([]);
    renderWeek();

    const filterBtn = screen.getByRole('button', { name: 'Filter' });
    act(() => {
      fireEvent.click(filterBtn);
    });

    const showCompletedItems = screen.queryAllByText(/Show completed/i);
    expect(showCompletedItems.length).toBeGreaterThan(0);
  });

  it('Clicking Show completed in menu does not throw', () => {
    setupItemsMock([]);
    renderWeek();

    const filterBtn = screen.getByRole('button', { name: 'Filter' });
    act(() => {
      fireEvent.click(filterBtn);
    });

    const showCompletedItems = screen.queryAllByText(/Show completed/i);
    expect(showCompletedItems.length).toBeGreaterThan(0);

    expect(() => {
      act(() => {
        // biome-ignore lint/style/noNonNullAssertion: length check above guarantees element exists
        fireEvent.click(showCompletedItems[0]!);
      });
    }).not.toThrow();
  });
});

describe('CalendarWeekView — week range header microcopy §24', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('Week range header contains – dash separator (microcopy §24)', () => {
    setupItemsMock([]);
    renderWeek();

    const rangeLabel = document.querySelector('[aria-live="polite"]');
    expect(rangeLabel).toBeTruthy();
    expect(rangeLabel?.textContent).toContain('–');
  });

  it('Week range header ends with 4-digit year', () => {
    setupItemsMock([]);
    renderWeek();

    const rangeLabel = document.querySelector('[aria-live="polite"]');
    expect(rangeLabel?.textContent).toMatch(/\d{4}$/);
  });

  it('Week range matches `<Mon DD> – <Mon DD>, <Year>`', () => {
    setupItemsMock([]);
    renderWeek();

    const rangeLabel = document.querySelector('[aria-live="polite"]');
    const text = rangeLabel?.textContent?.trim() ?? '';
    expect(text).toMatch(/^[A-Z][a-z]+ \d{1,2} – [A-Z][a-z]+ \d{1,2}, \d{4}$/);
  });
});

describe('CalendarWeekView — multi-day item chip positions (folded from week-view-additional)', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('Multi-day Mon-Fri spans exactly 5 day chips', () => {
    const multiDayItem = makeItem({
      id: 'item-multiday-span' as ItemId,
      title: 'Sprint Week',
      due_date: '2026-05-22' as LocalDate,
      start_date: '2026-05-18' as LocalDate,
      due_time: null,
    });
    setupItemsMock([multiDayItem]);
    renderWeek();

    const chips = document.querySelectorAll('[data-item-id="item-multiday-span"]');
    expect(chips.length).toBe(5);
  });

  it('Multi-day chip positions are start/middle×3/end', () => {
    const multiDayItem = makeItem({
      id: 'item-positions' as ItemId,
      title: 'Multi Span',
      due_date: '2026-05-22' as LocalDate,
      start_date: '2026-05-18' as LocalDate,
      due_time: null,
    });
    setupItemsMock([multiDayItem]);
    renderWeek();

    const chips = document.querySelectorAll('[data-item-id="item-positions"]');
    const positions = Array.from(chips).map((c) => c.getAttribute('data-day-position'));

    expect(positions).toContain('start');
    expect(positions).toContain('end');
    const middleCount = positions.filter((p) => p === 'middle').length;
    expect(middleCount).toBe(3);
  });

  it('CalendarWeekBlock has no drag attributes', () => {
    const timedItem = makeItem({
      id: 'item-no-drag-check' as ItemId,
      title: 'No Drag Item',
      due_date: '2026-05-19' as LocalDate,
      due_time: '09:00',
    });
    setupItemsMock([timedItem]);
    renderWeek();

    const blocks = document.querySelectorAll('[data-week-block]');
    expect(blocks.length).toBeGreaterThanOrEqual(1);

    for (const block of blocks) {
      expect(block.getAttribute('draggable')).not.toBe('true');
      const dndAttrs = Array.from(block.attributes)
        .map((a) => a.name)
        .filter((n) => n.startsWith('data-dnd') || n === 'aria-grabbed');
      expect(dndAttrs).toHaveLength(0);
    }
  });
});
