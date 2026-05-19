import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  closestCenter,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
/**
 * KanbanView — per-project Kanban board with 3 fixed columns: To Do / In Progress / Done.
 *
 * Data:
 *   - useItems({ view: 'project', project_id, include_completed: true })
 *   - Client-side filter: only item.type === 'task' (Epics/Features/Subtasks excluded per §9.4 #1)
 *   - Group by status; within each column, sort by sort_order asc.
 *   - Done column: slice to first 50 by default; "Show all" expands.
 *
 * Drag-and-drop (dnd-kit):
 *   - Cross-column drop → PATCH status (optimistic + snackbar).
 *   - Drop on Done → complete task sequence (handles recurring via useToggleComplete).
 *   - Within-column drop → PATCH sort_order.
 *
 * Keyboard nav per accessibility §2.3:
 *   ↑↓ reorder within column; ←→ move column (status mutate);
 *   Enter/O modal; Space/X toggle complete.
 *
 * Multi-select: column-scoped (selecting card in col A clears col B/C selection).
 *   Cross-column multi-select DISABLED (interaction-patterns §3.3).
 *
 * Snackbar: "Status: <In Progress / Done / To Do>." (microcopy §7).
 * For Done with recurrence: "Task completed. Next: <date>." from useToggleComplete.
 */
import type { Item, ItemId, ProjectId, Status } from '@tasko/types';
import { SquareKanban } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useItems, usePatchItem, useToggleComplete } from '../../api/items';
import { EmptyState } from '../../components/empty-state';
import { KanbanCard } from '../../components/kanban-card';
import { KanbanColumn } from '../../components/kanban-column';
import { useDndSensors } from '../../lib/dnd-sensors';
import { useSnackbarStore } from '../../store/snackbar';
import { useTaskModalStore } from '../../store/task-modal';
import { BulkActionsToolbar } from '../_shared/BulkActionsToolbar';
import styles from './kanban-view.module.css';

const COLUMNS: Status[] = ['todo', 'in_progress', 'done'];

const STATUS_DISPLAY: Record<Status, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
};

export interface KanbanViewProps {
  projectId: ProjectId;
}

