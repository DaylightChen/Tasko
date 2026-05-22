import { useVirtualizer } from '@tanstack/react-virtual';
import type { Item, ItemId, TagId } from '@tasko/types';
import { Hash } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
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

const VIRTUALIZE_THRESHOLD = 200;
const ESTIMATED_ROW_HEIGHT = 40;

interface TagViewProps {
  tagId: TagId;
  tagName: string;
}

export function TagView({ tagId, tagName }: TagViewProps) {
  const today = todayLocal();
  const handleTagClick = useTagNavigation();
  const [sort, setSort] = useState<string>('due_asc');

  const { data, isLoading } = useItems({
    view: 'tag',
    tag_id: tagId,
    sort: sort as 'due_asc' | 'priority_desc' | 'title_asc' | 'created_desc',
  });
  const items = (data?.items ?? []) as Item[];

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

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 5,
  });
  const useVirtualList = items.length > VIRTUALIZE_THRESHOLD;

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
      <ViewChrome
        title={`# ${tagName}`}
        sortValue={sort}
        onSortChange={setSort}
        quickAddPlaceholder={`Add task with #${tagName}`}
      >
        <div className={styles.loadingPlaceholder} aria-busy="true" />
      </ViewChrome>
    );
  }

  if (items.length === 0) {
    return (
      <ViewChrome
        title={`# ${tagName}`}
        sortValue={sort}
        onSortChange={setSort}
        quickAddPlaceholder={`Add task with #${tagName}`}
      >
        <EmptyState
          icon={Hash}
          headline={`No items tagged "${tagName}".`}
          subline="Tag tasks in the Task modal to surface them here."
        />
      </ViewChrome>
    );
  }

  return (
    <>
      <BulkActionsToolbar />
      <ViewChrome
        title={`# ${tagName}`}
        sortValue={sort}
        onSortChange={setSort}
        quickAddPlaceholder={`Add task with #${tagName}`}
      >
        {/* Subline: N items tagged "tag" across all projects — microcopy §17 */}
        <p className={styles.subline}>
          {items.length} items tagged &quot;{tagName}&quot; across all projects.
        </p>

        {useVirtualList ? (
          /* Virtual list — fires when items.length > 200 */
          <div
            ref={scrollContainerRef}
            data-testid="virtualized-scroll-container"
            style={{ height: '100%', overflowY: 'auto' }}
          >
            <ul
              className={styles.list}
              aria-label={`Items tagged ${tagName}`}
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
                const item = items[virtualItem.index];
                if (!item) return null;
                const breadcrumb = getProjectBreadcrumb(item.project_id);
                const projectProp = breadcrumb !== undefined ? { project: breadcrumb } : {};
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
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
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
        )}
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
