import { useVirtualizer } from '@tanstack/react-virtual';
import type { Item, ItemId, ProjectId } from '@tasko/types';
import { List, SquareKanban } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useCreateItem, useItems, usePatchItem } from '../../api/items';
import { EmptyState } from '../../components/empty-state';
import { TaskListRow } from '../../components/task-list-row';
import { ViewToggle } from '../../components/view-toggle';
import type { ViewOption } from '../../components/view-toggle';
import { useMultiSelect } from '../../hooks/useMultiSelect';
import { useTagNavigation } from '../../hooks/useTagNavigation';
import { todayLocal } from '../../lib/date-fmt';
import { useTaskModalStore } from '../../store/task-modal';
import { BulkActionsToolbar } from '../_shared/BulkActionsToolbar';
import { ListDndContext, SortableTaskRow } from '../_shared/ListDndContext';
import styles from './flat-list-view.module.css';

const VIRTUALIZE_THRESHOLD = 200;
const ESTIMATED_ROW_HEIGHT = 40;

interface FlatListViewProps {
  projectId: ProjectId;
  projectName: string;
  onNavigateKanban: () => void;
}

export function FlatListView({ projectId, projectName, onNavigateKanban }: FlatListViewProps) {
  const today = todayLocal();
  const taskModal = useTaskModalStore();
  const handleTagClick = useTagNavigation();
  const [currentView, setCurrentView] = useState<string>('list');
  const [showCompleted, setShowCompleted] = useState(false);
  const [inlineEditId, setInlineEditId] = useState<ItemId | null>(null);

  const { data: itemsData, isLoading } = useItems({
    view: 'project',
    project_id: projectId,
    include_completed: showCompleted,
  });

  const allItems = (itemsData?.items ?? []) as Item[];
  const activeItems = allItems.filter((i) => i.status !== 'done');
  const completedItems = allItems.filter((i) => i.status === 'done');

  const createItem = useCreateItem();
  const patchItem = usePatchItem();

  const activeIds = useMemo(() => activeItems.map((i) => i.id as ItemId), [activeItems]);
  const { handleListClick, multiSelect } = useMultiSelect(activeIds, 'list');

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: activeItems.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 5,
  });
  const useVirtualList = activeItems.length > VIRTUALIZE_THRESHOLD;

  const VIEW_OPTIONS: ViewOption[] = [
    { value: 'list', icon: List, label: 'List view' },
    { value: 'kanban', icon: SquareKanban, label: 'Kanban view' },
  ];

  const handleViewChange = (value: string) => {
    setCurrentView(value);
    if (value === 'kanban') onNavigateKanban();
  };

  const handleQuickAdd = (title: string) => {
    createItem.mutate({
      type: 'task',
      project_id: projectId,
      parent_id: null,
      title,
      due_date: today,
      start_date: null,
      due_time: null,
      priority: 'none',
      status: 'todo',
      tags: [],
      recurrence: null,
      notes: '',
    });
  };

  if (isLoading && allItems.length === 0) {
    return (
      <div className={styles.root} aria-busy="true">
        <div className={styles.loadingPlaceholder} />
      </div>
    );
  }

  return (
    <>
      <BulkActionsToolbar />
      <div className={styles.root}>
        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.heading}>{projectName}</h1>
          <ViewToggle options={VIEW_OPTIONS} value={currentView} onChange={handleViewChange} />
        </div>

        {/* Quick add */}
        <div className={styles.quickAddRow}>
          <input
            type="text"
            className={styles.quickAddInput}
            placeholder="+ Add task"
            aria-label="Add task to project"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                handleQuickAdd(e.currentTarget.value.trim());
                e.currentTarget.value = '';
              }
            }}
          />
        </div>

        {/* Active items */}
        {activeItems.length === 0 && !showCompleted ? (
          <EmptyState
            icon={List}
            headline={`No tasks in ${projectName} yet.`}
            subline="Add one above."
            tone="neutral"
          />
        ) : useVirtualList ? (
          /* Virtual list — fires when activeItems.length > 200 */
          <div
            ref={scrollContainerRef}
            data-testid="virtualized-scroll-container"
            style={{ height: '100%', overflowY: 'auto' }}
          >
            <ul
              className={styles.list}
              aria-label={`${projectName} active tasks`}
              style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
            >
              <li
                data-testid="virtualized-spacer"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualizer.getTotalSize()}px`,
                  pointerEvents: 'none',
                }}
                aria-hidden="true"
              />
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const item = activeItems[virtualItem.index];
                if (!item) return null;
                return (
                  <li
                    key={item.id}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <TaskListRow
                      item={item}
                      todayLocalDate={today}
                      isMultiSelected={multiSelect.set.has(item.id as ItemId)}
                      inlineEditMode={inlineEditId === (item.id as ItemId)}
                      onClick={() => taskModal.openEdit(item.id as ItemId)}
                      onToggleCheckbox={() =>
                        patchItem.mutate({
                          id: item.id as ItemId,
                          patch: { status: item.status === 'done' ? 'todo' : 'done' },
                        })
                      }
                      onTitleClickInlineEdit={() => setInlineEditId(item.id as ItemId)}
                      onTitleCommitInlineEdit={(newTitle) => {
                        setInlineEditId(null);
                        if (newTitle !== item.title) {
                          patchItem.mutate({ id: item.id as ItemId, patch: { title: newTitle } });
                        }
                      }}
                      onOpenChevronClick={() => taskModal.openEdit(item.id as ItemId)}
                      onTagClick={handleTagClick}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <ListDndContext items={activeItems}>
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard access provided by individual <li> rows */}
            <ul className={styles.list} onClick={handleListClick}>
              {activeItems.map((item) => (
                <SortableTaskRow key={item.id} item={item}>
                  {(sortableProps) => (
                    <TaskListRow
                      item={item}
                      todayLocalDate={today}
                      isMultiSelected={multiSelect.set.has(item.id as ItemId)}
                      inlineEditMode={inlineEditId === (item.id as ItemId)}
                      onClick={() => taskModal.openEdit(item.id as ItemId)}
                      onToggleCheckbox={() =>
                        patchItem.mutate({
                          id: item.id as ItemId,
                          patch: { status: item.status === 'done' ? 'todo' : 'done' },
                        })
                      }
                      onTitleClickInlineEdit={() => setInlineEditId(item.id as ItemId)}
                      onTitleCommitInlineEdit={(newTitle) => {
                        setInlineEditId(null);
                        if (newTitle !== item.title) {
                          patchItem.mutate({ id: item.id as ItemId, patch: { title: newTitle } });
                        }
                      }}
                      onOpenChevronClick={() => taskModal.openEdit(item.id as ItemId)}
                      onTagClick={handleTagClick}
                      {...sortableProps}
                    />
                  )}
                </SortableTaskRow>
              ))}
            </ul>
          </ListDndContext>
        )}

        {/* Show / hide completed */}
        {completedItems.length > 0 && (
          <button
            type="button"
            className={styles.showCompletedBtn}
            onClick={() => setShowCompleted((v) => !v)}
          >
            {showCompleted ? 'Hide completed' : `Show ${completedItems.length} completed`}
          </button>
        )}

        {/* Completed items (when expanded) */}
        {showCompleted && completedItems.length > 0 && (
          <ul className={styles.completedList}>
            {completedItems.map((item) => (
              <TaskListRow
                key={item.id}
                item={item}
                todayLocalDate={today}
                onClick={() => taskModal.openEdit(item.id as ItemId)}
                onToggleCheckbox={() =>
                  patchItem.mutate({
                    id: item.id as ItemId,
                    patch: { status: 'todo' },
                  })
                }
                onOpenChevronClick={() => taskModal.openEdit(item.id as ItemId)}
                onTagClick={handleTagClick}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
