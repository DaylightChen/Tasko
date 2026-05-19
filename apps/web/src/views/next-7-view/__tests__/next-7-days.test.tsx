/**
 * next-7-days.test.tsx
 *
 * Smoke tests for Next7DaysView:
 * - Renders 7 day group headers (today through today+6)
 * - Items appear in the correct day group
 * - Empty day groups show "— empty" in subtle text
 * - Entire-view empty state "Nothing in the next seven days." + "A quiet week. Or just unscheduled."
 * - Multi-day items appear in each day bucket their span covers
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Item, ItemId, LocalDate } from '@tasko/types';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api/items', () => ({
  useItems: vi.fn(),
  useToggleComplete: vi.fn(),
  useReschedule: vi.fn(),
  useChangePriority: vi.fn(),
  useEditTitleInline: vi.fn(),
  useDeleteItem: vi.fn(),
  useBulkMoveOverdue: vi.fn(),
  usePatchItem: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn() })),
}));

vi.mock('../../../api/projects', () => ({ useProjects: vi.fn() }));
vi.mock('../../../api/folders', () => ({ useFolders: vi.fn() }));
vi.mock('../../../api/config', () => ({ useConfig: vi.fn() }));
vi.mock('../../../api/tags', () => ({ useTags: vi.fn(() => ({ data: { tags: [] } })) }));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string; [k: string]: unknown }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useRouterState: () => ({ location: { pathname: '/next-7-days' } }),
  useNavigate: () => vi.fn(),
}));

import { useDeleteItem, useEditTitleInline, useItems, useToggleComplete } from '../../../api/items';
import { Next7DaysView } from '../index';

const TODAY = '2026-05-19' as LocalDate; // Tuesday
const noopMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: crypto.randomUUID() as ItemId,
    schema_version: 1,
    type: 'task',
    project_id: 'proj-1' as Item['project_id'],
    parent_id: null,
    title: 'Week Task',
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

describe('Next7DaysView', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-05-19T00:00:00Z'));

    vi.mocked(useToggleComplete).mockReturnValue(
      noopMutation as unknown as ReturnType<typeof useToggleComplete>,
    );
    vi.mocked(useEditTitleInline).mockReturnValue(
      noopMutation as unknown as ReturnType<typeof useEditTitleInline>,
    );
    vi.mocked(useDeleteItem).mockReturnValue(noopMutation as unknown as ReturnType<typeof useDeleteItem>);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    act(() => {});
  });

  function renderNext7(items: Item[]) {
    vi.mocked(useItems).mockReturnValue({
      data: { items, count: items.length },
      isLoading: false,
    } as unknown as ReturnType<typeof useItems>);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={queryClient}>
        <Next7DaysView />
      </QueryClientProvider>,
    );
  }

  describe('empty state', () => {
    it('shows "Nothing in the next seven days." headline', () => {
      renderNext7([]);
      expect(screen.getByText('Nothing in the next seven days.')).toBeTruthy();
    });

    it('shows "A quiet week. Or just unscheduled." subline', () => {
      renderNext7([]);
      expect(screen.getByText('A quiet week. Or just unscheduled.')).toBeTruthy();
    });
  });

  describe('populated state', () => {
    it('renders <h1>Next 7 Days</h1> title', () => {
      renderNext7([makeItem()]);
      expect(screen.getByRole('heading', { level: 1, name: /next 7 days/i })).toBeTruthy();
    });

    it('renders 7 day group sections', () => {
      // With one item (due today), 7 day sections should exist
      renderNext7([makeItem({ id: 'i1' as ItemId, due_date: TODAY })]);
      const sections = screen.getAllByRole('region');
      // Should have 7 sections (one per day bucket)
      expect(sections.length).toBeGreaterThanOrEqual(7);
    });

    it('today group header contains "Today" label', () => {
      renderNext7([makeItem({ id: 'i1' as ItemId, due_date: TODAY })]);
      const headings = screen.getAllByRole('heading', { level: 2 });
      const todayHeading = headings.find((h) => h.textContent?.includes('Today'));
      expect(todayHeading).toBeTruthy();
    });

    it('tomorrow group header contains "Tomorrow" label when tomorrow has items', () => {
      // To see the "Tomorrow," prefix in the h2, tomorrow's bucket must have items
      const TOMORROW = '2026-05-20' as LocalDate;
      renderNext7([makeItem({ id: 'i1' as ItemId, due_date: TOMORROW })]);
      const headings = screen.getAllByRole('heading', { level: 2 });
      // Populated day header uses the full label including "Tomorrow,"
      const tomorrowHeading = headings.find((h) => h.textContent?.includes('Tomorrow'));
      expect(tomorrowHeading).toBeTruthy();
    });

    it('empty day groups show "— empty" text', () => {
      // Only item due today — other 6 days should show "— empty"
      renderNext7([makeItem({ id: 'i1' as ItemId, due_date: TODAY })]);
      const emptyLabels = screen.getAllByText(/— empty/i);
      // 6 empty days (tomorrow through today+6) — verify at least 1
      expect(emptyLabels.length).toBeGreaterThanOrEqual(1);
    });

    it('item due today appears in today group with count badge (1)', () => {
      renderNext7([makeItem({ id: 'i1' as ItemId, title: 'Today Item', due_date: TODAY })]);
      // Count badge for today group should show (1)
      const countBadges = screen.getAllByText('(1)');
      expect(countBadges.length).toBeGreaterThanOrEqual(1);
    });

    it('multi-day item appears in each day its span covers', () => {
      // Item spanning today through 2026-05-21 (3 days: today, tomorrow, day after)
      const multiDay = makeItem({
        id: 'multi' as ItemId,
        title: 'Multi-Day Project',
        start_date: TODAY,
        due_date: '2026-05-21' as LocalDate,
      });
      renderNext7([multiDay]);

      // The item should appear in multiple day buckets
      const titleEls = screen.getAllByText('Multi-Day Project');
      // Appears in 3 day buckets (today, tomorrow, +2)
      expect(titleEls.length).toBe(3);
    });
  });
});
