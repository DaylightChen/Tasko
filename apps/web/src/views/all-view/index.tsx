import type { Item, ItemId } from '@tasko/types';
import { List } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useFolders } from '../../api/folders';
import { useDeleteItem, useEditTitleInline, useItems, useToggleComplete } from '../../api/items';
import { useProjects } from '../../api/projects';
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

export function AllView() {
  const today = todayLocal();
  const handleTagClick = useTagNavigation();
  const [sort, setSort] = useState<string>('due_asc');

  const { data, isLoading } = useItems({
    view: 'all',
    sort: sort as 'due_asc' | 'priority_desc' | 'title_asc' | 'created_desc',
  });
  const items = (data?.items ?? ([] as Item[])).filter(
    (i) => i.status !== 'done' && i.trashed_at === null,
  ) as Item[];

  const { data: projectsData } = useProjects();
  const { data: foldersData } = useFolders();

  const projects = projectsData?.projects ?? [];
  const folders = foldersData?.folders ?? [];

  const toggleComplete = useToggleComplete();
  const editTitleInline = useEditTitleInline();
  const deleteItem = useDeleteItem();
  const taskModal = useTaskModalStore();

  const [deleteConfirmItem, setDeleteConfirmItem] = useState<Item | null>(null);
  const [inlineEditId, setInlineEditId] = useState<ItemId | null>(null);

  const visibleIds = useMemo(() => items.map((i) => i.id as ItemId), [items]);
  const { handleListClick, multiSelect } = useMultiSelect(visibleIds, 'list');

  // Build project breadcrumb lookup
  const getProjectBreadcrumb = (
    projectId: string,
  ): { name: string; folder?: { name: string } } | undefined => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return undefined;
    const folder = project.folder_id ? folders.find((f) => f.id === project.folder_id) : undefined;
    const result: { name: string; folder?: { name: string } } = { name: project.name };
    if (folder) result.folder = { name: folder.name };
    return result;
  };

  if (isLoading && items.length === 0) {
    return (
      <ViewChrome title="All" sortValue={sort} onSortChange={setSort}>
        <div aria-busy="true" className={styles.loadingPlaceholder} />
      </ViewChrome>
    );
  }

  if (items.length === 0) {
    return (
      <ViewChrome title="All" sortValue={sort} onSortChange={setSort}>
        <EmptyState icon={List} headline="No active items." subline="Add a task or start a project." />
      </ViewChrome>
    );
  }

  return (
    <>
      <BulkActionsToolbar />
      <ViewChrome title="All" sortValue={sort} onSortChange={setSort}>
        {/* Subline: Showing N active items across all projects */}
        <p className={styles.subline}>Showing {items.length} active items across all projects.</p>

        <ListDndContext items={items}>
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard access provided by individual <li> rows */}
          <ul className={styles.list} onClick={handleListClick}>
            {items.map((item) => {
              const breadcrumb = getProjectBreadcrumb(item.project_id);
              const projectProp = breadcrumb !== undefined ? { project: breadcrumb } : {};
              return (
                <SortableTaskRow key={item.id} item={item}>
                  {(sortableProps) => (
                    <TaskListRow
                      {...projectProp}
                      item={item}
                      todayLocalDate={today}
                      isFocused={false}
                      isMultiSelected={multiSelect.set.has(item.id as ItemId)}
                      showProjectBreadcrumb
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
              );
            })}
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
