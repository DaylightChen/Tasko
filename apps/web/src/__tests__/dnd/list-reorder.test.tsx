/**
 * list-reorder.test.tsx
 *
 * Verifies that ListDndContext.onDragEnd calls patchItem.mutate with the
 * correct sparse-integer sort_order midpoint when a row is dragged.
 *
 * Strategy: render the ListDndContext, then invoke its onDragEnd callback
 * directly via the DndContext prop-capture technique.
 */

import type { DragEndEvent } from '@dnd-kit/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Item, ItemId, LocalDate } from '@tasko/types';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../api/items', () => ({
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

vi.mock('../../api/config', () => ({
  useConfig: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string; [k: string]: unknown }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useRouterState: () => ({ location: { pathname: '/today' } }),
  useNavigate: () => vi.fn(),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { usePatchItem } from '../../api/items';
import { ListDndContext } from '../../views/_shared/ListDndContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TODAY = '2026-05-19' as LocalDate;
const noopMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

function makeItem(id: string, sortOrder: number): Item {
  return {
    id: id as ItemId,
    schema_version: 1,
    type: 'task',
    project_id: 'proj-1' as Item['project_id'],
    parent_id: null,
    title: `Task ${id}`,
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
    sort_order: sortOrder,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

/**
 * Capture the onDragEnd prop from the inner DndContext.
 * We intercept DndContext's render to grab its props.
 */
let capturedOnDragEnd: ((event: DragEndEvent) => void) | null = null;

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>();
  return {
    ...actual,
    DndContext: (props: React.ComponentProps<typeof actual.DndContext>) => {
      capturedOnDragEnd = props.onDragEnd ?? null;
      return <actual.DndContext {...props} />;
    },
  };
});

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('ListDndContext — drag-end calls patchItem.mutate with correct sort_order', () => {
  beforeEach(() => {
    capturedOnDragEnd = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('PATCH sort_order to midpoint when row dragged up 2 positions', async () => {
    const patchMutate = vi.fn();
    vi.mocked(usePatchItem).mockReturnValue({
      ...noopMutation,
      mutate: patchMutate,
    } as unknown as ReturnType<typeof usePatchItem>);

    /**
     * 4 items sorted by sort_order:
     *   item-a: 1024, item-b: 2048, item-c: 3072, item-d: 4096
     *
     * Drag item-d (sort_order=4096) up 2 positions → over item-b (sort_order=2048).
     * After excluding item-d from sorted list: [1024, 2048, 3072]
     * overIndex (item-b's position in full sorted list) = 1
     * computeNewSortOrder([1024, 2048, 3072], 1) → floor((1024+2048)/2) = 1536
     */
    const items = [
      makeItem('item-a', 1024),
      makeItem('item-b', 2048),
      makeItem('item-c', 3072),
      makeItem('item-d', 4096),
    ];

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <ListDndContext items={items}>
          <div data-testid="content" />
        </ListDndContext>
      </QueryClientProvider>,
    );

    expect(capturedOnDragEnd).not.toBeNull();

    // Simulate: drag item-d over item-b
    const event = {
      active: {
        id: 'item-d',
        data: { current: { type: 'task', itemId: 'item-d' } },
        rect: { current: { initial: null, translated: null } },
      },
      over: {
        id: 'item-b',
        data: { current: { type: 'task', itemId: 'item-b' } },
        rect: { left: 0, right: 100, top: 0, bottom: 40, width: 100, height: 40 },
        disabled: false,
      },
      delta: { x: 0, y: -100 },
      activatorEvent: { clientY: 300 } as PointerEvent,
      collisions: [],
    } as unknown as DragEndEvent;

    await act(async () => {
      capturedOnDragEnd?.(event);
    });

    expect(patchMutate).toHaveBeenCalledOnce();
    expect(patchMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'item-d',
        patch: expect.objectContaining({ sort_order: 1536 }),
      }),
    );
  });

  it('does NOT call patchItem.mutate when active.id === over.id', async () => {
    const patchMutate = vi.fn();
    vi.mocked(usePatchItem).mockReturnValue({
      ...noopMutation,
      mutate: patchMutate,
    } as unknown as ReturnType<typeof usePatchItem>);

    const items = [makeItem('item-a', 1024), makeItem('item-b', 2048)];

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <ListDndContext items={items}>
          <div />
        </ListDndContext>
      </QueryClientProvider>,
    );

    const noOpEvent = {
      active: {
        id: 'item-a',
        data: { current: { type: 'task', itemId: 'item-a' } },
        rect: { current: { initial: null, translated: null } },
      },
      over: {
        id: 'item-a', // Same as active — no-op
        data: { current: { type: 'task', itemId: 'item-a' } },
        rect: { left: 0, right: 100, top: 0, bottom: 40, width: 100, height: 40 },
        disabled: false,
      },
      delta: { x: 0, y: 0 },
      activatorEvent: {} as PointerEvent,
      collisions: [],
    } as unknown as DragEndEvent;

    await act(async () => {
      capturedOnDragEnd?.(noOpEvent);
    });

    expect(patchMutate).not.toHaveBeenCalled();
  });

  it('does NOT call patchItem.mutate when dropped with no over target', async () => {
    const patchMutate = vi.fn();
    vi.mocked(usePatchItem).mockReturnValue({
      ...noopMutation,
      mutate: patchMutate,
    } as unknown as ReturnType<typeof usePatchItem>);

    const items = [makeItem('item-a', 1024), makeItem('item-b', 2048)];

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <ListDndContext items={items}>
          <div />
        </ListDndContext>
      </QueryClientProvider>,
    );

    const cancelEvent = {
      active: {
        id: 'item-a',
        data: { current: { type: 'task', itemId: 'item-a' } },
        rect: { current: { initial: null, translated: null } },
      },
      over: null, // Dropped outside any target
      delta: { x: 0, y: 0 },
      activatorEvent: {} as PointerEvent,
      collisions: [],
    } as unknown as DragEndEvent;

    await act(async () => {
      capturedOnDragEnd?.(cancelEvent);
    });

    expect(patchMutate).not.toHaveBeenCalled();
  });
});
