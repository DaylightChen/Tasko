/**
 * tree-reparent.test.tsx
 *
 * Verifies that TreeDndContext.onDragEnd calls useMoveItem.mutate with
 * the correct new_parent_id when a Task is dragged from Feature A to Feature B.
 *
 * Strategy: render TreeDndContext, capture onDragEnd via DndContext mock,
 * invoke it with a synthetic DragEndEvent.
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
import { useUndoStore } from '../../store/undo';
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

describe('TreeDndContext — tree reparent via drag', () => {
  beforeEach(() => {
    capturedOnDragEnd = null;
    capturedOnDragOver = null;
    useSnackbarStore.setState({ current: null, queue: [] });
    useUndoStore.getState().clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    useSnackbarStore.setState({ current: null, queue: [] });
    useUndoStore.getState().clear();
  });

  it('calls useMoveItem.mutate with new_parent_id when Task dragged from Feature A to Feature B', async () => {
    const moveMutate = vi.fn((_args, options) => {
      // Simulate successful mutation to trigger onSuccess callback
      options?.onSuccess?.();
    });
    vi.mocked(useMoveItem).mockReturnValue({
      ...noopMutation,
      mutate: moveMutate,
    } as unknown as ReturnType<typeof useMoveItem>);

    // Items: Feature A, Feature B (both under project root), Task under Feature A
    const featureA = makeItem('feat-a', { type: 'feature', title: 'Feature A', sort_order: 1 });
    const featureB = makeItem('feat-b', { type: 'feature', title: 'Feature B', sort_order: 2 });
    const taskUnderA = makeItem('task-1', {
      type: 'task',
      title: 'Task 1',
      parent_id: 'feat-a' as ItemId,
      sort_order: 1,
    });

    const items = [featureA, featureB, taskUnderA];
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

    // First simulate onDragOver to ensure no depth-cap reject is set
    // (canMoveClient: task under feature = ok)
    const overEvent = {
      active: {
        id: 'tree:task-1',
        data: { current: { type: 'tree-item', itemId: 'task-1', item: taskUnderA } },
        rect: { current: { initial: null, translated: null } },
      },
      over: {
        id: 'tree-drop:feat-b',
        data: { current: { type: 'tree-drop', itemId: 'feat-b', item: featureB, projectId: PROJECT_ID } },
        rect: { left: 0, right: 200, top: 40, bottom: 80, width: 200, height: 40 },
        disabled: false,
      },
      delta: { x: 0, y: 40 },
      activatorEvent: {} as PointerEvent,
      collisions: [],
    } as unknown as DragOverEvent;

    await act(async () => {
      capturedOnDragOver?.(overEvent);
    });

    // Now simulate onDragEnd: drop task-1 onto feat-b
    const endEvent = {
      active: {
        id: 'tree:task-1',
        data: { current: { type: 'tree-item', itemId: 'task-1', item: taskUnderA } },
        rect: { current: { initial: null, translated: null } },
      },
      over: {
        id: 'tree-drop:feat-b',
        data: { current: { type: 'tree-drop', itemId: 'feat-b', item: featureB, projectId: PROJECT_ID } },
        rect: { left: 0, right: 200, top: 40, bottom: 80, width: 200, height: 40 },
        disabled: false,
      },
      delta: { x: 0, y: 40 },
      activatorEvent: {} as PointerEvent,
      collisions: [],
    } as unknown as DragEndEvent;

    await act(async () => {
      capturedOnDragEnd?.(endEvent);
    });

    expect(moveMutate).toHaveBeenCalledOnce();
    expect(moveMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-1',
        new_parent_id: 'feat-b',
      }),
      expect.anything(),
    );
  });

  it('does NOT call useMoveItem.mutate when dropped with no over target', async () => {
    const moveMutate = vi.fn();
    vi.mocked(useMoveItem).mockReturnValue({
      ...noopMutation,
      mutate: moveMutate,
    } as unknown as ReturnType<typeof useMoveItem>);

    const featureA = makeItem('feat-a', { type: 'feature' });
    const taskUnderA = makeItem('task-1', { type: 'task', parent_id: 'feat-a' as ItemId });
    const items = [featureA, taskUnderA];
    const itemsMap = new Map(items.map((i) => [i.id, i]));

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <TreeDndContext items={items} itemsMap={itemsMap} projectId={PROJECT_ID}>
          <div />
        </TreeDndContext>
      </QueryClientProvider>,
    );

    const event = {
      active: {
        id: 'tree:task-1',
        data: { current: { type: 'tree-item', itemId: 'task-1', item: taskUnderA } },
        rect: { current: { initial: null, translated: null } },
      },
      over: null,
      delta: { x: 0, y: 0 },
      activatorEvent: {} as PointerEvent,
      collisions: [],
    } as unknown as DragEndEvent;

    await act(async () => {
      capturedOnDragEnd?.(event);
    });

    expect(moveMutate).not.toHaveBeenCalled();
  });

  it('pushes undo entry and shows snackbar with Undo action on successful reparent', async () => {
    const moveMutate = vi.fn((_args, options) => {
      // Simulate successful mutation to trigger onSuccess callback
      options?.onSuccess?.();
    });
    vi.mocked(useMoveItem).mockReturnValue({
      ...noopMutation,
      mutate: moveMutate,
    } as unknown as ReturnType<typeof useMoveItem>);

    const featureA = makeItem('feat-a', { type: 'feature', title: 'Feature A', sort_order: 1 });
    const featureB = makeItem('feat-b', { type: 'feature', title: 'Feature B', sort_order: 2 });
    const taskUnderA = makeItem('task-1', {
      type: 'task',
      title: 'Task 1',
      parent_id: 'feat-a' as ItemId,
      sort_order: 1,
    });

    const items = [featureA, featureB, taskUnderA];
    const itemsMap = new Map<ItemId, Item>(items.map((i) => [i.id, i]));

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <TreeDndContext items={items} itemsMap={itemsMap} projectId={PROJECT_ID}>
          <div />
        </TreeDndContext>
      </QueryClientProvider>,
    );

    // Simulate dragOver first (no depth-cap violation)
    const overEvent = {
      active: {
        id: 'tree:task-1',
        data: { current: { type: 'tree-item', itemId: 'task-1', item: taskUnderA } },
        rect: { current: { initial: null, translated: null } },
      },
      over: {
        id: 'tree-drop:feat-b',
        data: { current: { type: 'tree-drop', itemId: 'feat-b', item: featureB, projectId: PROJECT_ID } },
        rect: { left: 0, right: 200, top: 40, bottom: 80, width: 200, height: 40 },
        disabled: false,
      },
      delta: { x: 0, y: 40 },
      activatorEvent: {} as PointerEvent,
      collisions: [],
    } as unknown as DragOverEvent;

    await act(async () => {
      capturedOnDragOver?.(overEvent);
    });

    // Simulate drop
    const endEvent = {
      active: {
        id: 'tree:task-1',
        data: { current: { type: 'tree-item', itemId: 'task-1', item: taskUnderA } },
        rect: { current: { initial: null, translated: null } },
      },
      over: {
        id: 'tree-drop:feat-b',
        data: { current: { type: 'tree-drop', itemId: 'feat-b', item: featureB, projectId: PROJECT_ID } },
        rect: { left: 0, right: 200, top: 40, bottom: 80, width: 200, height: 40 },
        disabled: false,
      },
      delta: { x: 0, y: 40 },
      activatorEvent: {} as PointerEvent,
      collisions: [],
    } as unknown as DragEndEvent;

    await act(async () => {
      capturedOnDragEnd?.(endEvent);
    });

    // Undo store must have an entry after successful reparent
    const undoEntry = useUndoStore.getState().current;
    expect(undoEntry).not.toBeNull();

    // Snackbar must have an Undo action
    const snackbar = useSnackbarStore.getState().current;
    expect(snackbar).not.toBeNull();
    expect(snackbar?.action?.label).toBe('Undo');
    expect(snackbar?.text).toContain('Task moved to');
  });

  it('calling undo pop after reparent re-moves the item to its original parent', async () => {
    const moveMutate = vi.fn((_args, options) => {
      options?.onSuccess?.();
    });
    vi.mocked(useMoveItem).mockReturnValue({
      ...noopMutation,
      mutate: moveMutate,
    } as unknown as ReturnType<typeof useMoveItem>);

    const featureA = makeItem('feat-a', { type: 'feature', title: 'Feature A', sort_order: 1 });
    const featureB = makeItem('feat-b', { type: 'feature', title: 'Feature B', sort_order: 2 });
    const taskUnderA = makeItem('task-1', {
      type: 'task',
      title: 'Task 1',
      parent_id: 'feat-a' as ItemId,
      sort_order: 1,
    });

    const items = [featureA, featureB, taskUnderA];
    const itemsMap = new Map<ItemId, Item>(items.map((i) => [i.id, i]));

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <TreeDndContext items={items} itemsMap={itemsMap} projectId={PROJECT_ID}>
          <div />
        </TreeDndContext>
      </QueryClientProvider>,
    );

    // Perform the drag sequence
    const overEvent = {
      active: {
        id: 'tree:task-1',
        data: { current: { type: 'tree-item', itemId: 'task-1', item: taskUnderA } },
        rect: { current: { initial: null, translated: null } },
      },
      over: {
        id: 'tree-drop:feat-b',
        data: { current: { type: 'tree-drop', itemId: 'feat-b', item: featureB, projectId: PROJECT_ID } },
        rect: { left: 0, right: 200, top: 40, bottom: 80, width: 200, height: 40 },
        disabled: false,
      },
      delta: { x: 0, y: 40 },
      activatorEvent: {} as PointerEvent,
      collisions: [],
    } as unknown as DragOverEvent;

    const endEvent = {
      ...overEvent,
    } as unknown as DragEndEvent;

    await act(async () => {
      capturedOnDragOver?.(overEvent);
    });
    await act(async () => {
      capturedOnDragEnd?.(endEvent);
    });

    // First moveItem call is the reparent itself
    expect(moveMutate).toHaveBeenCalledOnce();

    // Invoke undo — should call moveItem again with original parent
    await act(async () => {
      useUndoStore.getState().pop();
    });

    expect(moveMutate).toHaveBeenCalledTimes(2);
    expect(moveMutate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        id: 'task-1',
        new_parent_id: 'feat-a', // original parent
      }),
    );

    // Undo entry cleared after pop
    expect(useUndoStore.getState().current).toBeNull();
  });
});
