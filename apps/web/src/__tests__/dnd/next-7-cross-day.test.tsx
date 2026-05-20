/**
 * next-7-cross-day.test.tsx
 *
 * Verifies that Next7DndContext.onDragEnd calls useReschedule.mutate with
 * the target date when a row is dragged from Wed's group to Fri's group.
 */

import type { DragEndEvent } from '@dnd-kit/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Item, ItemId, LocalDate } from '@tasko/types';
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
  useRouterState: () => ({ location: { pathname: '/next-7' } }),
  useNavigate: () => vi.fn(),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { usePatchItem, useReschedule } from '../../api/items';
import { Next7DndContext } from '../../views/next-7-view/Next7DndContext';

// ── Capture DndContext callbacks ──────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

const noopMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

const WED_DATE = '2026-05-20' as LocalDate; // Wednesday
const FRI_DATE = '2026-05-22' as LocalDate; // Friday

function makeItem(id: string, dueDate: LocalDate): Item {
  return {
    id: id as ItemId,
    schema_version: 1,
    type: 'task',
    project_id: 'proj-1' as Item['project_id'],
    parent_id: null,
    title: `Task ${id}`,
    notes: '',
    due_date: dueDate,
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
    sort_order: 1024,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Next7DndContext — cross-day drag reschedules due_date', () => {
  beforeEach(() => {
    capturedOnDragEnd = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls reschedule.mutate with the target date when row dragged from Wed to Fri', async () => {
    const rescheduleMutate = vi.fn();
    vi.mocked(useReschedule).mockReturnValue({
      ...noopMutation,
      mutate: rescheduleMutate,
    } as unknown as ReturnType<typeof useReschedule>);

    vi.mocked(usePatchItem).mockReturnValue({
      ...noopMutation,
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof usePatchItem>);

    const wedItem = makeItem('wed-task', WED_DATE);
    const friItem = makeItem('fri-task', FRI_DATE);
    const allItems = [wedItem, friItem];

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <Next7DndContext allItems={allItems}>
          <div />
        </Next7DndContext>
      </QueryClientProvider>,
    );

    expect(capturedOnDragEnd).not.toBeNull();

    // Simulate: drag wed-task (in Wed group) onto the Fri day zone
    const event = {
      active: {
        id: `wed-task:${WED_DATE}`,
        data: {
          current: {
            type: 'next7-task',
            itemId: 'wed-task',
            groupDate: WED_DATE,
          },
        },
        rect: { current: { initial: null, translated: null } },
      },
      over: {
        id: `day:${FRI_DATE}`,
        data: {
          current: { type: 'day', date: FRI_DATE },
        },
        rect: { left: 0, right: 200, top: 200, bottom: 280, width: 200, height: 80 },
        disabled: false,
      },
      delta: { x: 0, y: 200 },
      activatorEvent: {} as PointerEvent,
      collisions: [],
    } as unknown as DragEndEvent;

    await act(async () => {
      capturedOnDragEnd?.(event);
    });

    expect(rescheduleMutate).toHaveBeenCalledOnce();
    expect(rescheduleMutate).toHaveBeenCalledWith({
      id: 'wed-task',
      newDate: FRI_DATE,
    });
  });

  it('calls reschedule.mutate when dragged onto another task in a different day group', async () => {
    const rescheduleMutate = vi.fn();
    vi.mocked(useReschedule).mockReturnValue({
      ...noopMutation,
      mutate: rescheduleMutate,
    } as unknown as ReturnType<typeof useReschedule>);

    vi.mocked(usePatchItem).mockReturnValue({
      ...noopMutation,
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof usePatchItem>);

    const wedItem = makeItem('wed-task', WED_DATE);
    const friItem = makeItem('fri-task', FRI_DATE);
    const allItems = [wedItem, friItem];

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <Next7DndContext allItems={allItems}>
          <div />
        </Next7DndContext>
      </QueryClientProvider>,
    );

    // Simulate: drag wed-task onto fri-task (cross-day via task row, not day zone)
    const event = {
      active: {
        id: `wed-task:${WED_DATE}`,
        data: {
          current: {
            type: 'next7-task',
            itemId: 'wed-task',
            groupDate: WED_DATE,
          },
        },
        rect: { current: { initial: null, translated: null } },
      },
      over: {
        id: `fri-task:${FRI_DATE}`,
        data: {
          current: {
            type: 'next7-task',
            itemId: 'fri-task',
            groupDate: FRI_DATE,
          },
        },
        rect: { left: 0, right: 200, top: 200, bottom: 240, width: 200, height: 40 },
        disabled: false,
      },
      delta: { x: 0, y: 200 },
      activatorEvent: {} as PointerEvent,
      collisions: [],
    } as unknown as DragEndEvent;

    await act(async () => {
      capturedOnDragEnd?.(event);
    });

    expect(rescheduleMutate).toHaveBeenCalledOnce();
    expect(rescheduleMutate).toHaveBeenCalledWith({
      id: 'wed-task',
      newDate: FRI_DATE,
    });
  });

  it('does NOT call reschedule.mutate when dropped within the same day group', async () => {
    const rescheduleMutate = vi.fn();
    vi.mocked(useReschedule).mockReturnValue({
      ...noopMutation,
      mutate: rescheduleMutate,
    } as unknown as ReturnType<typeof useReschedule>);

    const patchMutate = vi.fn();
    vi.mocked(usePatchItem).mockReturnValue({
      ...noopMutation,
      mutate: patchMutate,
    } as unknown as ReturnType<typeof usePatchItem>);

    const wedItem1 = makeItem('wed-task-1', WED_DATE);
    const wedItem2 = { ...makeItem('wed-task-2', WED_DATE), sort_order: 2048 };
    const allItems = [wedItem1, wedItem2];

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <Next7DndContext allItems={allItems}>
          <div />
        </Next7DndContext>
      </QueryClientProvider>,
    );

    // Same-day drag → should call patchItem (reorder), NOT reschedule
    const event = {
      active: {
        id: `wed-task-1:${WED_DATE}`,
        data: {
          current: { type: 'next7-task', itemId: 'wed-task-1', groupDate: WED_DATE },
        },
        rect: { current: { initial: null, translated: null } },
      },
      over: {
        id: `wed-task-2:${WED_DATE}`,
        data: {
          current: { type: 'next7-task', itemId: 'wed-task-2', groupDate: WED_DATE },
        },
        rect: { left: 0, right: 200, top: 40, bottom: 80, width: 200, height: 40 },
        disabled: false,
      },
      delta: { x: 0, y: 40 },
      activatorEvent: {} as PointerEvent,
      collisions: [],
    } as unknown as DragEndEvent;

    await act(async () => {
      capturedOnDragEnd?.(event);
    });

    expect(rescheduleMutate).not.toHaveBeenCalled();
    expect(patchMutate).toHaveBeenCalledOnce(); // sort_order reorder
  });
});
