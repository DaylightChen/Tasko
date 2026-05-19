/**
 * inbox-view.test.tsx
 *
 * Smoke tests for InboxView:
 * - Renders "N items waiting to be filed." subline when N > 0
 * - Empty state "Inbox is clear." + "Quick-add lands here when no project is picked."
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
  usePatchItem: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn() })),
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
  useRouterState: () => ({ location: { pathname: '/inbox' } }),
}));

import { useDeleteItem, useEditTitleInline, useItems, useToggleComplete } from '../../../api/items';
import { InboxView } from '../index';

const TODAY = '2026-05-19' as LocalDate;
const noopMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: crypto.randomUUID() as ItemId,
    schema_version: 1,
    type: 'task',
    project_id: 'proj-inbox' as Item['project_id'],
    parent_id: null,
    title: 'Inbox Task',
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

describe('InboxView', () => {
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

  function renderInbox(items: Item[]) {
    vi.mocked(useItems).mockReturnValue({
      data: { items, count: items.length },
      isLoading: false,
    } as unknown as ReturnType<typeof useItems>);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={queryClient}>
        <InboxView />
      </QueryClientProvider>,
    );
  }

  describe('empty state', () => {
    it('shows "Inbox is clear." headline', () => {
      renderInbox([]);
      expect(screen.getByText('Inbox is clear.')).toBeTruthy();
    });

    it('shows "Quick-add lands here when no project is picked." subline', () => {
      renderInbox([]);
      expect(screen.getByText('Quick-add lands here when no project is picked.')).toBeTruthy();
    });
  });

  describe('populated state', () => {
    it('renders <h1>Inbox</h1> title', () => {
      renderInbox([makeItem()]);
      expect(screen.getByRole('heading', { level: 1, name: /inbox/i })).toBeTruthy();
    });

    it('shows "3 items waiting to be filed." subline for 3 inbox items', () => {
      const items = [
        makeItem({ id: 'i1' as ItemId, title: 'Inbox Task 1' }),
        makeItem({ id: 'i2' as ItemId, title: 'Inbox Task 2' }),
        makeItem({ id: 'i3' as ItemId, title: 'Inbox Task 3' }),
      ];
      renderInbox(items);

      expect(screen.getByText('3 items waiting to be filed.')).toBeTruthy();
    });

    it('shows "1 items waiting to be filed." for 1 inbox item', () => {
      renderInbox([makeItem({ id: 'i1' as ItemId })]);
      expect(screen.getByText('1 items waiting to be filed.')).toBeTruthy();
    });

    it('renders the task rows', () => {
      const items = [
        makeItem({ id: 'i1' as ItemId, title: 'Filed Task A' }),
        makeItem({ id: 'i2' as ItemId, title: 'Filed Task B' }),
      ];
      renderInbox(items);

      const rows = screen.getAllByRole('button', { name: /^task:/i });
      expect(rows).toHaveLength(2);
    });

    it('done items do NOT appear in the list', () => {
      const items = [
        makeItem({ id: 'i1' as ItemId, title: 'Active Task' }),
        makeItem({
          id: 'i2' as ItemId,
          title: 'Done Task',
          status: 'done',
          completed_at: '2026-05-18T00:00:00Z',
        }),
      ];
      renderInbox(items);

      // After filter, only 1 active item remains
      expect(screen.getByText('1 items waiting to be filed.')).toBeTruthy();
      expect(screen.queryByText('Done Task')).toBeNull();
    });

    it('trashed items do NOT appear in the list', () => {
      const items = [
        makeItem({ id: 'i1' as ItemId, title: 'Active Task' }),
        makeItem({ id: 'i2' as ItemId, title: 'Trashed Task', trashed_at: '2026-05-18T00:00:00Z' }),
      ];
      renderInbox(items);

      expect(screen.getByText('1 items waiting to be filed.')).toBeTruthy();
      expect(screen.queryByText('Trashed Task')).toBeNull();
    });
  });
});
