/**
 * tomorrow-view.test.tsx
 *
 * Smoke tests for TomorrowView:
 * - Renders mock items with a section header showing the tomorrow date
 * - Renders empty state "Nothing scheduled for tomorrow." + "Plan ahead — add a task."
 * - Done/trashed items are filtered out
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
}));

vi.mock('../../../api/projects', () => ({ useProjects: vi.fn() }));
vi.mock('../../../api/folders', () => ({ useFolders: vi.fn() }));
vi.mock('../../../api/config', () => ({ useConfig: vi.fn() }));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string; [k: string]: unknown }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useRouterState: () => ({ location: { pathname: '/tomorrow' } }),
}));

import { useDeleteItem, useEditTitleInline, useItems, useToggleComplete } from '../../../api/items';
import { TomorrowView } from '../index';

const TODAY = '2026-05-19' as LocalDate;
const TOMORROW = '2026-05-20' as LocalDate;
const noopMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: crypto.randomUUID() as ItemId,
    schema_version: 1,
    type: 'task',
    project_id: 'proj-1' as Item['project_id'],
    parent_id: null,
    title: 'Tomorrow Task',
    notes: '',
    due_date: TOMORROW,
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

describe('TomorrowView', () => {
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

  function renderTomorrow(items: Item[]) {
    vi.mocked(useItems).mockReturnValue({
      data: { items, count: items.length },
      isLoading: false,
    } as unknown as ReturnType<typeof useItems>);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={queryClient}>
        <TomorrowView />
      </QueryClientProvider>,
    );
  }

  describe('populated state', () => {
    it('renders <h1>Tomorrow</h1> title', () => {
      renderTomorrow([makeItem()]);
      expect(screen.getByRole('heading', { level: 1, name: /tomorrow/i })).toBeTruthy();
    });

    it('renders the section header with tomorrow date "Wed, May 20"', () => {
      renderTomorrow([makeItem()]);
      // The section header shows the formatted date for tomorrow (2026-05-20 = Wed, May 20)
      const headings = screen.getAllByRole('heading', { level: 2 });
      const tomorrowHeader = headings.find((h) => h.textContent?.includes('May 20'));
      expect(tomorrowHeader).toBeTruthy();
    });

    it('renders task rows for tomorrow items', () => {
      const items = [
        makeItem({ id: 'tm1' as ItemId, title: 'Tomorrow Task 1' }),
        makeItem({ id: 'tm2' as ItemId, title: 'Tomorrow Task 2' }),
      ];
      renderTomorrow(items);

      const rows = screen.getAllByRole('listitem');
      expect(rows).toHaveLength(2);
    });

    it('done items are NOT shown (filtered out)', () => {
      const items = [
        makeItem({ id: 'tm1' as ItemId, title: 'Active Tomorrow Task' }),
        makeItem({
          id: 'tm2' as ItemId,
          title: 'Done Task',
          status: 'done',
          completed_at: '2026-05-19T00:00:00Z',
        }),
      ];
      renderTomorrow(items);

      const rows = screen.getAllByRole('listitem');
      expect(rows).toHaveLength(1);
      expect(screen.queryByText('Done Task')).toBeNull();
    });
  });

  describe('empty state', () => {
    it('shows "Nothing scheduled for tomorrow." headline', () => {
      renderTomorrow([]);
      expect(screen.getByText('Nothing scheduled for tomorrow.')).toBeTruthy();
    });

    it('shows "Plan ahead — add a task." subline', () => {
      renderTomorrow([]);
      expect(screen.getByText('Plan ahead — add a task.')).toBeTruthy();
    });
  });
});
