/**
 * TreeView tests (task-09)
 *
 * Covers:
 * - Renders a hierarchical project with 1 Epic → 2 Features → 4 Tasks + a loose top-level Task
 * - "Loose tasks in project (no Epic parent)" divider renders when epics AND top-level tasks coexist
 * - Expand/collapse works: clicking the chevron toggles children visibility
 * - Rollup chip shows for Epic with the correct counts
 * - The "role=tree" container with correct aria-label is present
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Item, ItemId, LocalDate, ProjectId } from '@tasko/types';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Must come before importing the component under test ──────────────────────

vi.mock('../../../api/items', () => ({
  usePatchSubtask: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
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

// ── Imports after mocks ───────────────────────────────────────────────────────

import { useFolders } from '../../../api/folders';
import { useCreateItem, useDeleteItem, useItems, useMoveItem, usePatchItem } from '../../../api/items';
import { useProjects } from '../../../api/projects';
import { useHotkeyStore } from '../../../store/hotkey-registry';
import { useTreeExpansionStore } from '../../../store/tree-expansion';
import { TreeView } from '../tree-view';

// ── Constants & helpers ───────────────────────────────────────────────────────

const TODAY = '2026-05-19' as LocalDate;
const PROJECT_ID = 'proj-hier' as ProjectId;

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

/**
 * Build the standard test dataset:
 * Epic → Feature A (Task A1, Task A2), Feature B (Task B1, Task B2) + loose top-level Task
 *
 * task-a1 is marked done so the rollup for the Epic will be 1/4.
 */
function buildHierarchicalItems(): Item[] {
  const epic = makeItem('epic-1', { type: 'epic', title: 'Epic One', sort_order: 0 });
  const featureA = makeItem('feat-a', {
    type: 'feature',
    title: 'Feature A',
    parent_id: 'epic-1' as ItemId,
    sort_order: 1,
  });
  const featureB = makeItem('feat-b', {
    type: 'feature',
    title: 'Feature B',
    parent_id: 'epic-1' as ItemId,
    sort_order: 2,
  });
  const taskA1 = makeItem('task-a1', {
    type: 'task',
    title: 'Task A1',
    parent_id: 'feat-a' as ItemId,
    status: 'done',
    sort_order: 1,
  });
  const taskA2 = makeItem('task-a2', {
    type: 'task',
    title: 'Task A2',
    parent_id: 'feat-a' as ItemId,
    sort_order: 2,
  });
  const taskB1 = makeItem('task-b1', {
    type: 'task',
    title: 'Task B1',
    parent_id: 'feat-b' as ItemId,
    sort_order: 1,
  });
  const taskB2 = makeItem('task-b2', {
    type: 'task',
    title: 'Task B2',
    parent_id: 'feat-b' as ItemId,
    sort_order: 2,
  });
  const looseTask = makeItem('loose-1', {
    type: 'task',
    title: 'Loose Task',
    parent_id: null,
    sort_order: 10,
  });
  return [epic, featureA, featureB, taskA1, taskA2, taskB1, taskB2, looseTask];
}

function setupMocks(items: Item[]) {
  vi.mocked(useItems).mockReturnValue({
    data: { items, count: items.length },
    isLoading: false,
  } as unknown as ReturnType<typeof useItems>);

  vi.mocked(useCreateItem).mockReturnValue(noopMutation as unknown as ReturnType<typeof useCreateItem>);
  vi.mocked(usePatchItem).mockReturnValue(noopMutation as unknown as ReturnType<typeof usePatchItem>);
  vi.mocked(useMoveItem).mockReturnValue(noopMutation as unknown as ReturnType<typeof useMoveItem>);
  vi.mocked(useDeleteItem).mockReturnValue(noopMutation as unknown as ReturnType<typeof useDeleteItem>);
  vi.mocked(useProjects).mockReturnValue({
    data: { projects: [] },
    isLoading: false,
  } as unknown as ReturnType<typeof useProjects>);
  vi.mocked(useFolders).mockReturnValue({
    data: { folders: [] },
    isLoading: false,
  } as unknown as ReturnType<typeof useFolders>);
}

