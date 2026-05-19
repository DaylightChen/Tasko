import type { Item, ItemId } from '@tasko/types';
import { CheckCircle2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useConfig } from '../../api/config';
import { useFolders } from '../../api/folders';
import { useDeleteItem, useItems, useToggleComplete } from '../../api/items';
import { useProjects } from '../../api/projects';
import { ConfirmationPrompt } from '../../components/confirmation-prompt';
import { EmptyState } from '../../components/empty-state';
import { TaskListRow } from '../../components/task-list-row';
import { useTagNavigation } from '../../hooks/useTagNavigation';
import { todayLocal } from '../../lib/date-fmt';
import { useTaskModalStore } from '../../store/task-modal';
import { groupCompleted } from './grouping';
import type { CompletedGroup } from './grouping';
import styles from './styles.module.css';

// ─── Timestamp formatting ─────────────────────────────────────────────────────

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Format the completed_at timestamp for display on the right of each row.
 * - today group:                       "09:42" (HH:MM, 24h)
 * - yesterday / earlier_this_week:     "Tue 8:14" (day abbrev + H:MM, no leading zero on hour)
 * - last_week / earlier_this_month / earlier: "May 12" (MonAbbrev DD)
 */
function formatCompletedTimestamp(completedAt: string, group: CompletedGroup): string {
  const d = new Date(completedAt);

  if (group === 'today') {
    const h = String(d.getUTCHours()).padStart(2, '0');
    const m = String(d.getUTCMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  if (group === 'yesterday' || group === 'earlier_this_week') {
    const dow = WEEKDAY_SHORT[d.getUTCDay()] ?? '';
    const h = d.getUTCHours();
    const m = String(d.getUTCMinutes()).padStart(2, '0');
    return `${dow} ${h}:${m}`;
  }

  // last_week, earlier_this_month, earlier → "May 12"
  const mon = MONTH_SHORT[d.getUTCMonth()] ?? '';
  const day = d.getUTCDate();
  return `${mon} ${day}`;
}

// ─── CompletedView ────────────────────────────────────────────────────────────

export function CompletedView() {
  const today = todayLocal();
  const handleTagClick = useTagNavigation();
  const { data: configData } = useConfig();
  const [sort, setSort] = useState<'completed_desc' | 'title_asc'>('completed_desc');

  const { data, isLoading } = useItems({
    view: 'completed',
    sort: 'completed_desc',
  });
  const allItems = (data?.items ?? []) as Item[];

  // For title sort, sort client-side after grouping
  const sortedItems = useMemo(() => {
    if (sort === 'title_asc') {
      return [...allItems].sort((a, b) => a.title.localeCompare(b.title));
    }
    return allItems;
  }, [allItems, sort]);

  const { data: projectsData } = useProjects();
  const { data: foldersData } = useFolders();

  const projects = projectsData?.projects ?? [];
  const folders = foldersData?.folders ?? [];

  const toggleComplete = useToggleComplete();
  const deleteItem = useDeleteItem();
  const taskModal = useTaskModalStore();

  const [deleteConfirmItem, setDeleteConfirmItem] = useState<Item | null>(null);

  const groups = useMemo(
    () => groupCompleted(sortedItems, today, configData?.week_start ?? 'mon'),
    [sortedItems, today, configData?.week_start],
  );

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

  if (isLoading && allItems.length === 0) {
    return (
      <div className={styles.root}>
        <div className={styles.header}>
          <h1 className={styles.title}>Completed</h1>
          <div className={styles.headerRight}>
            <select
              className={styles.sortSelect}
              value={sort}
              onChange={(e) => setSort(e.target.value as 'completed_desc' | 'title_asc')}
              aria-label="Sort order"
            >
              <option value="completed_desc">Recently completed</option>
              <option value="title_asc">Title (A–Z)</option>
            </select>
          </div>
        </div>
        <div aria-busy="true" className={styles.loadingPlaceholder} />
      </div>
    );
  }

  if (allItems.length === 0) {
    return (
      <div className={styles.root}>
        <div className={styles.header}>
          <h1 className={styles.title}>Completed</h1>
        </div>
        <EmptyState icon={CheckCircle2} headline="Nothing completed yet." subline="Done tasks land here." />
      </div>
    );
  }

  return (
    <>
      <div className={styles.root}>
        <div className={styles.header}>
          <h1 className={styles.title}>Completed</h1>
          <div className={styles.headerRight}>
            <select
              className={styles.sortSelect}
              value={sort}
              onChange={(e) => setSort(e.target.value as 'completed_desc' | 'title_asc')}
              aria-label="Sort order"
            >
              <option value="completed_desc">Recently completed</option>
              <option value="title_asc">Title (A–Z)</option>
            </select>
          </div>
        </div>

        {groups.map(({ group, label, items }) => (
          <section key={group} className={styles.group} aria-label={label}>
            <h2 className={styles.groupHeader}>{label}</h2>
            <div className={styles.list}>
              {items.map((item) => {
                const breadcrumb = getProjectBreadcrumb(item.project_id);
                const projectProp = breadcrumb !== undefined ? { project: breadcrumb } : {};
                const timestamp = item.completed_at
                  ? formatCompletedTimestamp(item.completed_at, group)
                  : undefined;

                return (
                  <div key={item.id} className={styles.completedRowWrapper}>
                    <TaskListRow
                      {...projectProp}
                      item={item}
                      todayLocalDate={today}
                      isFocused={false}
                      showProjectBreadcrumb
                      onClick={() => taskModal.openEdit(item.id as ItemId)}
                      onToggleCheckbox={() =>
                        toggleComplete.mutate({
                          id: item.id as ItemId,
                          nextStatus: 'todo',
                        })
                      }
                      onDeleteRequest={() => setDeleteConfirmItem(item)}
                      onOpenChevronClick={() => taskModal.openEdit(item.id as ItemId)}
                      onTagClick={handleTagClick}
                    />
                    {timestamp && (
                      <span className={styles.timestamp} aria-label={`Completed at ${timestamp}`}>
                        {timestamp}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

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
