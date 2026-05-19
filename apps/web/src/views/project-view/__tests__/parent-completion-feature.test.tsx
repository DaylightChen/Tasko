/**
 * parent-completion-feature.test.tsx (task-09)
 *
 * Covers:
 * - Feature with 3 incomplete Tasks → right-click menu → "Mark complete"
 *   → ConfirmationPrompt title "Complete all children and continue?"
 *   → ConfirmationPrompt body: "This feature has 3 incomplete tasks. Completing it will mark them all done."
 *   → Primary button labeled "Complete all"
 * - Confirming → patchItem.mutate called for the Feature + all 3 Tasks (4 total calls)
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
  useRouterState: () => ({ location: { pathname: '/project/proj-hier' } }),
  useNavigate: () => vi.fn(),
}));

import { useCreateItem, useItems, useMoveItem, usePatchItem } from '../../../api/items';
import { useProjects } from '../../../api/projects';
import { useTreeExpansionStore } from '../../../store/tree-expansion';
import { TreeView } from '../tree-view';

const TODAY = '2026-05-19' as LocalDate;
const PROJECT_ID = 'proj-hier' as ProjectId;

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

describe('TreeView — parent completion blocking for Feature', () => {
  let patchMutateMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.setSystemTime(new Date('2026-05-19T00:00:00Z'));
    useTreeExpansionStore.setState({ expanded: {} });

    patchMutateMock = vi.fn();

    vi.mocked(usePatchItem).mockReturnValue({
      mutate: patchMutateMock,
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof usePatchItem>);

    vi.mocked(useCreateItem).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useCreateItem>);

    vi.mocked(useMoveItem).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useMoveItem>);

    vi.mocked(useProjects).mockReturnValue({
      data: { projects: [] },
      isLoading: false,
    } as unknown as ReturnType<typeof useProjects>);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    act(() => {});
  });

  function buildFeatureWithTasks() {
    const epic = makeItem('epic-1', {
      type: 'epic',
      title: 'Epic',
      sort_order: 0,
    });
    const feature = makeItem('feat-1', {
      type: 'feature',
      title: 'My Feature',
      parent_id: 'epic-1' as ItemId,
      sort_order: 1,
    });
    const task1 = makeItem('task-1', {
      type: 'task',
      title: 'Task 1',
      parent_id: 'feat-1' as ItemId,
      status: 'todo',
      sort_order: 1,
    });
    const task2 = makeItem('task-2', {
      type: 'task',
      title: 'Task 2',
      parent_id: 'feat-1' as ItemId,
      status: 'todo',
      sort_order: 2,
    });
    const task3 = makeItem('task-3', {
      type: 'task',
      title: 'Task 3',
      parent_id: 'feat-1' as ItemId,
      status: 'todo',
      sort_order: 3,
    });
    return [epic, feature, task1, task2, task3];
  }

  function renderTreeView(items: Item[]) {
    vi.mocked(useItems).mockReturnValue({
      data: { items, count: items.length },
      isLoading: false,
    } as unknown as ReturnType<typeof useItems>);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={queryClient}>
        <TreeView projectId={PROJECT_ID} projectName="Hier Project" onNavigateKanban={vi.fn()} />
      </QueryClientProvider>,
    );
  }

  it('right-clicking a Feature shows a context menu with "Mark complete"', async () => {
    const items = buildFeatureWithTasks();
    renderTreeView(items);

    // Find the Feature row element
    // The tree renders the feature; context-menu is triggered via right-click on the wrapper
    const featureTitle = screen.getByText('My Feature');
    const featureRow = featureTitle.closest('[data-type="feature"]') ?? featureTitle;

    fireEvent.contextMenu(featureRow);

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /mark complete/i })).toBeTruthy();
    });
  });

  it('clicking "Mark complete" on a Feature shows ConfirmationPrompt with correct title, body, and confirm label', async () => {
    const items = buildFeatureWithTasks();
    renderTreeView(items);

    const featureTitle = screen.getByText('My Feature');
    const featureRow = featureTitle.closest('[data-type="feature"]') ?? featureTitle;

    fireEvent.contextMenu(featureRow);

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /mark complete/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('menuitem', { name: /mark complete/i }));

    await waitFor(() => {
      // Title
      expect(screen.getByText('Complete all children and continue?')).toBeTruthy();
      // Full two-sentence body per microcopy §6.1
      expect(
        screen.getByText('This feature has 3 incomplete tasks. Completing it will mark them all done.'),
      ).toBeTruthy();
      // Primary confirm button is labeled "Complete all"
      expect(screen.getByRole('button', { name: /complete all$/i })).toBeTruthy();
    });
  });

  it('confirming parent completion calls patchItem for Feature + all 3 incomplete Tasks', async () => {
    const items = buildFeatureWithTasks();
    renderTreeView(items);

    const featureTitle = screen.getByText('My Feature');
    const featureRow = featureTitle.closest('[data-type="feature"]') ?? featureTitle;

    // Open context menu
    fireEvent.contextMenu(featureRow);
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /mark complete/i })).toBeTruthy();
    });

    // Click "Mark complete"
    fireEvent.click(screen.getByRole('menuitem', { name: /mark complete/i }));

    await waitFor(() => {
      expect(
        screen.getByText('This feature has 3 incomplete tasks. Completing it will mark them all done.'),
      ).toBeTruthy();
    });

    // Find and click the Confirm button — labeled "Complete all"
    const confirmBtn = screen.getByRole('button', { name: /complete all$/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      // Should have been called 4 times: 1 for feature + 3 for tasks
      expect(patchMutateMock).toHaveBeenCalledTimes(4);
    });

    // All calls should set status: 'done'
    for (const call of patchMutateMock.mock.calls) {
      expect(call[0].patch.status).toBe('done');
    }

    // The feature itself should be one of the patched items
    const patchedIds = patchMutateMock.mock.calls.map((c) => c[0].id);
    expect(patchedIds).toContain('feat-1');
    expect(patchedIds).toContain('task-1');
    expect(patchedIds).toContain('task-2');
    expect(patchedIds).toContain('task-3');
  });
});