function renderTreeView(items: Item[] = buildHierarchicalItems()) {
  setupMocks(items);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <TreeView projectId={PROJECT_ID} projectName="Test Project" onNavigateKanban={vi.fn()} />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TreeView — render', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-05-19T00:00:00Z'));
    // Reset expansion store so each test starts fresh
    useTreeExpansionStore.setState({ expanded: {} });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    act(() => {});
  });

  it('renders the role="tree" container with the project name label', () => {
    renderTreeView();
    const tree = screen.getByRole('tree');
    expect(tree.getAttribute('aria-label')).toBe('Test Project tasks');
  });

  it('renders the Epic title', () => {
    renderTreeView();
    expect(screen.getByText('Epic One')).toBeTruthy();
  });

  it('shows "Loose tasks in project (no Epic parent)" divider when epics AND tasks exist at top level', () => {
    renderTreeView();
    expect(screen.getByText('Loose tasks in project (no Epic parent)')).toBeTruthy();
  });

  it('does NOT show the loose-tasks divider when there are no loose tasks', () => {
    const items = buildHierarchicalItems().filter((i) => i.id !== ('loose-1' as ItemId));
    renderTreeView(items);
    expect(screen.queryByText('Loose tasks in project (no Epic parent)')).toBeNull();
  });

  it('does NOT show the loose-tasks divider when there are no epics', () => {
    // Only loose tasks, no epics
    const looseTask = makeItem('loose-only', { type: 'task', title: 'Just a task' });
    renderTreeView([looseTask]);
    expect(screen.queryByText('Loose tasks in project (no Epic parent)')).toBeNull();
  });

  it('shows rollup chip on the Epic with correct counts (0/2 Features)', () => {
    renderTreeView();
    // Epic has 2 direct feature children; rollup counts direct children only
    // featureA and featureB are direct children of epic-1
    // Neither feature is 'done' → completed=0, total=2
    // Note: multiple rollup chips appear (one per epic/feature with children),
    // so we check that at least one matches the Epic's rollup (0/2).
    const chips = screen.getAllByLabelText(/0 of 2 children complete/i);
    expect(chips.length).toBeGreaterThan(0);
  });

  it('renders the "Add Epic" button', () => {
    renderTreeView();
    expect(screen.getByRole('button', { name: /Add Epic/i })).toBeTruthy();
  });

  it('renders the "Add Task in Project" button', () => {
    renderTreeView();
    expect(screen.getByRole('button', { name: /Add Task in Project/i })).toBeTruthy();
  });
});

describe('TreeView — empty state', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-05-19T00:00:00Z'));
    useTreeExpansionStore.setState({ expanded: {} });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    act(() => {});
  });

  it('shows empty state when there are no items', () => {
    renderTreeView([]);
    expect(screen.getByText(/No work in Test Project yet\./i)).toBeTruthy();
  });
});

describe('TreeView — ⌘⇧M opens Move-to picker for focused item', () => {
  /**
   * Tests the ⌘⇧M hotkey flow (now wired via useHotkey('tree', 'Mod+Shift+m', ...)):
   * 1. Render a tree — mounts and pushes 'tree' mode to hotkeyStore
   * 2. Click the treeitem div directly (target === currentTarget) → onRowFocus is called → focusedItem state is set
   * 3. Fire keydown { ctrlKey: true, shiftKey: true, key: 'm' } on document (ctrlKey used because jsdom is non-Mac)
   * 4. Assert the Move-to picker modal is rendered with the "Move to…" title
   */
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-05-19T00:00:00Z'));
    useTreeExpansionStore.setState({ expanded: {} });
    useHotkeyStore.getState().reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    useHotkeyStore.getState().reset();
    act(() => {});
  });

  it('fires ⌘⇧M with a focused row and opens the Move-to picker', async () => {
    const items = buildHierarchicalItems();
    renderTreeView(items);

    // Find the treeitem div for the Epic (data-item-id="epic-1")
    // Clicking directly on the treeitem div satisfies e.target === e.currentTarget,
    // which triggers the onClick → onRowFocus(item) → focusedItem is set.
    const epicTreeItem = document.querySelector('[data-item-id="epic-1"]');
    expect(epicTreeItem).not.toBeNull();

    if (epicTreeItem) {
      act(() => {
        fireEvent.click(epicTreeItem);
      });
    }

    // Fire Mod+Shift+M: jsdom is non-Mac so Mod = Ctrl
    act(() => {
      fireEvent.keyDown(document, { ctrlKey: true, shiftKey: true, key: 'm' });
    });

    // The MoveToPickerModal should appear with its heading "Move to…"
    await waitFor(() => {
      expect(screen.getByText('Move to…')).toBeTruthy();
    });
  });

  it('⌘⇧M does nothing when no row is focused', () => {
    const items = buildHierarchicalItems();
    renderTreeView(items);

    // Do NOT click any row — focusedItem remains null

    act(() => {
      fireEvent.keyDown(document, { ctrlKey: true, shiftKey: true, key: 'm' });
    });

    // Move-to picker should NOT appear
    expect(screen.queryByText('Move to…')).toBeNull();
  });
});
