/**
 * subtask-reorder.test.tsx
 *
 * Verifies that SubtaskList.onDragEnd calls onReorder with the correctly
 * reordered subtasks array when a subtask is dragged to a new position.
 *
 * Strategy: render SubtaskList, capture DndContext.onDragEnd, invoke it
 * with a synthetic DragEndEvent.
 */

import type { DragEndEvent } from '@dnd-kit/core';
import type { Subtask } from '@tasko/types';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Imports ───────────────────────────────────────────────────────────────────

import { SubtaskList } from '../../components/subtask-row';

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

function makeSubtask(id: string, title: string, sortOrder: number): Subtask {
  return {
    id: id as Subtask['id'],
    title,
    status: 'todo',
    sort_order: sortOrder,
    completed_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SubtaskList — drag-end calls onReorder with reordered subtasks', () => {
  beforeEach(() => {
    capturedOnDragEnd = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls onReorder with subtasks in new order when first is dragged to last position', async () => {
    const onReorder = vi.fn();
    const subtasks = [
      makeSubtask('sub-1', 'First', 1024),
      makeSubtask('sub-2', 'Second', 2048),
      makeSubtask('sub-3', 'Third', 3072),
    ];

    render(
      <SubtaskList
        subtasks={subtasks}
        onToggle={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onAdd={vi.fn()}
        onReorder={onReorder}
      />,
    );

    expect(capturedOnDragEnd).not.toBeNull();

    // Drag sub-1 (index 0) to position after sub-3 (index 2)
    const event = {
      active: {
        id: 'sub-1',
        data: { current: { type: 'subtask', subtaskId: 'sub-1' } },
        rect: { current: { initial: null, translated: null } },
      },
      over: {
        id: 'sub-3',
        data: { current: { type: 'subtask', subtaskId: 'sub-3' } },
        rect: { left: 0, right: 300, top: 64, bottom: 96, width: 300, height: 32 },
        disabled: false,
      },
      delta: { x: 0, y: 64 },
      activatorEvent: {} as PointerEvent,
      collisions: [],
    } as unknown as DragEndEvent;

    await act(async () => {
      capturedOnDragEnd?.(event);
    });

    expect(onReorder).toHaveBeenCalledOnce();
    const reorderedSubtasks: Subtask[] = onReorder.mock.calls[0]?.[0];

    // sub-1 should now be last (after sub-2 and sub-3 which shifted forward)
    expect(reorderedSubtasks).toHaveLength(3);
    // The reordering moves sub-1 to where sub-3 is → new order: [sub-2, sub-3, sub-1]
    // (arrayMove semantics: remove from 0, insert at 2)
    // biome-ignore lint/style/noNonNullAssertion: test array always has 3 elements
    expect(reorderedSubtasks[0]!.id).toBe('sub-2');
    // biome-ignore lint/style/noNonNullAssertion: test array always has 3 elements
    expect(reorderedSubtasks[1]!.id).toBe('sub-3');
    // biome-ignore lint/style/noNonNullAssertion: test array always has 3 elements
    expect(reorderedSubtasks[2]!.id).toBe('sub-1');
  });

  it('assigns new sequential sort_orders to reordered subtasks (1024-step spacing)', async () => {
    const onReorder = vi.fn();
    const subtasks = [
      makeSubtask('sub-1', 'First', 1024),
      makeSubtask('sub-2', 'Second', 2048),
      makeSubtask('sub-3', 'Third', 3072),
    ];

    render(
      <SubtaskList
        subtasks={subtasks}
        onToggle={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onAdd={vi.fn()}
        onReorder={onReorder}
      />,
    );

    const event = {
      active: {
        id: 'sub-1',
        data: { current: { type: 'subtask', subtaskId: 'sub-1' } },
        rect: { current: { initial: null, translated: null } },
      },
      over: {
        id: 'sub-3',
        data: { current: { type: 'subtask', subtaskId: 'sub-3' } },
        rect: { left: 0, right: 300, top: 64, bottom: 96, width: 300, height: 32 },
        disabled: false,
      },
      delta: { x: 0, y: 64 },
      activatorEvent: {} as PointerEvent,
      collisions: [],
    } as unknown as DragEndEvent;

    await act(async () => {
      capturedOnDragEnd?.(event);
    });

    const reorderedSubtasks: Subtask[] = onReorder.mock.calls[0]?.[0];
    // Each subtask should have sort_order = (index+1) * 1024
    // biome-ignore lint/style/noNonNullAssertion: test array always has 3 elements
    expect(reorderedSubtasks[0]!.sort_order).toBe(1024);
    // biome-ignore lint/style/noNonNullAssertion: test array always has 3 elements
    expect(reorderedSubtasks[1]!.sort_order).toBe(2048);
    // biome-ignore lint/style/noNonNullAssertion: test array always has 3 elements
    expect(reorderedSubtasks[2]!.sort_order).toBe(3072);
  });

  it('does NOT call onReorder when active === over (same subtask)', async () => {
    const onReorder = vi.fn();
    const subtasks = [makeSubtask('sub-1', 'First', 1024), makeSubtask('sub-2', 'Second', 2048)];

    render(
      <SubtaskList
        subtasks={subtasks}
        onToggle={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onAdd={vi.fn()}
        onReorder={onReorder}
      />,
    );

    const noOpEvent = {
      active: {
        id: 'sub-1',
        data: { current: { type: 'subtask', subtaskId: 'sub-1' } },
        rect: { current: { initial: null, translated: null } },
      },
      over: {
        id: 'sub-1', // same as active
        data: { current: { type: 'subtask', subtaskId: 'sub-1' } },
        rect: { left: 0, right: 300, top: 0, bottom: 32, width: 300, height: 32 },
        disabled: false,
      },
      delta: { x: 0, y: 0 },
      activatorEvent: {} as PointerEvent,
      collisions: [],
    } as unknown as DragEndEvent;

    await act(async () => {
      capturedOnDragEnd?.(noOpEvent);
    });

    expect(onReorder).not.toHaveBeenCalled();
  });
});
