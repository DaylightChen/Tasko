/**
 * ListDndContext — wraps a flat task list with DndContext + SortableContext.
 * Used by Today, Inbox, All, Tomorrow, and flat project views.
 *
 * On drop: computes new sort_order via sparse-integer scheme, issues PATCH.
 * If a renumber is needed, patches all siblings.
 *
 * Usage:
 *   <ListDndContext items={items}>
 *     <ul>
 *       {items.map(item => (
 *         <SortableTaskRow key={item.id} item={item}>
 *           {(sortableProps) => <TaskListRow item={item} {...sortableProps} ... />}
 *         </SortableTaskRow>
 *       ))}
 *     </ul>
 *   </ListDndContext>
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
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Item, ItemId } from '@tasko/types';
import type React from 'react';
import { useRef, useState } from 'react';
import { usePatchItem } from '../../api/items';
import { DragOverlayContent } from '../../components/drag-visuals';
import type { TaskListRowProps } from '../../components/task-list-row';
import { announce } from '../../lib/a11y';
import { useDndSensors } from '../../lib/dnd-sensors';
import { stopAutoScroll, updateAutoScroll } from '../../lib/drag-auto-scroll';
import { computeNewSortOrder, renumberList } from '../../lib/sort-order';

// ─── Sortable task row ────────────────────────────────────────────────────────

type SortableDragProps = Pick<
  TaskListRowProps,
  'dragNodeRef' | 'dragAttributes' | 'dragListeners' | 'isDragSource' | 'dragStyle'
>;

interface SortableTaskRowProps {
  item: Item;
  children: (sortableProps: SortableDragProps) => React.ReactNode;
}

export function SortableTaskRow({ item, children }: SortableTaskRowProps) {
  const { attributes, listeners, setNodeRef, isDragging, transform, transition } = useSortable({
    id: item.id,
    data: { type: 'task', itemId: item.id },
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

// ─── List DnD context ─────────────────────────────────────────────────────────

interface ListDndContextProps {
  items: Item[];
  scrollContainerRef?: React.RefObject<HTMLElement>;
  children: React.ReactNode;
  renderOverlayItem?: (item: Item) => React.ReactNode;
}

export function ListDndContext({
  items,
  scrollContainerRef,
  children,
  renderOverlayItem,
}: ListDndContextProps) {
  const sensors = useDndSensors();
  const patchItem = usePatchItem();
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const lastAnnouncedTargetRef = useRef<string | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    setActiveDragId(id);
    lastAnnouncedTargetRef.current = null;

    const item = items.find((i) => i.id === id);
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
    const overItem = items.find((i) => i.id === overId);
    if (overItem) {
      announce(`Drop on ${overItem.title}.`);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    stopAutoScroll();
    setActiveDragId(null);
    lastAnnouncedTargetRef.current = null;

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const overItem = items.find((i) => i.id === overId);
    if (!overItem) return;

    // Compute new sort_order
    const sortedItems = [...items].sort((a, b) => a.sort_order - b.sort_order);
    const overIndex = sortedItems.findIndex((i) => i.id === overId);
    const sortedOrders = sortedItems.filter((i) => i.id !== activeId).map((i) => i.sort_order);

    const { value, needsRenumber } = computeNewSortOrder(sortedOrders, overIndex);

    patchItem.mutate({ id: activeId as ItemId, patch: { sort_order: value } });

    if (needsRenumber) {
      const newOrders = renumberList(sortedItems.length);
      const reordered = [...sortedItems.filter((i) => i.id !== activeId)];
      const activeItem = sortedItems.find((i) => i.id === activeId);
      if (activeItem) {
        reordered.splice(overIndex, 0, activeItem);
      }
      reordered.forEach((listItem, i) => {
        if (listItem.id !== activeId) {
          patchItem.mutate({
            id: listItem.id as ItemId,
            patch: { sort_order: newOrders[i] ?? (i + 1) * 1024 },
          });
        }
      });
    }

    announce(`Dropped onto ${overItem.title}.`);
  };

  const handleDragCancel = () => {
    stopAutoScroll();
    setActiveDragId(null);
    lastAnnouncedTargetRef.current = null;
    announce('Drag cancelled.');
  };

  const activeItem = activeDragId ? items.find((i) => i.id === activeDragId) : null;
  const itemIds = items.map((i) => i.id);

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
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>

      <DragOverlay>
        {activeItem ? (
          <DragOverlayContent>
            {renderOverlayItem ? (
              renderOverlayItem(activeItem)
            ) : (
              <div style={{ padding: '6px 12px', fontSize: 'var(--text-body-size, 14px)' }}>
                {activeItem.title}
              </div>
            )}
          </DragOverlayContent>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
