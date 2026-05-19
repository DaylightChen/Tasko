import type { Item, ItemId } from '@tasko/types';
import { Inbox } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useDeleteItem, useEditTitleInline, useItems, useToggleComplete } from '../../api/items';
import { ConfirmationPrompt } from '../../components/confirmation-prompt';
import { EmptyState } from '../../components/empty-state';
import { TaskListRow } from '../../components/task-list-row';
import { useMultiSelect } from '../../hooks/useMultiSelect';
import { useTagNavigation } from '../../hooks/useTagNavigation';
import { todayLocal } from '../../lib/date-fmt';
import { useTaskModalStore } from '../../store/task-modal';
import { BulkActionsToolbar } from '../_shared/BulkActionsToolbar';
import { ListDndContext, SortableTaskRow } from '../_shared/ListDndContext';
import { ViewChrome } from '../_shared/ViewChrome';
import styles from './styles.module.css';

export function InboxView() {
  const today = todayLocal();
  const handleTagClick = useTagNavigation();
  // Inbox default sort: created_desc per microcopy §9
  const [sort, setSort] = useState<string>('created_desc');

  const { data, isLoading } = useItems({
    view: 'inbox',
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

  const visibleIds = useMemo(() => items.map((i) => i.id as ItemId), [items]);
  const { handleListClick, multiSelect } = useMultiSelect(visibleIds, 'list');

  if (isLoading && items.length === 0) {
    return (
      <ViewChrome
        title="Inbox"
        sortValue={sort}
        onSortChange={setSort}
        quickAddPlaceholder="Add task to Inbox"
      >
        <div aria-busy="true" className={styles.loadingPlaceholder} />
      </ViewChrome>
    );
  }

  if (items.length === 0) {
    return (
      <ViewChrome
        title="Inbox"
        sortValue={sort}
        onSortChange={setSort}
        quickAddPlaceholder="Add task to Inbox"
      >
        <EmptyState
          icon={Inbox}
          headline="Inbox is clear."
          subline="Quick-add lands here when no project is picked."
        />
      </ViewChrome>
    );
  }

  return (
    <>
      <BulkActionsToolbar />
      <ViewChrome
        title="Inbox"
        sortValue={sort}
        onSortChange={setSort}
        quickAddPlaceholder="Add task to Inbox"
      >
        {/* Subline: N items waiting to be filed */}
        <p className={styles.subline}>{items.length} items waiting to be filed.</p>

        <ListDndContext items={items}>
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard access provided by individual <li> rows */}
          <ul className={styles.list} onClick={handleListClick}>
            {items.map((item) => (
              <SortableTaskRow key={item.id} item={item}>
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
              </SortableTaskRow>
            ))}
          </ul>
        </ListDndContext>
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
