/**
 * today-view.test.tsx
 *
 * Covers:
 * - Overdue strip header "Overdue (3)" + "Move all overdue to today" button + 3 overdue rows
 * - 5 today rows
 * - Future in-progress item does NOT appear (§9.4 #4: Today is strictly date-driven)
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Item, ItemId, LocalDate } from '@tasko/types';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Must come before importing the component under test ──────────────────────

vi.mock('../../../api/items', () => ({
  useItems: vi.fn(),
  useToggleComplete: vi.fn(),
  useReschedule: vi.fn(),
  useChangePriority: vi.fn(),
  useEditTitleInline: vi.fn(),
  useDeleteItem: vi.fn(),
  useBulkMoveOverdue: vi.fn(),
}));

vi.mock('../../../api/projects', () => ({ useProjects: vi.fn() }));
vi.mock('../../../api/folders', () => ({ useFolders: vi.fn() }));
vi.mock('../../../api/config', () => ({ useConfig: vi.fn() }));

// Mock TanStack Router – ViewChrome doesn't use it directly but SortDropdown or
// other children might import from it.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string; [k: string]: unknown }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useRouterState: () => ({ location: { pathname: '/today' } }),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import {
  useBulkMoveOverdue,
  useDeleteItem,
  useEditTitleInline,
  useItems,
  useReschedule,
  useToggleComplete,
} from '../../../api/items';
import { TodayView } from '../index';

// ── Constants & helpers ───────────────────────────────────────────────────────

const TODAY = '2026-05-19' as LocalDate;
const YESTERDAY = '2026-05-18' as LocalDate;
const TWO_DAYS_AGO = '2026-05-17' as LocalDate;
const FIVE_DAYS_AGO = '2026-05-14' as LocalDate;
// A future item: start_date in past, due_date in future — per §9.4 #4 it must NOT appear
const FUTURE_DATE = '2026-05-30' as LocalDate;

const noopMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: crypto.randomUUID() as ItemId,
    schema_version: 1,
    type: 'task',
    project_id: 'proj-inbox' as Item['project_id'],
    parent_id: null,
    title: 'Test Task',
    notes: '',
    due_date: TODAY,
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

function setupMutationMocks() {
  vi.mocked(useToggleComplete).mockReturnValue(
    noopMutation as unknown as ReturnType<typeof useToggleComplete>,
  );
  vi.mocked(useReschedule).mockReturnValue(noopMutation as unknown as ReturnType<typeof useReschedule>);
  vi.mocked(useEditTitleInline).mockReturnValue(
    noopMutation as unknown as ReturnType<typeof useEditTitleInline>,
  );
  vi.mocked(useDeleteItem).mockReturnValue(noopMutation as unknown as ReturnType<typeof useDeleteItem>);
  vi.mocked(useBulkMoveOverdue).mockReturnValue(
    noopMutation as unknown as ReturnType<typeof useBulkMoveOverdue>,
  );
}

function renderToday(items: Item[], allItems: Item[] = items) {
  vi.mocked(useItems).mockImplementation((filters) => {
    if (filters.view === 'all') {
      return { data: { items: allItems, count: allItems.length }, isLoading: false } as unknown as ReturnType<
        typeof useItems
      >;
    }
    return { data: { items, count: items.length }, isLoading: false } as unknown as ReturnType<
      typeof useItems
    >;
  });

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <TodayView />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TodayView — populated with overdue + today items', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-05-19T00:00:00Z'));
    setupMutationMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    act(() => {}); // flush any pending state
  });

  it('shows Overdue (3) header when 3 overdue items exist', () => {
    const overdue = [
      makeItem({ id: 'o1' as ItemId, title: 'Overdue 1', due_date: YESTERDAY }),
      makeItem({ id: 'o2' as ItemId, title: 'Overdue 2', due_date: TWO_DAYS_AGO }),
      makeItem({ id: 'o3' as ItemId, title: 'Overdue 3', due_date: FIVE_DAYS_AGO }),
    ];
    const todays = Array.from({ length: 5 }, (_, i) =>
      makeItem({ id: `t${i}` as ItemId, title: `Today Task ${i + 1}`, due_date: TODAY }),
    );
    const futureInProgress = makeItem({
      id: 'future1' as ItemId,
      title: 'Future In Progress',
      due_date: FUTURE_DATE,
      status: 'in_progress',
    });

    renderToday([...overdue, ...todays, futureInProgress]);

    // Overdue header with count
    const headings = screen.getAllByRole('heading', { level: 2 });
    const overdueH2 = headings.find((h) => h.textContent?.includes('Overdue (3)'));
    expect(overdueH2, 'Expected "Overdue (3)" h2 heading').toBeTruthy();
  });

  it('shows "Move all overdue to today" button', () => {
    const overdue = [
      makeItem({ id: 'o1' as ItemId, title: 'Overdue 1', due_date: YESTERDAY }),
      makeItem({ id: 'o2' as ItemId, title: 'Overdue 2', due_date: TWO_DAYS_AGO }),
      makeItem({ id: 'o3' as ItemId, title: 'Overdue 3', due_date: FIVE_DAYS_AGO }),
    ];
    const todays = Array.from({ length: 5 }, (_, i) =>
      makeItem({ id: `t${i}` as ItemId, title: `Today Task ${i + 1}`, due_date: TODAY }),
    );

    renderToday([...overdue, ...todays]);

    expect(screen.getByRole('button', { name: /move all overdue to today/i })).toBeTruthy();
  });

  it('renders exactly 3 overdue rows and 5 today rows', () => {
    const overdue = [
      makeItem({ id: 'o1' as ItemId, title: 'Overdue Task A', due_date: YESTERDAY }),
      makeItem({ id: 'o2' as ItemId, title: 'Overdue Task B', due_date: TWO_DAYS_AGO }),
      makeItem({ id: 'o3' as ItemId, title: 'Overdue Task C', due_date: FIVE_DAYS_AGO }),
    ];
    const todays = Array.from({ length: 5 }, (_, i) =>
      makeItem({ id: `t${i}` as ItemId, title: `Today Task ${i + 1}`, due_date: TODAY }),
    );

    renderToday([...overdue, ...todays]);

    // Each task row has an aria-label starting with 'Task: "'
    const rows = screen.getAllByRole('listitem');
    // 3 overdue + 5 today = 8 rows
    expect(rows).toHaveLength(8);
  });

  it('future in-progress item does NOT appear (strictly date-driven §9.4 #4)', () => {
    const overdue = [makeItem({ id: 'o1' as ItemId, title: 'Overdue Task', due_date: YESTERDAY })];
    const todays = [makeItem({ id: 't1' as ItemId, title: 'Today Task', due_date: TODAY })];
    const futureInProgress = makeItem({
      id: 'future1' as ItemId,
      title: 'Future In Progress Task',
      due_date: FUTURE_DATE,
      status: 'in_progress',
    });

    renderToday([...overdue, ...todays, futureInProgress]);

    // The future item's title must not be visible
    expect(screen.queryByText('Future In Progress Task')).toBeNull();

    // Only 2 rows total (1 overdue + 1 today)
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
  });

  it('does not show overdue strip when no overdue items exist', () => {
    const todays = [makeItem({ id: 't1' as ItemId, title: 'Today Task', due_date: TODAY })];

    renderToday(todays);

    const headings = screen.getAllByRole('heading');
    const overdueH2 = headings.find((h) => h.textContent?.includes('Overdue'));
    expect(overdueH2).toBeUndefined();

    expect(screen.queryByRole('button', { name: /move all overdue to today/i })).toBeNull();
  });
});
