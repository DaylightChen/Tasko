import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useVirtualizer } from '@tanstack/react-virtual';
/**
 * KanbanColumn — a single column in the Kanban board.
 *
 * Per UX §24:
 *   - Header: status dot + title + count badge + "+" add button.
 *   - Body: role="list" of KanbanCard items (independently scrollable).
 *   - Per-column empty state: faint dashed border + "No items".
 *   - Done column overflow: "Showing recent 50, [Show all]" footer.
 *
 * The column is a useDroppable target for cross-column drag (status change).
 * Within-column sorting is handled by SortableContext in the parent.
 */
import type { Item, ItemId, ProjectId, Status } from '@tasko/types';
import { useCallback, useRef } from 'react';

const KANBAN_VIRTUALIZE_THRESHOLD = 50;
const ESTIMATED_CARD_HEIGHT = 80;
import { useMultiSelect } from '../../hooks/useMultiSelect';
import { KanbanCard } from '../kanban-card';
import styles from './styles.module.css';

export const DONE_PAGE_SIZE = 50;

const STATUS_LABELS: Record<Status, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
};

interface SortableKanbanCardProps {
  item: Item;
  isSelected: boolean;
  onKeyDown: (e: React.KeyboardEvent, item: Item) => void;
}

function SortableKanbanCard({ item, isSelected, onKeyDown }: SortableKanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: { itemId: item.id, status: item.status, item },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onKeyDown={(e) => onKeyDown(e, item)}>
      <KanbanCard item={item} isDragging={isDragging} isSelected={isSelected} />
    </div>
  );
}

export interface KanbanColumnProps {
  status: Status;
  items: Item[];
  projectId: ProjectId;
  /** For Done column: show all or limit to 50 */
  showAll?: boolean;
  onShowAll?: (() => void) | undefined;
  onAddTask: (status: Status) => void;
  /** Keyboard handler: move card to prev/next column */
  onMoveCardToColumn: (itemId: ItemId, direction: 'prev' | 'next') => void;
  /** Keyboard handler: toggle complete */
  onToggleComplete: (item: Item) => void;
  /** Keyboard handler: reorder within column */
  onReorderCard: (itemId: ItemId, direction: 'up' | 'down') => void;
}

export function KanbanColumn({
  status,
  items,
  showAll = true,
  onShowAll,
  onAddTask,
  onMoveCardToColumn,
  onToggleComplete,
  onReorderCard,
}: KanbanColumnProps) {
  const columnRef = useRef<HTMLDivElement>(null);

  const title = STATUS_LABELS[status];
  const isDone = status === 'done';

  // Limit Done column items unless showAll
  const visibleItems = isDone && !showAll ? items.slice(0, DONE_PAGE_SIZE) : items;
  const hasOverflow = isDone && !showAll && items.length > DONE_PAGE_SIZE;

  const itemIds = visibleItems.map((i) => i.id);
  const { handleListClick, multiSelect } = useMultiSelect(itemIds as ItemId[], 'kanban-column');

  // useDroppable for cross-column drop target
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `kanban-column:${status}`,
    data: { type: 'kanban-column', status },
  });

  const handleAddClick = useCallback(() => {
    onAddTask(status);
  }, [onAddTask, status]);

  // Keyboard handler for card nav
  const handleCardKeyDown = useCallback(
    (e: React.KeyboardEvent, item: Item) => {
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      switch (e.key) {
        case 'ArrowUp': {
          e.preventDefault();
          onReorderCard(item.id as ItemId, 'up');
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          onReorderCard(item.id as ItemId, 'down');
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          onMoveCardToColumn(item.id as ItemId, 'prev');
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          onMoveCardToColumn(item.id as ItemId, 'next');
          break;
        }
        case ' ': {
          e.preventDefault();
          onToggleComplete(item);
          break;
        }
        case 'x':
        case 'X': {
          e.preventDefault();
          onToggleComplete(item);
          break;
        }
      }
    },
    [onMoveCardToColumn, onReorderCard, onToggleComplete],
  );

  const mergedRef = useCallback(
    (node: HTMLDivElement | null) => {
      setDropRef(node);
      (columnRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    },
    [setDropRef],
  );

  const kanbanScrollRef = useRef<HTMLUListElement>(null);
  const kanbanVirtualizer = useVirtualizer({
    count: visibleItems.length,
    getScrollElement: () => kanbanScrollRef.current,
    estimateSize: () => ESTIMATED_CARD_HEIGHT,
    overscan: 3,
  });
  const useVirtualList = visibleItems.length > KANBAN_VIRTUALIZE_THRESHOLD;

  return (
    <section
      className={styles.column}
      data-status={status}
      data-drop-target={isOver ? '' : undefined}
      aria-label={`${title} column`}
    >
      {/* Column header */}
      <div className={styles.header}>
        <span className={styles.statusDot} data-status={status} aria-hidden="true" />
        <span className={styles.title}>{title}</span>
        <span className={styles.count} aria-label={`${items.length} items`}>
          ({items.length})
        </span>
        <button
          type="button"
          className={styles.addButton}
          aria-label={`Add task to ${title}`}
          title={`Add task to ${title}`}
          onClick={handleAddClick}
        >
          +
        </button>
      </div>

      {/* Column body */}
      <div ref={mergedRef} className={styles.body}>
        {visibleItems.length === 0 ? (
          <div className={styles.emptyState} aria-label={`${title} column is empty`}>
            No items
          </div>
        ) : useVirtualList ? (
          /* Virtual list — fires when column has > 50 items (e.g., Done column with showAll) */
          <ul
            ref={kanbanScrollRef}
            className={styles.cardList}
            aria-label={`${title} tasks`}
            data-testid="virtualized-scroll-container"
            style={{
              overflowY: 'auto',
              position: 'relative',
              height: `${kanbanVirtualizer.getTotalSize()}px`,
            }}
          >
            <li
              data-testid="virtualized-spacer"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${kanbanVirtualizer.getTotalSize()}px`,
                pointerEvents: 'none',
                listStyle: 'none',
              }}
              aria-hidden="true"
            />
            {kanbanVirtualizer.getVirtualItems().map((virtualItem) => {
              const item = visibleItems[virtualItem.index];
              if (!item) return null;
              const isSelected =
                multiSelect.set.has(item.id as ItemId) && multiSelect.scope === 'kanban-column';
              return (
                <li
                  key={item.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                    paddingBottom: 'var(--space-2)',
                    listStyle: 'none',
                  }}
                >
                  <SortableKanbanCard item={item} isSelected={isSelected} onKeyDown={handleCardKeyDown} />
                </li>
              );
            })}
          </ul>
        ) : (
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard access provided by individual card elements */}
            <ul className={styles.cardList} aria-label={`${title} tasks`} onClick={handleListClick}>
              {visibleItems.map((item) => {
                const isSelected =
                  multiSelect.set.has(item.id as ItemId) && multiSelect.scope === 'kanban-column';
                return (
                  <li key={item.id} style={{ marginBottom: 'var(--space-2)', listStyle: 'none' }}>
                    <SortableKanbanCard item={item} isSelected={isSelected} onKeyDown={handleCardKeyDown} />
                  </li>
                );
              })}
            </ul>
          </SortableContext>
        )}
      </div>

      {/* Done overflow footer */}
      {hasOverflow && (
        <div className={styles.overflowFooter}>
          Showing recent 50,{' '}
          <button
            type="button"
            className={styles.overflowLink}
            onClick={onShowAll}
            aria-label="Show all done items"
          >
            Show all
          </button>
        </div>
      )}
    </section>
  );
}

export default KanbanColumn;
