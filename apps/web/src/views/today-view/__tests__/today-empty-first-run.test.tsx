/**
 * today-empty-first-run.test.tsx
 *
 * Covers first-run empty state (no items ever created).
 * When both the today items list and the all-items list are empty, the view should
 * show "Welcome to Tasko." + "Add your first task above — type it and press Enter."
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

describe('TodayView — first-run empty state', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-05-19T00:00:00Z'));
    setupMutationMocks();

    // No items at all — both today view and all view return empty
    vi.mocked(useItems).mockImplementation((_filters) => {
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

  it('shows "Welcome to Tasko." headline on first run (zero items ever)', () => {
    renderToday();
    expect(screen.getByText('Welcome to Tasko.')).toBeTruthy();
  });

  it('shows "Add your first task above — type it and press Enter." subline on first run', () => {
    renderToday();
    expect(screen.getByText('Add your first task above — type it and press Enter.')).toBeTruthy();
  });

  it('does not show returning-user copy on first run', () => {
    renderToday();
    expect(screen.queryByText('Nothing due today.')).toBeNull();
    expect(screen.queryByText("You're caught up. Enjoy the day.")).toBeNull();
  });

  it('only shows Inbox project but no today rows renders first-run state', () => {
    // Even if we set only 1 inbox project, no items → first-run
    renderToday();
    expect(screen.getByText('Welcome to Tasko.')).toBeTruthy();
  });
});
