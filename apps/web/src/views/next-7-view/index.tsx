import { useVirtualizer } from '@tanstack/react-virtual';
import type { Item, ItemId, LocalDate, TagId } from '@tasko/types';
import { CalendarDays } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useDeleteItem, useEditTitleInline, useItems, useToggleComplete } from '../../api/items';
import { ConfirmationPrompt } from '../../components/confirmation-prompt';
import { EmptyState } from '../../components/empty-state';
import { TaskListRow } from '../../components/task-list-row';
import { useMultiSelect } from '../../hooks/useMultiSelect';
import { useTagNavigation } from '../../hooks/useTagNavigation';
import { todayLocal } from '../../lib/date-fmt';
import { useTaskModalStore } from '../../store/task-modal';
import { BulkActionsToolbar } from '../_shared/BulkActionsToolbar';
import { ViewChrome } from '../_shared/ViewChrome';
import { DroppableDayGroup, Next7DndContext, SortableNext7Row } from './Next7DndContext';
import styles from './styles.module.css';

/**
 * Format a LocalDate as "Wed, May 18"
 */
function formatDayMonthDD(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dow = weekdays[d.getUTCDay()] ?? '';
  const month = months[d.getUTCMonth()] ?? '';
  const day = d.getUTCDate();
  return `${dow}, ${month} ${day}`;
}

/**
 * Add N days to a LocalDate string, return the new LocalDate string.
 */
function addDays(date: LocalDate, n: number): LocalDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10) as LocalDate;
}

interface DayGroup {
  date: LocalDate;
  label: string;
  items: Item[];
}

const N7_VIRTUALIZE_THRESHOLD = 200;
const ESTIMATED_ROW_HEIGHT = 40;

// Sub-component so useVirtualizer can be called per group (hooks can't be in .map())
interface VirtualizedDayItemsProps {
  items: Item[];
  date: LocalDate;
  today: ReturnType<typeof todayLocal>;
  multiSelectSet: Set<ItemId>;
  inlineEditId: ItemId | null;
  taskModal: { openEdit: (id: ItemId) => void };
  toggleComplete: ReturnType<typeof useToggleComplete>;
  editTitleInline: ReturnType<typeof useEditTitleInline>;
  deleteItem: ReturnType<typeof useDeleteItem>;
  handleTagClick: (tagId: TagId) => void;
  setInlineEditId: (id: ItemId | null) => void;
  setDeleteConfirmItem: (item: Item | null) => void;
}