export function KanbanView({ projectId }: KanbanViewProps) {
  const taskModal = useTaskModalStore();
  const snackbar = useSnackbarStore();
  const patchItem = usePatchItem();
  const toggleComplete = useToggleComplete();
  const sensors = useDndSensors();

  const { data: itemsData, isLoading } = useItems({
    view: 'project',
    project_id: projectId,
    include_completed: true,
  });

  const allItems = (itemsData?.items ?? []) as Item[];

  // Only tasks (not epics, features — no subtasks since type is 'task' only per §9.4 #1)
  const tasks = useMemo(() => allItems.filter((i) => i.type === 'task'), [allItems]);

  // Group by status, sorted by sort_order
  const { todoItems, inProgressItems, doneItems } = useMemo(() => {
    const todo = tasks.filter((i) => i.status === 'todo').sort((a, b) => a.sort_order - b.sort_order);
    const inProg = tasks
      .filter((i) => i.status === 'in_progress')
      .sort((a, b) => a.sort_order - b.sort_order);
    const done = tasks.filter((i) => i.status === 'done').sort((a, b) => a.sort_order - b.sort_order);
    return { todoItems: todo, inProgressItems: inProg, doneItems: done };
  }, [tasks]);

  // Done overflow state
  const [showAllDone, setShowAllDone] = useState(false);

  // Active drag item
  const [activeDragItem, setActiveDragItem] = useState<Item | null>(null);

  // ─── Drag handlers ─────────────────────────────────────────────────────────

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const item = event.active.data.current?.item as Item | undefined;
    setActiveDragItem(item ?? null);
  }, []);

  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // Visual feedback handled by KanbanColumn's useDroppable isOver
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragItem(null);
      const { active, over } = event;
      if (!over) return;

      const activeData = active.data.current as { itemId: string; status: Status; item: Item } | undefined;
      if (!activeData) return;

      const overId = String(over.id);
      const activeItemId = activeData.itemId as ItemId;
      const sourceStatus = activeData.status;
      const activeItem = activeData.item;

      // Determine drop target
      // Could be a column (kanban-column:status) or a card (item id)
      let targetStatus: Status | null = null;

      if (overId.startsWith('kanban-column:')) {
        const colStatus = overId.replace('kanban-column:', '') as Status;
        if (COLUMNS.includes(colStatus)) targetStatus = colStatus;
      } else {
        // Dropped on a card — find which column the card belongs to
        const overItem = tasks.find((i) => i.id === overId);
        if (overItem) targetStatus = overItem.status;
      }

      if (!targetStatus) return;

      if (targetStatus !== sourceStatus) {
        // Cross-column: status change
        if (targetStatus === 'done') {
          // Complete sequence
          toggleComplete.mutate({ id: activeItemId, nextStatus: 'done' });
        } else {
          patchItem.mutate(
            { id: activeItemId, patch: { status: targetStatus } },
            {
              onSuccess: () => {
                snackbar.show({
                  variant: 'info',
                  text: `Status: ${STATUS_DISPLAY[targetStatus]}.`,
                  durationMs: 5000,
                });
              },
            },
          );
        }
      } else {
        // Same-column: sort_order reorder
        const columnItems = tasks
          .filter((i) => i.status === sourceStatus)
          .sort((a, b) => a.sort_order - b.sort_order);

        const activeIdx = columnItems.findIndex((i) => i.id === activeItemId);
        const overIdx = columnItems.findIndex((i) => i.id === overId);

        if (activeIdx !== -1 && overIdx !== -1 && activeIdx !== overIdx) {
          const reordered = arrayMove(columnItems, activeIdx, overIdx);
          // PATCH sort_order for each reordered item
          for (let idx = 0; idx < reordered.length; idx++) {
            const item = reordered[idx];
            if (item && item.sort_order !== idx) {
              patchItem.mutate({ id: item.id as ItemId, patch: { sort_order: idx } });
            }
          }
        }
      }
    },
    [tasks, patchItem, toggleComplete, snackbar],
  );

  // ─── Column action handlers ────────────────────────────────────────────────

  const handleAddTask = useCallback(
    (status: Status) => {
      taskModal.openNew({
        initialProjectId: projectId,
        initialStatus: status,
      });
    },
    [taskModal, projectId],
  );

  const handleMoveCardToColumn = useCallback(
    (itemId: ItemId, direction: 'prev' | 'next') => {
      const item = tasks.find((i) => i.id === itemId);
      if (!item) return;

      const currentIdx = COLUMNS.indexOf(item.status);
      const nextIdx = direction === 'prev' ? currentIdx - 1 : currentIdx + 1;
      if (nextIdx < 0 || nextIdx >= COLUMNS.length) return;

      const nextStatus = COLUMNS[nextIdx];
      if (!nextStatus) return;

      if (nextStatus === 'done') {
        toggleComplete.mutate({ id: itemId, nextStatus: 'done' });
      } else {
        patchItem.mutate(
          { id: itemId, patch: { status: nextStatus } },
          {
            onSuccess: () => {
              snackbar.show({
                variant: 'info',
                text: `Status: ${STATUS_DISPLAY[nextStatus]}.`,
                durationMs: 5000,
              });
            },
          },
        );
      }
    },
    [tasks, patchItem, toggleComplete, snackbar],
  );

  const handleToggleComplete = useCallback(
    (item: Item) => {
      const nextStatus: Status = item.status === 'done' ? 'todo' : 'done';
      toggleComplete.mutate({ id: item.id as ItemId, nextStatus });
    },
    [toggleComplete],
  );

  const handleReorderCard = useCallback(
    (itemId: ItemId, direction: 'up' | 'down') => {
      const item = tasks.find((i) => i.id === itemId);
      if (!item) return;

      const columnItems = tasks
        .filter((i) => i.status === item.status)
        .sort((a, b) => a.sort_order - b.sort_order);

      const currentIdx = columnItems.findIndex((i) => i.id === itemId);
      const swapIdx = direction === 'up' ? currentIdx - 1 : currentIdx + 1;

      if (swapIdx < 0 || swapIdx >= columnItems.length) return;

      const swapItem = columnItems[swapIdx];
      if (!swapItem) return;

      // Swap sort_orders
      patchItem.mutate({ id: itemId, patch: { sort_order: swapIdx } });
      patchItem.mutate({ id: swapItem.id as ItemId, patch: { sort_order: currentIdx } });
    },
    [tasks, patchItem],
  );

  // ─── Empty board ──────────────────────────────────────────────────────────

  const isEmptyBoard = !isLoading && tasks.length === 0;

  // ─── Render ───────────────────────────────────────────────────────────────

  if (isLoading && tasks.length === 0) {
    return (
      <div className={styles.root} aria-busy="true">
        <div
          style={{ height: 200, background: 'var(--color-canvas-subtle)', borderRadius: 'var(--radius-md)' }}
        />
      </div>
    );
  }

  if (isEmptyBoard) {
    return (
      <div className={styles.root}>
        <div className={styles.emptyBoard}>
          <EmptyState
            icon={SquareKanban}
            headline="No tasks here yet."
            subline="Drag from another project or add one."
          />
        </div>
      </div>
    );
  }

  const columnItemsMap: Record<Status, Item[]> = {
    todo: todoItems,
    in_progress: inProgressItems,
    done: doneItems,
  };

  return (
    <div className={styles.root}>
      <BulkActionsToolbar />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <section className={styles.board} aria-label="Kanban board">
          {COLUMNS.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              items={columnItemsMap[status]}
              projectId={projectId}
              showAll={status === 'done' ? showAllDone : true}
              onShowAll={status === 'done' ? () => setShowAllDone(true) : undefined}
              onAddTask={handleAddTask}
              onMoveCardToColumn={handleMoveCardToColumn}
              onToggleComplete={handleToggleComplete}
              onReorderCard={handleReorderCard}
            />
          ))}
        </section>

        <DragOverlay>
          {activeDragItem && (
            <div className={styles.dragOverlayCard}>
              <KanbanCard item={activeDragItem} isDragging={false} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

export default KanbanView;
