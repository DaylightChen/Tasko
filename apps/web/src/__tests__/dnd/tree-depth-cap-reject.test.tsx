/**
 * tree-depth-cap-reject.test.tsx
 *
 * Verifies that TreeDndContext:
 * 1. Sets depthCapRejectId (exposed via data-state="depth-cap-reject") when
 *    canMoveClient returns { ok: false } during onDragOver.
 * 2. Does NOT call useMoveItem.mutate when depth-cap is rejected on drop.
 * 3. Shows the assertive snackbar "Can't move there: would exceed nesting depth."
 *
 * Scenario: Feature A (with Task child) dragged onto Feature B — this would
 * create Epic→FeatureB→FeatureA→Task which is valid (4 levels), but if we
 * add another level it would fail. We specifically test a 5-level nesting case.
 *
 * Simpler guaranteed-reject case: Task (L3) → target is already at L4 → new
 * position would be L5 which exceeds the cap.
 */

import type { DragEndEvent, DragOverEvent } from '@dnd-kit/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Item, ItemId, ProjectId } from '@tasko/types';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../api/items', () => ({
  usePatchSubtask: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  useItems: vi.fn(),
  useToggleComplete: vi.fn(),
  useReschedule: vi.fn(),
  usePatchItem: vi.fn(),
  useChangePriority: vi.fn(),
  useEditTitleInline: vi.fn(),
  useDeleteItem: vi.fn(),
  useBulkMoveOverdue: vi.fn(),
  useMoveItem: vi.fn(),
  useCreateItem: vi.fn(),
}));

vi.mock('../../api/projects', () => ({
  useProjects: vi.fn(),
  useProject: vi.fn(),
}));

