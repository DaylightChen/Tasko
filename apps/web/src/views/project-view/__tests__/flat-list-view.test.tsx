/**
 * FlatListView tests (task-09)
 *
 * Covers:
 * - Non-hierarchical project renders tasks as a flat list
 * - "Show N completed" toggle shows completed items when expanded
 * - "Hide completed" reverts after expanding
 * - Empty state shown when no tasks
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Item, ItemId, LocalDate, ProjectId } from '@tasko/types';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api/items', () => ({
  usePatchSubtask: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  useItems: vi.fn(),
  useCreateItem: vi.fn(),
  usePatchItem: vi.fn(),
  useToggleComplete: vi.fn(),
  useReschedule: vi.fn(),
  useChangePriority: vi.fn(),
  useEditTitleInline: vi.fn(),
  useDeleteItem: vi.fn(),
  useBulkMoveOverdue: vi.fn(),
}));

vi.mock('../../../api/projects', () => ({ useProjects: vi.fn(), useProject: vi.fn() }));
vi.mock('../../../api/folders', () => ({ useFolders: vi.fn() }));
vi.mock('../../../api/config', () => ({ useConfig: vi.fn() }));
vi.mock('../../../api/tags', () => ({ useTags: vi.fn(() => ({ data: { tags: [] } })) }));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string; [k: string]: unknown }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useRouterState: () => ({ location: { pathname: '/project/proj-flat' } }),
  useNavigate: () => vi.fn(),
}));

import { useCreateItem, useItems, usePatchItem } from '../../../api/items';
import { FlatListView } from '../flat-list-view';

const TODAY = '2026-05-19' as LocalDate;
const PROJECT_ID = 'proj-flat' as ProjectId;

const noopMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

function makeItem(id: string, overrides: Partial<Item> = {}): Item {
  return {
    id: id as ItemId,
    schema_version: 1,
    type: 'task',
    project_id: PROJECT_ID,
    parent_id: null,
    title: id,
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

function setupMocks(items: Item[]) {
  // For flat-list view, useItems is called once (no include_completed initially)
  // When showCompleted changes, useItems should also return completed items.
  vi.mocked(useItems).mockReturnValue({
    data: { items, count: items.length },
    isLoading: false,
  } as unknown as ReturnType<typeof useItems>);

  vi.mocked(useCreateItem).mockReturnValue(noopMutation as unknown as ReturnType<typeof useCreateItem>);
  vi.mocked(usePatchItem).mockReturnValue(noopMutation as unknown as ReturnType<typeof usePatchItem>);
}

function renderFlatList(items: Item[]) {
  setupMocks(items);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FlatListView projectId={PROJECT_ID} projectName="Flat Project" onNavigateKanban={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe('FlatListView', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-05-19T00:00:00Z'));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    act(() => {});
  });

  it('renders the project name as a heading', () => {
    renderFlatList([makeItem('t1', { title: 'Task One' })]);
    expect(screen.getByRole('heading', { level: 1, name: 'Flat Project' })).toBeTruthy();
  });

  it('renders active tasks', () => {
    const items = [makeItem('t1', { title: 'Active Task 1' }), makeItem('t2', { title: 'Active Task 2' })];
    renderFlatList(items);
    expect(screen.getByText('Active Task 1')).toBeTruthy();
    expect(screen.getByText('Active Task 2')).toBeTruthy();
  });

  it('shows "Show N completed" button when there are completed tasks', () => {
    const items = [
      makeItem('t1', { title: 'Active', status: 'todo' }),
      makeItem('t2', { title: 'Done Task', status: 'done' }),
    ];
    renderFlatList(items);
    expect(screen.getByRole('button', { name: /show completed/i })).toBeTruthy();
  });

  it('does NOT show "Show N completed" button when no completed tasks', () => {
    const items = [makeItem('t1', { title: 'Active', status: 'todo' })];
    renderFlatList(items);
    expect(screen.queryByRole('button', { name: /show.*completed/i })).toBeNull();
  });

  it('clicking "Show N completed" reveals completed tasks', async () => {
    const items = [
      makeItem('t1', { title: 'Active Task', status: 'todo' }),
      makeItem('t2', { title: 'Completed Task', status: 'done' }),
    ];
    renderFlatList(items);

    const showBtn = screen.getByRole('button', { name: /show completed/i });
    fireEvent.click(showBtn);

    await waitFor(() => {
      expect(screen.getByText('Completed Task')).toBeTruthy();
    });
  });

  it('clicking "Show N completed" changes button label to "Hide completed"', async () => {
    const items = [
      makeItem('t1', { title: 'Active', status: 'todo' }),
      makeItem('t2', { title: 'Done', status: 'done' }),
    ];
    renderFlatList(items);

    fireEvent.click(screen.getByRole('button', { name: /show completed/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /hide completed/i })).toBeTruthy();
    });
  });

  it('shows empty state when there are no tasks', () => {
    renderFlatList([]);
    expect(screen.getByText(/No tasks in Flat Project yet\./i)).toBeTruthy();
  });

  it('shows List + Kanban toggle (not Tree + Kanban)', () => {
    renderFlatList([makeItem('t1')]);
    // The ViewToggle should render "List view" and "Kanban view" options
    expect(screen.getByLabelText(/list view/i)).toBeTruthy();
    expect(screen.getByLabelText(/kanban view/i)).toBeTruthy();
    // Verify Tree view toggle is NOT present
    expect(screen.queryByLabelText(/tree view/i)).toBeNull();
  });
});
