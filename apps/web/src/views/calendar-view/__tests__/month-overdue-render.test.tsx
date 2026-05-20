/**
 * month-overdue-render.test.tsx
 *
 * Covers:
 * - An item due in a prior month does NOT render on the current (May) month grid.
 * - Navigating back to April makes the overdue item visible with data-overdue treatment.
 * - Items within May with past due dates get data-overdue attribute on their chips.
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
  // Today is May 19 — items from April are overdue
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
    title: 'Overdue Task',
    notes: '',
    due_date: '2026-04-10' as LocalDate,
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

describe('CalendarMonthView — overdue rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('item due April 10 does NOT render on the May 2026 grid', () => {
    const overdueItem = makeItem({ title: 'April Task', due_date: '2026-04-10' as LocalDate });
    vi.mocked(useItems).mockReturnValue({
      data: { items: [overdueItem], count: 1 },
      isLoading: false,
    } as unknown as ReturnType<typeof useItems>);

    renderCalendar();

    // The May grid extends back to ~April 26 (week containing May 1) with sun-start.
    // April 10 is NOT in that range.
    expect(screen.queryByText('April Task')).toBeNull();
  });

  it('navigating to April shows the overdue item with data-overdue attribute', () => {
    const overdueItem = makeItem({ title: 'April Overdue', due_date: '2026-04-10' as LocalDate });
    vi.mocked(useItems).mockReturnValue({
      data: { items: [overdueItem], count: 1 },
      isLoading: false,
    } as unknown as ReturnType<typeof useItems>);

    renderCalendar();

    // Navigate back to April via prev-month button
    const prevBtn = screen.getByRole('button', { name: /previous month/i });
    act(() => fireEvent.click(prevBtn));

    // April is now the visible month — the item's chip should appear
    const chip = screen.queryByText('April Overdue');
    expect(chip).toBeTruthy();

    // Check data-overdue on the chip element
    // The chip is a button or its parent should have data-overdue
    const overdueEl = document.querySelector('[data-overdue]');
    expect(overdueEl).toBeTruthy();
  });

  it('item due earlier in May (before today) renders with data-overdue on its chip', () => {
    // May 10 is before today (May 19) — overdue
    const overdueThisMonth = makeItem({
      title: 'Early May Task',
      due_date: '2026-05-10' as LocalDate,
    });
    vi.mocked(useItems).mockReturnValue({
      data: { items: [overdueThisMonth], count: 1 },
      isLoading: false,
    } as unknown as ReturnType<typeof useItems>);

    renderCalendar();

    // The chip should render with data-overdue
    const overdueChips = document.querySelectorAll('[data-overdue]');
    expect(overdueChips.length).toBeGreaterThan(0);
  });

  it('item due today is NOT overdue', () => {
    const todayItem = makeItem({
      title: 'Due Today',
      due_date: '2026-05-19' as LocalDate,
    });
    vi.mocked(useItems).mockReturnValue({
      data: { items: [todayItem], count: 1 },
      isLoading: false,
    } as unknown as ReturnType<typeof useItems>);

    renderCalendar();

    // Chips for today's item should not have data-overdue
    const chips = document.querySelectorAll('[data-overdue]');
    expect(chips.length).toBe(0);
  });
});
