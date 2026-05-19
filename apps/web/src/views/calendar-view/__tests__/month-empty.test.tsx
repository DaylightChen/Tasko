/**
 * month-empty.test.tsx
 *
 * Covers:
 * - When no items exist in the visible month, empty state shows:
 *   "No events this month." headline.
 *   "Press N to create one on the focused day." subline.
 * - When items exist, empty state is NOT shown.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Item, ItemId, LocalDate } from '@tasko/types';
import { render, screen } from '@testing-library/react';
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
    title: 'May Task',
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

function renderCalendar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CalendarMonthView />
    </QueryClientProvider>,
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CalendarMonthView — empty state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows "No events this month." when no items in current month', () => {
    vi.mocked(useItems).mockReturnValue({
      data: { items: [], count: 0 },
      isLoading: false,
    } as unknown as ReturnType<typeof useItems>);

    renderCalendar();

    expect(screen.getByText('No events this month.')).toBeTruthy();
  });

  it('shows "Press N to create one on the focused day." subline when empty', () => {
    vi.mocked(useItems).mockReturnValue({
      data: { items: [], count: 0 },
      isLoading: false,
    } as unknown as ReturnType<typeof useItems>);

    renderCalendar();

    expect(screen.getByText('Press N to create one on the focused day.')).toBeTruthy();
  });

  it('does NOT show empty state when items exist in the current month', () => {
    const item = makeItem({ due_date: '2026-05-15' as LocalDate });
    vi.mocked(useItems).mockReturnValue({
      data: { items: [item], count: 1 },
      isLoading: false,
    } as unknown as ReturnType<typeof useItems>);

    renderCalendar();

    expect(screen.queryByText('No events this month.')).toBeNull();
  });

  it('shows empty state when item only falls outside the current month grid range', () => {
    // An item in July should not make May non-empty
    const item = makeItem({ due_date: '2026-07-01' as LocalDate });
    vi.mocked(useItems).mockReturnValue({
      data: { items: [item], count: 1 },
      isLoading: false,
    } as unknown as ReturnType<typeof useItems>);

    renderCalendar();

    // The calendar grid only covers ~6 weeks — July item won't be in May grid
    // No items should appear on visible cells
    expect(screen.queryByText('May Task')).toBeNull();
    // The empty state SHOULD appear because no grid-intersecting items exist (fix Issue #3)
    expect(screen.getByText('No events this month.')).toBeTruthy();
    expect(screen.getByText('Press N to create one on the focused day.')).toBeTruthy();
  });
});
