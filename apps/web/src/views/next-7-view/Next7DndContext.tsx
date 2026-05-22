/**
 * Next7DndContext — DnD for Next 7 Days view.
 *
 * - Each day group is a useDroppable keyed by the day's date.
 * - Each row within a day group is useSortable.
 * - Dragging a row from one day group to another triggers PATCH due_date.
 * - Dragging within same group: sort_order reorder.
 */
import {
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  closestCenter,
} from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Item, ItemId, LocalDate } from '@tasko/types';
import type React from 'react';
import { useRef, useState } from 'react';
import { usePatchItem, useReschedule } from '../../api/items';
import { DragOverlayContent } from '../../components/drag-visuals';
import type { TaskListRowProps } from '../../components/task-list-row';
import { announce } from '../../lib/a11y';
import { useDndSensors } from '../../lib/dnd-sensors';
import { stopAutoScroll, updateAutoScroll } from '../../lib/drag-auto-scroll';
import { computeNewSortOrder } from '../../lib/sort-order';

// ─── Droppable day group ──────────────────────────────────────────────────────

interface DroppableDayGroupProps {
  date: LocalDate;
  children: React.ReactNode;
  itemIds: string[];
}

export function DroppableDayGroup({ date, children, itemIds }: DroppableDayGroupProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day:${date}`,
    data: { type: 'day', date },
  });

  return (
    <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
      <div ref={setNodeRef} data-state={isOver ? 'drop-target' : undefined} style={{ minHeight: 4 }}>
        {children}
      </div>
    </SortableContext>
  );
}

// ─── Sortable day-group task row ──────────────────────────────────────────────

type SortableDragProps = Pick<
  TaskListRowProps,
  'dragNodeRef' | 'dragAttributes' | 'dragListeners' | 'isDragSource' | 'dragStyle'
>;

interface SortableNext7RowProps {
  item: Item;
  groupDate: LocalDate;
  children: (sortableProps: SortableDragProps) => React.ReactNode;
}

export function SortableNext7Row({ item, groupDate, children }: SortableNext7RowProps) {
  const { attributes, listeners, setNodeRef, isDragging, transform, transition } = useSortable({
    id: `${item.id}:${groupDate}`,
    data: { type: 'next7-task', itemId: item.id, groupDate },
  });

  const sortableProps: SortableDragProps = {
    dragNodeRef: setNodeRef as (node: HTMLLIElement | null) => void,
    dragAttributes: attributes as React.HTMLAttributes<HTMLLIElement>,
    dragListeners: listeners as React.HTMLAttributes<HTMLLIElement>,
    isDragSource: isDragging,
    dragStyle: {
      transform: CSS.Transform.toString(transform) ?? undefined,
      transition: transition ?? undefined,
    },
  };

  return children(sortableProps);
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface Next7DndContextProps {
  allItems: Item[];
  scrollContainerRef?: React.RefObject<HTMLElement>;
  children: React.ReactNode;
}

export function Next7DndContext({ allItems, scrollContainerRef, children }: Next7DndContextProps) {
  const sensors = useDndSensors();
  const reschedule = useReschedule();
  const patchItem = usePatchItem();
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const lastAnnouncedTargetRef = useRef<string | null>(null);

  // activeDragId format: `${itemId}:${groupDate}`
  const getItemFromDragId = (dragId: string): Item | undefined => {
    const [itemId] = dragId.split(':');
    return allItems.find((i) => i.id === itemId);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    setActiveDragId(id);
    lastAnnouncedTargetRef.current = null;
    const item = getItemFromDragId(id);
    announce(`Dragging "${item?.title ?? id}". Drop on a project, folder, or feature.`);
  };

  const handleDragMove = (event: DragMoveEvent) => {
    const clientY = (event.activatorEvent as PointerEvent)?.clientY ?? 0;
    if (scrollContainerRef?.current) {
      updateAutoScroll(scrollContainerRef.current, clientY);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (!event.over) return;
    const overId = event.over.id as string;
    if (lastAnnouncedTargetRef.current === overId) return;
    lastAnnouncedTargetRef.current = overId;

    const overData = event.over.data.current as { type: string; date?: string } | undefined;
    if (overData?.type === 'day' && overData.date) {
      announce(`Drop on ${overData.date}.`);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    stopAutoScroll();
    setActiveDragId(null);
    lastAnnouncedTargetRef.current = null;

    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const activeData = active.data.current as { type: string; itemId: string; groupDate: string } | undefined;
    const overData = over.data.current as
      | { type: string; date?: string; groupDate?: string; itemId?: string }
      | undefined;

    if (!activeData) return;
    const itemId = activeData.itemId as ItemId;
    const sourceDate = activeData.groupDate as LocalDate;

    // Case 1: Dropped onto a day zone (cross-day reschedule)
    if (overData?.type === 'day' && overData.date) {
      const targetDate = overData.date as LocalDate;
      if (targetDate !== sourceDate) {
        reschedule.mutate({ id: itemId, newDate: targetDate });
        announce(`Dropped onto ${targetDate}.`);
      }
      return;
    }

    // Case 2: Dropped onto another task row (could be same day or cross-day)
    if (overData?.type === 'next7-task' && overData.itemId && overData.groupDate) {
      const targetDate = overData.groupDate as LocalDate;
      if (targetDate !== sourceDate) {
        // Cross-day: reschedule
        reschedule.mutate({ id: itemId, newDate: targetDate });
        announce(`Dropped onto ${targetDate}.`);
      } else {
        // Same day: reorder
        const overItemId = overData.itemId;
        const dayItems = allItems.filter(
          (i) => i.due_date === sourceDate && i.status !== 'done' && !i.trashed_at,
        );
        const sortedItems = [...dayItems].sort((a, b) => a.sort_order - b.sort_order);
        const overIndex = sortedItems.findIndex((i) => i.id === overItemId);
        const sortedOrders = sortedItems.filter((i) => i.id !== itemId).map((i) => i.sort_order);
        const { value } = computeNewSortOrder(sortedOrders, overIndex);
        patchItem.mutate({ id: itemId, patch: { sort_order: value } });

        const overItem = allItems.find((i) => i.id === overItemId);
        announce(`Dropped onto ${overItem?.title ?? overItemId}.`);
      }
      return;
    }
  };

  const handleDragCancel = () => {
    stopAutoScroll();
    setActiveDragId(null);
    lastAnnouncedTargetRef.current = null;
    announce('Drag cancelled.');
  };

  const activeItem = activeDragId ? getItemFromDragId(activeDragId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {children}

      <DragOverlay>
        {activeItem ? (
          <DragOverlayContent>
            <div style={{ padding: '6px 12px', fontSize: 'var(--text-body-size, 14px)' }}>
              {activeItem.title}
            </div>
          </DragOverlayContent>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