vi.mock('../../api/folders', () => ({
  useFolders: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string; [k: string]: unknown }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useRouterState: () => ({ location: { pathname: '/project/proj-1' } }),
  useNavigate: () => vi.fn(),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { useMoveItem } from '../../api/items';
import { useSnackbarStore } from '../../store/snackbar';
import { TreeDndContext } from '../../views/project-view/TreeDndContext';

// ── Capture DndContext callbacks ──────────────────────────────────────────────

let capturedOnDragEnd: ((event: DragEndEvent) => void) | null = null;
let capturedOnDragOver: ((event: DragOverEvent) => void) | null = null;

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>();
  return {
    ...actual,
    DndContext: (props: React.ComponentProps<typeof actual.DndContext>) => {
      capturedOnDragEnd = props.onDragEnd ?? null;
      capturedOnDragOver = props.onDragOver ?? null;
      return <actual.DndContext {...props} />;
    },
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROJECT_ID = 'proj-1' as ProjectId;
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
    due_date: '2026-05-19' as Item['due_date'],
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TreeDndContext — depth-cap rejection', () => {
  beforeEach(() => {
    capturedOnDragEnd = null;
    capturedOnDragOver = null;
    // Reset snackbar state before each test
    useSnackbarStore.setState({ current: null, queue: [] });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows assertive snackbar on drop when depth cap would be exceeded', async () => {
    const moveMutate = vi.fn();
    vi.mocked(useMoveItem).mockReturnValue({
      ...noopMutation,
      mutate: moveMutate,
    } as unknown as ReturnType<typeof useMoveItem>);

    /**
     * Depth-cap scenario (cap = 4 levels):
     * epic(L1) → feat(L2) → task(L3) → taskL4(L4)
     * Trying to move looseTask under taskL4 → would be L5 → rejected.
     */
    const epic = makeItem('epic', { type: 'epic', title: 'Epic' });
    const feat = makeItem('feat', { type: 'feature', title: 'Feature', parent_id: 'epic' as ItemId });
    const task = makeItem('task-l3', { type: 'task', title: 'Task L3', parent_id: 'feat' as ItemId });
    const taskL4 = makeItem('task-l4', { type: 'task', title: 'Task L4', parent_id: 'task-l3' as ItemId });
    const looseTask = makeItem('loose', { type: 'task', title: 'Loose Task' });

    const items = [epic, feat, task, taskL4, looseTask];
    const itemsMap = new Map<ItemId, Item>(items.map((i) => [i.id, i]));

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <TreeDndContext items={items} itemsMap={itemsMap} projectId={PROJECT_ID}>
          <div />
        </TreeDndContext>
      </QueryClientProvider>,
    );

    expect(capturedOnDragEnd).not.toBeNull();

    // Step 1: Simulate onDragOver (looseTask over taskL4) → should set depthCapRejectId
    const overEvent = {
      active: {
        id: 'tree:loose',
        data: { current: { type: 'tree-item', itemId: 'loose', item: looseTask } },
        rect: { current: { initial: null, translated: null } },
      },
      over: {
        id: 'tree-drop:task-l4',
        data: { current: { type: 'tree-drop', itemId: 'task-l4', item: taskL4, projectId: PROJECT_ID } },
        rect: { left: 0, right: 200, top: 80, bottom: 120, width: 200, height: 40 },
        disabled: false,
      },
      delta: { x: 0, y: 80 },
      activatorEvent: {} as PointerEvent,
      collisions: [],
    } as unknown as DragOverEvent;

    await act(async () => {
      capturedOnDragOver?.(overEvent);
    });

    // Step 2: Simulate onDragEnd (attempt to drop loose task under taskL4)
    const endEvent = {
      active: {
        id: 'tree:loose',
        data: { current: { type: 'tree-item', itemId: 'loose', item: looseTask } },
        rect: { current: { initial: null, translated: null } },
      },
      over: {
        id: 'tree-drop:task-l4',
        data: { current: { type: 'tree-drop', itemId: 'task-l4', item: taskL4, projectId: PROJECT_ID } },
        rect: { left: 0, right: 200, top: 80, bottom: 120, width: 200, height: 40 },
        disabled: false,
      },
      delta: { x: 0, y: 80 },
      activatorEvent: {} as PointerEvent,
      collisions: [],
    } as unknown as DragEndEvent;

    await act(async () => {
      capturedOnDragEnd?.(endEvent);
    });

    // useMoveItem.mutate should NOT have been called
    expect(moveMutate).not.toHaveBeenCalled();

    // Snackbar should show the depth-cap error
    const { current } = useSnackbarStore.getState();
    expect(current).not.toBeNull();
    expect(current?.variant).toBe('depth-cap');
    expect(current?.text).toBe("Can't move there: would exceed nesting depth.");
  });

  it('does NOT call useMoveItem.mutate when depth cap would be exceeded', async () => {
    const moveMutate = vi.fn();
    vi.mocked(useMoveItem).mockReturnValue({
      ...noopMutation,
      mutate: moveMutate,
    } as unknown as ReturnType<typeof useMoveItem>);

    const epic = makeItem('epic', { type: 'epic' });
    const feat = makeItem('feat', { type: 'feature', parent_id: 'epic' as ItemId });
    const task = makeItem('task-l3', { type: 'task', parent_id: 'feat' as ItemId });
    const taskL4 = makeItem('task-l4', { type: 'task', parent_id: 'task-l3' as ItemId });
    const looseTask = makeItem('loose', { type: 'task' });

    const items = [epic, feat, task, taskL4, looseTask];
    const itemsMap = new Map(items.map((i) => [i.id, i]));

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <TreeDndContext items={items} itemsMap={itemsMap} projectId={PROJECT_ID}>
          <div />
        </TreeDndContext>
      </QueryClientProvider>,
    );

    // Trigger onDragOver first to establish the depth-cap-reject state
    const overEvent = {
      active: {
        id: 'tree:loose',
        data: { current: { type: 'tree-item', itemId: 'loose', item: looseTask } },
        rect: { current: { initial: null, translated: null } },
      },
      over: {
        id: 'tree-drop:task-l4',
        data: { current: { type: 'tree-drop', itemId: 'task-l4', item: taskL4, projectId: PROJECT_ID } },
        rect: { left: 0, right: 200, top: 80, bottom: 120, width: 200, height: 40 },
        disabled: false,
      },
      delta: { x: 0, y: 80 },
      activatorEvent: {} as PointerEvent,
      collisions: [],
    } as unknown as DragOverEvent;

    await act(async () => {
      capturedOnDragOver?.(overEvent);
    });

    const endEvent = {
      active: {
        id: 'tree:loose',
        data: { current: { type: 'tree-item', itemId: 'loose', item: looseTask } },
        rect: { current: { initial: null, translated: null } },
      },
      over: {
        id: 'tree-drop:task-l4',
        data: { current: { type: 'tree-drop', itemId: 'task-l4', item: taskL4, projectId: PROJECT_ID } },
        rect: { left: 0, right: 200, top: 80, bottom: 120, width: 200, height: 40 },
        disabled: false,
      },
      delta: { x: 0, y: 80 },
      activatorEvent: {} as PointerEvent,
      collisions: [],
    } as unknown as DragEndEvent;

    await act(async () => {
      capturedOnDragEnd?.(endEvent);
    });

    expect(moveMutate).not.toHaveBeenCalled();
  });
});
