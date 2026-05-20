/**
 * TreeView add-flow tests (task-09)
 *
 * Covers:
 * - Click "+ Add Epic" → inline TextInput appears
 * - Type text + Enter → createItem.mutate called with { type: 'epic', parent_id: null, project_id, title, due_date: today }
 * - Click "+ Add Task in Project" → taskModalStore.openNew called with initialProjectId
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Item, ItemId, LocalDate, ProjectId } from '@tasko/types';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api/items', () => ({
  useItems: vi.fn(),
  useCreateItem: vi.fn(),
  usePatchItem: vi.fn(),
  useMoveItem: vi.fn(),
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

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string; [k: string]: unknown }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useRouterState: () => ({ location: { pathname: '/project/proj-add' } }),
  useNavigate: () => vi.fn(),
}));

import { useCreateItem, useItems, useMoveItem, usePatchItem } from '../../../api/items';
import { useFolders } from '../../../api/folders';
import { useProjects } from '../../../api/projects';
import { useTaskModalStore } from '../../../store/task-modal';
import { useTreeExpansionStore } from '../../../store/tree-expansion';
import { TreeView } from '../tree-view';

const TODAY = '2026-05-19' as LocalDate;
const PROJECT_ID = 'proj-add' as ProjectId;

const noopMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

function makeItem(id: string, overrides: Partial<Item> = {}): Item {
  return {
    id: id as ItemId,
    schema_version: 1,
    type: overrides.type ?? 'task',
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

function setupMocks(items: Item[], createMutateFn = vi.fn()) {
  vi.mocked(useItems).mockReturnValue({
    data: { items, count: items.length },
    isLoading: false,
  } as unknown as ReturnType<typeof useItems>);

  vi.mocked(useCreateItem).mockReturnValue({
    mutate: createMutateFn,
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useCreateItem>);
  vi.mocked(usePatchItem).mockReturnValue(noopMutation as unknown as ReturnType<typeof usePatchItem>);
  vi.mocked(useMoveItem).mockReturnValue(noopMutation as unknown as ReturnType<typeof useMoveItem>);
  vi.mocked(useProjects).mockReturnValue({
    data: { projects: [] },
    isLoading: false,
  } as unknown as ReturnType<typeof useProjects>);
  vi.mocked(useFolders).mockReturnValue({
    data: { folders: [] },
    isLoading: false,
  } as unknown as ReturnType<typeof useFolders>);
}

function renderTreeView(items: Item[], createMutateFn?: ReturnType<typeof vi.fn>) {
  setupMocks(items, createMutateFn);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <TreeView projectId={PROJECT_ID} projectName="Add Flow Project" onNavigateKanban={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe('TreeView — add flows', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-05-19T00:00:00Z'));
    useTreeExpansionStore.setState({ expanded: {} });
    // Reset task modal store
    useTaskModalStore.setState({ mode: 'closed' });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    act(() => {});
    useTaskModalStore.setState({ mode: 'closed' });
  });

  it('clicking "+ Add Epic" shows an inline text input', async () => {
    renderTreeView([]);

    const addEpicBtn = screen.getByRole('button', { name: /Add Epic/i });
    fireEvent.click(addEpicBtn);

    await waitFor(() => {
      // The inline add row should show a placeholder "Epic name…" input
      const inputs = screen.queryAllByPlaceholderText(/epic name/i);
      expect(inputs.length).toBeGreaterThan(0);
    });
  });

  it('typing in the inline Epic input and pressing Enter calls createItem with correct args', async () => {
    const createMutate = vi.fn();
    renderTreeView([], createMutate);

    // Click "+ Add Epic"
    const addEpicBtn = screen.getByRole('button', { name: /Add Epic/i });
    fireEvent.click(addEpicBtn);

    await waitFor(() => {
      expect(screen.queryAllByPlaceholderText(/epic name/i).length).toBeGreaterThan(0);
    });

    const input = screen.getByPlaceholderText(/epic name/i);
    fireEvent.change(input, { target: { value: 'Q3 Launch' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(createMutate).toHaveBeenCalledOnce();
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const callArgs = createMutate.mock.calls[0]?.[0] as {
      type: string;
      title: string;
      parent_id: string | null;
      project_id: string;
      due_date: string;
    };
    expect(callArgs).toBeDefined();
    expect(callArgs.type).toBe('epic');
    expect(callArgs.title).toBe('Q3 Launch');
    expect(callArgs.parent_id).toBeNull();
    expect(callArgs.project_id).toBe(PROJECT_ID);
    // due_date should be today (2026-05-19)
    expect(callArgs.due_date).toBe('2026-05-19');
  });

  it('Escape in the inline input cancels without creating', async () => {
    const createMutate = vi.fn();
    renderTreeView([], createMutate);

    fireEvent.click(screen.getByRole('button', { name: /Add Epic/i }));

    await waitFor(() => {
      expect(screen.queryAllByPlaceholderText(/epic name/i).length).toBeGreaterThan(0);
    });

    const input = screen.getByPlaceholderText(/epic name/i);
    fireEvent.change(input, { target: { value: 'Cancelled Epic' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryAllByPlaceholderText(/epic name/i).length).toBe(0);
    });

    expect(createMutate).not.toHaveBeenCalled();
  });

  it('clicking "+ Add Task in Project" opens the task modal with initialProjectId', () => {
    // The "+ Add Task in Project" button is only rendered in the non-empty state header.
    // Provide a non-empty item list so the full header renders.
    const epicItem = makeItem('epic-1', { type: 'epic', title: 'An Epic', sort_order: 0 });
    renderTreeView([epicItem]);

    // Reset modal state just before the interaction
    useTaskModalStore.setState({ mode: 'closed' });

    const addTaskBtn = screen.getByRole('button', { name: /Add Task in Project/i });
    fireEvent.click(addTaskBtn);

    const state = useTaskModalStore.getState();
    expect(state.mode).toBe('new');
    expect(state.initialProjectId).toBe(PROJECT_ID);
  });
});
