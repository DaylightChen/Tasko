/**
 * TreeDndContext — DnD for the Project Tree View.
 *
 * Each tree row is both useDraggable and (for Epics/Features) useDroppable.
 * The project root is also useDroppable (for placing items at top level).
 *
 * On drag-over: calls canMoveClient to validate; sets depth-cap-reject state.
 * On drop with ok: calls useMoveItem.
 * On drop with !ok: shows snackbar + assertive announcement.
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
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { Item, ItemId, ProjectId } from '@tasko/types';
import type React from 'react';
import { useRef, useState } from 'react';
import { useMoveItem } from '../../api/items';
import { DragOverlayContent } from '../../components/drag-visuals';
import { announce } from '../../lib/a11y';
import { canMoveClient } from '../../lib/depth-cap-client';
import { guardDndKeyDown } from '../../lib/dnd-keydown';
import { useDndSensors } from '../../lib/dnd-sensors';
import { stopAutoScroll, updateAutoScroll } from '../../lib/drag-auto-scroll';
import { useSnackbarStore } from '../../store/snackbar';
import { useTreeExpansionStore } from '../../store/tree-expansion';
import { useUndoStore } from '../../store/undo';

// ─── Draggable + Droppable tree row wrapper ───────────────────────────────────

interface TreeRowDndData {
  type: 'tree-item';
  itemId: string;
  item: Item;
}

interface TreeRowDroppableProps {
  item: Item;
  projectId: ProjectId;
  isDropTarget: boolean;
  isDepthCapReject: boolean;
  children: React.ReactNode;
}

export function TreeRowDraggable({
  item,
  projectId,
  isDropTarget,
  isDepthCapReject,
  children,
}: TreeRowDroppableProps) {
  const draggableId = `tree:${item.id}`;

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: draggableId,
    data: { type: 'tree-item', itemId: item.id, item } satisfies TreeRowDndData,
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `tree-drop:${item.id}`,
    data: { type: 'tree-drop', itemId: item.id, item, projectId },
    disabled: item.type === 'task',
  });

  const mergedRef = (node: HTMLDivElement | null) => {
    setDragRef(node);
    setDropRef(node);
  };

  const dataState =
    [
      isDragging ? 'drag-source-placeholder' : '',
      isDepthCapReject ? 'depth-cap-reject' : '',
      (isDropTarget || isOver) && !isDepthCapReject ? 'drop-target' : '',
    ]
      .filter(Boolean)
      .join(' ') || undefined;

  // See lib/dnd-keydown.ts for why we guard the keyboard sensor.
  const { onKeyDown: dndKeyDown, ...otherListeners } = (listeners ?? {}) as {
    onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  } & React.HTMLAttributes<HTMLDivElement>;

  return (
    <div
      ref={mergedRef}
      data-state={dataState}
      {...attributes}
      {...otherListeners}
      onKeyDown={guardDndKeyDown(dndKeyDown)}
    >
      {children}
    </div>
  );
}

// ─── Project root drop zone ───────────────────────────────────────────────────

interface ProjectRootDropZoneProps {
  projectId: ProjectId;
  isDropTarget: boolean;
}

export function ProjectRootDropZone({ projectId, isDropTarget }: ProjectRootDropZoneProps) {
  const { setNodeRef } = useDroppable({
    id: `tree-root:${projectId}`,
    data: { type: 'tree-root', projectId },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ minHeight: 8 }}
      data-state={isDropTarget ? 'drop-target' : undefined}
      aria-hidden="true"
    />
  );
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface TreeDndContextProps {
  items: Item[];
  itemsMap: Map<ItemId, Item>;
  projectId: ProjectId;
  scrollContainerRef?: React.RefObject<HTMLElement>;
  children: React.ReactNode;
}

export function TreeDndContext({
  items,
  itemsMap,
  projectId,
  scrollContainerRef,
  children,
}: TreeDndContextProps) {
  const sensors = useDndSensors();
  const moveItem = useMoveItem();
  const snackbar = useSnackbarStore();
  const expansion = useTreeExpansionStore();

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<Item | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [depthCapRejectId, setDepthCapRejectId] = useState<string | null>(null);
  const lastAnnouncedTargetRef = useRef<string | null>(null);
  const autoExpandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    setActiveDragId(id);
    const data = event.active.data.current as TreeRowDndData | undefined;
    setActiveItem(data?.item ?? null);
    lastAnnouncedTargetRef.current = null;

    announce(`Dragging "${data?.item?.title ?? id}". Drop on a project, folder, or feature.`);
  };

  const handleDragMove = (event: DragMoveEvent) => {
    const clientY = (event.activatorEvent as PointerEvent)?.clientY ?? 0;
    if (scrollContainerRef?.current) {
      updateAutoScroll(scrollContainerRef.current, clientY);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (!event.over) {
      setDropTargetId(null);
      setDepthCapRejectId(null);
      if (autoExpandTimerRef.current) {
        clearTimeout(autoExpandTimerRef.current);
        autoExpandTimerRef.current = null;
      }
      return;
    }

    const overId = event.over.id as string;
    const overData = event.over.data.current as
      | { type: string; itemId?: string; item?: Item; projectId?: string }
      | undefined;
    const activeData = event.active.data.current as TreeRowDndData | undefined;

    if (!activeData) return;
    const sourceItem = activeData.item;

    // Determine the new parent
    let newParent: Item | null = null;
    if (overData?.type === 'tree-drop' && overData.item) {
      newParent = overData.item;
    } else if (overData?.type === 'tree-root') {
      newParent = null;
    }

    // Validate with depth-cap
    const result = canMoveClient({ source: sourceItem, newParent, items: itemsMap });

    const targetName = newParent?.title ?? 'project root';

    if (result.ok) {
      setDropTargetId(overId);
      setDepthCapRejectId(null);

      if (lastAnnouncedTargetRef.current !== overId) {
        lastAnnouncedTargetRef.current = overId;
        announce(`Drop on ${targetName}.`);
      }
    } else {
      setDropTargetId(null);
      setDepthCapRejectId(event.active.id as string);

      if (lastAnnouncedTargetRef.current !== overId) {
        lastAnnouncedTargetRef.current = overId;
        announce(`Cannot drop on ${targetName}: would exceed nesting depth.`);
      }
    }

    // Auto-expand collapsed Epic/Feature after 300ms hover
    if (
      overData?.type === 'tree-drop' &&
      overData.item &&
      (overData.item.type === 'epic' || overData.item.type === 'feature')
    ) {
      const targetItemId = overData.item.id as ItemId;
      if (!autoExpandTimerRef.current) {
        autoExpandTimerRef.current = setTimeout(() => {
          autoExpandTimerRef.current = null;
          expansion.setExpanded(projectId, targetItemId, true);
        }, 300);
      }
    } else {
      if (autoExpandTimerRef.current) {
        clearTimeout(autoExpandTimerRef.current);
        autoExpandTimerRef.current = null;
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    stopAutoScroll();

    if (autoExpandTimerRef.current) {
      clearTimeout(autoExpandTimerRef.current);
      autoExpandTimerRef.current = null;
    }

    const prevDepthCapRejectId = depthCapRejectId;
    setActiveDragId(null);
    setActiveItem(null);
    setDropTargetId(null);
    setDepthCapRejectId(null);
    lastAnnouncedTargetRef.current = null;

    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current as TreeRowDndData | undefined;
    const overData = over.data.current as
      | { type: string; itemId?: string; item?: Item; projectId?: string }
      | undefined;

    if (!activeData) return;
    const sourceItem = activeData.item;

    // Determine target
    let newParent: Item | null = null;
    let isRoot = false;
    if (overData?.type === 'tree-drop' && overData.item) {
      newParent = overData.item;
    } else if (overData?.type === 'tree-root') {
      newParent = null;
      isRoot = true;
    } else {
      return;
    }

    // Validate
    const result = canMoveClient({ source: sourceItem, newParent, items: itemsMap });

    if (!result.ok || prevDepthCapRejectId !== null) {
      snackbar.show({
        variant: 'depth-cap',
        text: "Can't move there: would exceed nesting depth.",
        durationMs: 5000,
      });
      return;
    }

    const targetName = newParent?.title ?? 'project root';
    const new_parent_id = newParent ? (newParent.id as ItemId) : null;

    const priorParentId = sourceItem.parent_id as ItemId | null;
    const priorProjectId = sourceItem.project_id as string;
    const sourceId = sourceItem.id as ItemId;

    moveItem.mutate(
      { id: sourceId, new_parent_id },
      {
        onSuccess: () => {
          useUndoStore.getState().push({
            label: 'Task move',
            apply: () =>
              moveItem.mutate({ id: sourceId, new_parent_id: priorParentId, new_project_id: priorProjectId }),
          });

          snackbar.show({
            variant: 'success',
            text: `Task moved to ${targetName}.`,
            durationMs: 5000,
            action: { label: 'Undo', onClick: () => useUndoStore.getState().pop() },
          });
          announce(`Dropped onto ${targetName}.`);
        },
      },
    );
  };

  const handleDragCancel = () => {
    stopAutoScroll();
    setActiveDragId(null);
    setActiveItem(null);
    setDropTargetId(null);
    setDepthCapRejectId(null);
    if (autoExpandTimerRef.current) {
      clearTimeout(autoExpandTimerRef.current);
      autoExpandTimerRef.current = null;
    }
    lastAnnouncedTargetRef.current = null;
    announce('Drag cancelled.');
  };

  return (
    <TreeDndStateContext value={{ dropTargetId, depthCapRejectId, activeDragId, projectId }}>
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
    </TreeDndStateContext>
  );
}

// ─── Context for sharing DnD state to tree rows ───────────────────────────────

import { createContext, useContext } from 'react';

interface TreeDndState {
  dropTargetId: string | null;
  depthCapRejectId: string | null;
  activeDragId: string | null;
  projectId: ProjectId;
}

const TreeDndStateCtx = createContext<TreeDndState>({
  dropTargetId: null,
  depthCapRejectId: null,
  activeDragId: null,
  projectId: '' as ProjectId,
});

function TreeDndStateContext({ value, children }: { value: TreeDndState; children: React.ReactNode }) {
  return <TreeDndStateCtx.Provider value={value}>{children}</TreeDndStateCtx.Provider>;
}

export function useTreeDndState() {
  return useContext(TreeDndStateCtx);
}
