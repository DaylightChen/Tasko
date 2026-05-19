import type { ItemId } from '@tasko/types';
import type { Item } from '@tasko/types';
import { Sunrise } from 'lucide-react';
import { useState } from 'react';
import { useDeleteItem, useEditTitleInline, useItems, useToggleComplete } from '../../api/items';
import { ConfirmationPrompt } from '../../components/confirmation-prompt';
import { EmptyState } from '../../components/empty-state';
import { TaskListRow } from '../../components/task-list-row';
import { todayLocal } from '../../lib/date-fmt';
import { useTaskModalStore } from '../../store/task-modal';
import { ViewChrome } from '../_shared/ViewChrome';
import styles from './styles.module.css';

/**
 * Format a LocalDate as "Thu, May 19" for the Tomorrow section header.
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

export function TomorrowView() {
  const today = todayLocal();
  const tomorrow = new Date(`${today}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const [sort, setSort] = useState<string>('due_asc');
  const { data, isLoading } = useItems({
    view: 'tomorrow',
    sort: sort as 'due_asc' | 'priority_desc' | 'title_asc' | 'created_desc',
  });
  const items = (data?.items ?? ([] as Item[])).filter(
    (i) => i.status !== 'done' && i.trashed_at === null,
  ) as Item[];

  const toggleComplete = useToggleComplete();
  const editTitleInline = useEditTitleInline();
  const deleteItem = useDeleteItem();
  const taskModal = useTaskModalStore();

  const [deleteConfirmItem, setDeleteConfirmItem] = useState<Item | null>(null);
  const [inlineEditId, setInlineEditId] = useState<ItemId | null>(null);

  if (isLoading && items.length === 0) {
    return (
      <ViewChrome title="Tomorrow" sortValue={sort} onSortChange={setSort}>
        <div aria-busy="true" className={styles.loadingPlaceholder} />
      </ViewChrome>
    );
  }

  if (items.length === 0) {
    return (
      <ViewChrome title="Tomorrow" sortValue={sort} onSortChange={setSort}>
        <EmptyState
          icon={Sunrise}
          headline="Nothing scheduled for tomorrow."
          subline="Plan ahead — add a task."
        />
      </ViewChrome>
    );
  }

  return (
    <>
      <ViewChrome title="Tomorrow" sortValue={sort} onSortChange={setSort}>
        <section className={styles.section} aria-label={`Tomorrow, ${items.length} items`}>
          <h2 className={styles.sectionTitle}>{formatDayMonthDD(tomorrowStr)}</h2>
          <ul className={styles.list}>
            {items.map((item) => (
              <TaskListRow
                key={item.id}
                item={item}
                todayLocalDate={today}
                isFocused={false}
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
              />
            ))}
          </ul>
        </section>
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
