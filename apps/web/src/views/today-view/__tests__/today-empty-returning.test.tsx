/**
 * today-empty-returning.test.tsx
 *
 * Covers returning-user empty state.
 * When today items list is empty BUT the all-items list has at least one item
 * (e.g., a trashed or completed item), the view should show the returning-user copy:
 * "Nothing due today." + "You're caught up. Enjoy the day."
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Item, ItemId, LocalDate } from '@tasko/types';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api/items', () => ({
  usePatchSubtask: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
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
vi.mock('../../../api/tags', () => ({ useTags: vi.fn(() => ({ data: { tags: [] } })) }));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string; [k: string]: unknown }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useRouterState: () => ({ location: { pathname: '/today' } }),
  useNavigate: () => vi.fn(),
}));

import {
  useBulkMoveOverdue,
  useDeleteItem,
  useEditTitleInline,
  useItems,
  useReschedule,
  useToggleComplete,
} from '../../../api/items';
import { TodayView } from '../index';

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

describe('TodayView — returning-user empty state', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-05-19T00:00:00Z'));

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

    // today view: empty; all view (include_completed: true): has a trashed item → returning user
    const trashedItem = makeItem({
      id: 'trashed-1' as ItemId,
      title: 'Old Task',
      trashed_at: '2026-05-10T00:00:00Z',
      status: 'done',
    });

    vi.mocked(useItems).mockImplementation((filters) => {
      if (filters.view === 'all') {
        return {
          data: { items: [trashedItem], count: 1 },
          isLoading: false,
        } as unknown as ReturnType<typeof useItems>;
      }
      // today view: no active items
      return {
        data: { items: [] as Item[], count: 0 },
        isLoading: false,
      } as unknown as ReturnType<typeof useItems>;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    act(() => {});
  });

  function renderToday() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={queryClient}>
        <TodayView />
      </QueryClientProvider>,
    );
  }

  it('shows "Nothing due today." headline for returning user with empty today', () => {
    renderToday();
    expect(screen.getByText('Nothing due today.')).toBeTruthy();
  });

  it('shows "You\'re caught up. Enjoy the day." subline for returning user', () => {
    renderToday();
    expect(screen.getByText("You're caught up. Enjoy the day.")).toBeTruthy();
  });

  it('does not show first-run copy for returning user', () => {
    renderToday();
    expect(screen.queryByText('Welcome to Tasko.')).toBeNull();
    expect(screen.queryByText('Add your first task above — type it and press Enter.')).toBeNull();
  });
});