function VirtualizedDayItems({
  items,
  today,
  multiSelectSet,
  inlineEditId,
  taskModal,
  toggleComplete,
  editTitleInline,
  deleteItem: _deleteItem,
  handleTagClick,
  setInlineEditId,
  setDeleteConfirmItem,
}: VirtualizedDayItemsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 5,
  });

  return (
    <div
      ref={scrollRef}
      data-testid="virtualized-scroll-container"
      style={{ height: '100%', overflowY: 'auto' }}
    >
      <ul
        className={styles.list}
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
          listStyle: 'none',
          margin: 0,
          padding: 0,
        }}
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
            listStyle: 'none',
          }}
          aria-hidden="true"
        />
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const item = items[virtualItem.index];
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
                listStyle: 'none',
              }}
            >
              <TaskListRow
                item={item}
                todayLocalDate={today}
                isFocused={false}
                isMultiSelected={multiSelectSet.has(item.id as ItemId)}
                inlineEditMode={inlineEditId === (item.id as ItemId)}
                onClick={() => taskModal.openEdit(item.id as ItemId)}
                onToggleCheckbox={() =>
                  toggleComplete.mutate({
                    id: item.id as ItemId,
                    nextStatus: item.status === 'done' ? 'todo' : 'done',
                  })
                }
                onTitleClickInlineEdit={() => setInlineEditId(item.id as ItemId)}
                onTitleCommitInlineEdit={(newTitle) => {
                  setInlineEditId(null);
                  if (newTitle !== item.title) {
                    editTitleInline.mutate({ id: item.id as ItemId, title: newTitle });
                  }
                }}
                onDeleteRequest={() => setDeleteConfirmItem(item)}
                onOpenChevronClick={() => taskModal.openEdit(item.id as ItemId)}
                onTagClick={handleTagClick}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Next7DaysView() {
  const today = todayLocal();
  const handleTagClick = useTagNavigation();
  const [sort, setSort] = useState<string>('due_asc');

  const { data, isLoading } = useItems({
    view: 'next7',
    sort: sort as 'due_asc' | 'priority_desc' | 'title_asc' | 'created_desc',
  });
  const rawItems = (data?.items ?? ([] as Item[])).filter(
    (i) => i.status !== 'done' && i.trashed_at === null,
  ) as Item[];

  // Build 7 day buckets: today through today+6
  const dayGroups = useMemo((): DayGroup[] => {
    const groups: DayGroup[] = [];

    for (let i = 0; i < 7; i++) {
      const date = addDays(today, i);
      let label: string;
      if (i === 0) label = `Today, ${formatDayMonthDD(date)}`;
      else if (i === 1) label = `Tomorrow, ${formatDayMonthDD(date)}`;
      else label = formatDayMonthDD(date);

      // Items appear in every day bucket their span covers
      const dayItems = rawItems.filter((item) => {
        const start = item.start_date ?? item.due_date;
        const end = item.due_date;
        return start <= date && date <= end;
      });

      groups.push({ date, label, items: dayItems });
    }

    return groups;
  }, [rawItems, today]);

  const toggleComplete = useToggleComplete();
  const editTitleInline = useEditTitleInline();
  const deleteItem = useDeleteItem();
  const taskModal = useTaskModalStore();

  const [deleteConfirmItem, setDeleteConfirmItem] = useState<Item | null>(null);
  const [inlineEditId, setInlineEditId] = useState<ItemId | null>(null);

  // Deduplicated visible ids (items can appear in multiple day buckets but only count once)
  const allVisibleIds = useMemo(() => [...new Set(rawItems.map((i) => i.id as ItemId))], [rawItems]);
  const { handleListClick, multiSelect } = useMultiSelect(allVisibleIds, 'list');

  const totalItems = rawItems.length;

  if (isLoading && totalItems === 0) {
    return (
      <ViewChrome title="Next 7 Days" sortValue={sort} onSortChange={setSort}>
        <div aria-busy="true" className={styles.loadingPlaceholder} />
      </ViewChrome>
    );
  }

  if (totalItems === 0) {
    return (
      <ViewChrome title="Next 7 Days" sortValue={sort} onSortChange={setSort}>
        <EmptyState
          icon={CalendarDays}
          headline="Nothing in the next seven days."
          subline="A quiet week. Or just unscheduled."
        />
      </ViewChrome>
    );
  }

  return (
    <>
      <BulkActionsToolbar />
      <ViewChrome title="Next 7 Days" sortValue={sort} onSortChange={setSort}>
        <Next7DndContext allItems={rawItems}>
          <div className={styles.groups}>
            {dayGroups.map(({ date, label, items }) => (
              <section key={date} className={styles.dayGroup} aria-label={`${label}, ${items.length} items`}>
                {items.length === 0 ? (
                  <h2 className={styles.dayHeaderEmpty}>
                    {formatDayMonthDD(date)} <span className={styles.emptyDash}>— empty</span>
                  </h2>
                ) : (
                  <>
                    <h2 className={styles.dayHeader}>
                      {label} <span className={styles.countBadge}>({items.length})</span>
                    </h2>
                    <DroppableDayGroup date={date} itemIds={items.map((i) => `${i.id}:${date}`)}>
                      {items.length > N7_VIRTUALIZE_THRESHOLD ? (
                        /* Virtual list for very large day groups */
                        <VirtualizedDayItems
                          items={items}
                          date={date}
                          today={today}
                          multiSelectSet={multiSelect.set}
                          inlineEditId={inlineEditId}
                          taskModal={taskModal}
                          toggleComplete={toggleComplete}
                          editTitleInline={editTitleInline}
                          deleteItem={deleteItem}
                          handleTagClick={handleTagClick}
                          setInlineEditId={setInlineEditId}
                          setDeleteConfirmItem={setDeleteConfirmItem}
                        />
                      ) : (
                        /* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard access provided by individual <li> rows */
                        <ul className={styles.list} onClick={handleListClick}>
                          {items.map((item) => (
                            <SortableNext7Row key={`${item.id}-${date}`} item={item} groupDate={date}>
                              {(sortableProps) => (
                                <TaskListRow
                                  item={item}
                                  todayLocalDate={today}
                                  isFocused={false}
                                  isMultiSelected={multiSelect.set.has(item.id as ItemId)}
                                  inlineEditMode={inlineEditId === (item.id as ItemId)}
                                  onClick={() => taskModal.openEdit(item.id as ItemId)}
                                  onToggleCheckbox={() =>
                                    toggleComplete.mutate({
                                      id: item.id as ItemId,
                                      nextStatus: item.status === 'done' ? 'todo' : 'done',
                                    })
                                  }
                                  onTitleClickInlineEdit={() => setInlineEditId(item.id as ItemId)}
                                  onTitleCommitInlineEdit={(newTitle) => {
                                    setInlineEditId(null);
                                    if (newTitle !== item.title) {
                                      editTitleInline.mutate({ id: item.id as ItemId, title: newTitle });
                                    }
                                  }}
                                  onDeleteRequest={() => setDeleteConfirmItem(item)}
                                  onOpenChevronClick={() => taskModal.openEdit(item.id as ItemId)}
                                  onTagClick={handleTagClick}
                                  {...sortableProps}
                                />
                              )}
                            </SortableNext7Row>
                          ))}
                        </ul>
                      )}
                    </DroppableDayGroup>
                  </>
                )}
              </section>
            ))}
          </div>
        </Next7DndContext>
      </ViewChrome>

      <ConfirmationPrompt
        open={deleteConfirmItem !== null}
        onCancel={() => setDeleteConfirmItem(null)}
        onConfirm={() => {
          if (deleteConfirmItem) deleteItem.mutate({ id: deleteConfirmItem.id as ItemId });
          setDeleteConfirmItem(null);
        }}
        title="Move to Trash?"
        body={`"${deleteConfirmItem?.title ?? ''}" will be moved to Trash. You can restore it later.`}
        confirmLabel="Move to Trash"
        destructive={false}
        isPending={deleteItem.isPending}
      />
    </>
  );
}
