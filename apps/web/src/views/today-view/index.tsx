import type { Item, ItemId, LocalDate, Priority, Status } from '@tasko/types';
import { Sun, Sunrise } from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import {
  useBulkMoveOverdue,
  useChangePriority,
  useDeleteItem,
  useEditTitleInline,
  useItems,
  useReschedule,
  useToggleComplete,
} from '../../api/items';
import { ConfirmationPrompt } from '../../components/confirmation-prompt';
import { EmptyState } from '../../components/empty-state';
import { TaskListRow } from '../../components/task-list-row';
import { useFocusedRow } from '../../hooks/useFocusedRow';
import { todayLocal } from '../../lib/date-fmt';
import { useTaskModalStore } from '../../store/task-modal';
import { ViewChrome } from '../_shared/ViewChrome';
import { partitionOverdue } from './partition';
import styles from './styles.module.css';

// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * Format a LocalDate as "Wed, May 18"
 */
function formatDayMonthDD(date: LocalDate): string {
  const d = new Date(`${date}T00:00:00Z`);
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dow = weekdays[d.getUTCDay()] ?? '';
  const month = months[d.getUTCMonth()] ?? '';
  const day = d.getUTCDate();
  return `${dow}, ${month} ${day}`;
}

// ─── Today view ───────────────────────────────────────────────────────────────

export function TodayView() {
  const today = todayLocal();

  // Sort state — in v1 this is local state; task-18 will wire to URL search param
  const [sort, setSort] = useState<string>('due_asc');

  const { data, isLoading } = useItems({
    view: 'today',
    sort: sort as 'due_asc' | 'priority_desc' | 'title_asc' | 'created_desc',
  });
  const items = (data?.items ?? []) as Item[];

  // First-run detection: check if there are any items ever created (including completed)
  const { data: allData } = useItems({ view: 'all', include_completed: true });
  const isFirstRun = !isLoading && (allData?.count ?? 0) === 0;

  const { overdue, todays } = useMemo(() => partitionOverdue(items, today), [items, today]);

  const allVisible = useMemo(() => [...overdue, ...todays], [overdue, todays]);
  const { focusedId, moveFocus } = useFocusedRow(allVisible);

  // Mutations
  const toggleComplete = useToggleComplete();
  const reschedule = useReschedule();
  const changePriority = useChangePriority();
  const editTitleInline = useEditTitleInline();
  const deleteItem = useDeleteItem();
  const bulkMoveOverdue = useBulkMoveOverdue();

  const taskModal = useTaskModalStore();

  // Confirmation prompt state
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<Item | null>(null);
  const [parentCompletionItem, setParentCompletionItem] = useState<Item | null>(null);

  // Inline edit tracking
  const [inlineEditId, setInlineEditId] = useState<ItemId | null>(null);

  const handleToggleCheckbox = (item: Item) => {
    const incompleteSubtasks = item.subtasks.filter((s) => s.status !== 'done');
    if (incompleteSubtasks.length > 0 && item.status !== 'done') {
      setParentCompletionItem(item);
      return;
    }
    const nextStatus: Status = item.status === 'done' ? 'todo' : 'done';
    toggleComplete.mutate({ id: item.id as ItemId, nextStatus });
  };

  const handleConfirmParentCompletion = () => {
    if (!parentCompletionItem) return;
    const item = parentCompletionItem;
    setParentCompletionItem(null);
    toggleComplete.mutate({ id: item.id as ItemId, nextStatus: 'done' });
  };

  const PRIORITY_KEY_MAP: Record<string, Priority> = {
    '1': 'none',
    '2': 'low',
    '3': 'medium',
    '4': 'high',
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (document.activeElement instanceof HTMLInputElement) return;
    if (document.activeElement instanceof HTMLTextAreaElement) return;

    switch (e.key) {
      case 'j':
      case 'J':
      case 'ArrowDown':
        e.preventDefault();
        moveFocus(1);
        break;
      case 'k':
      case 'K':
      case 'ArrowUp':
        e.preventDefault();
        moveFocus(-1);
        break;
      case '1':
      case '2':
      case '3':
      case '4': {
        const priority = PRIORITY_KEY_MAP[e.key];
        // Find focused item via state (J/K navigation) or via DOM focus fallback
        const activeItemId =
          focusedId ??
          (e.target instanceof HTMLElement
            ? (e.target.closest('[data-item-id]')?.getAttribute('data-item-id') ?? null)
            : null);
        const focusedItem = allVisible.find((item) => item.id === activeItemId);
        if (priority !== undefined && focusedItem) {
          changePriority.mutate({ id: focusedItem.id as ItemId, priority });
        }
        break;
      }
    }
  };

  const isEmpty = overdue.length === 0 && todays.length === 0;

  if (isLoading && items.length === 0) {
    return (
      <ViewChrome title="Today" sortValue={sort} onSortChange={setSort}>
        <div className={styles.loadingPlaceholder} aria-busy="true" />
      </ViewChrome>
    );
  }

  if (isEmpty) {
    if (isFirstRun) {
      return (
        <ViewChrome
          title="Today"
          sortValue={sort}
          onSortChange={setSort}
          quickAddPlaceholder="Add task"
          quickAddInitialFocus
        >
          <div className={styles.firstRunHint}>
            <span className={styles.startHereArrow}>↑</span>
            <span className={styles.startHereLabel}>start here</span>
          </div>
          <EmptyState
            icon={Sunrise}
            headline="Welcome to Tasko."
            subline="Add your first task above — type it and press Enter."
            tone="flourish"
          />
        </ViewChrome>
      );
    }

    return (
      <ViewChrome title="Today" sortValue={sort} onSortChange={setSort} quickAddPlaceholder="Add task">
        <EmptyState
          icon={Sun}
          headline="Nothing due today."
          subline="You're caught up. Enjoy the day."
          tone="flourish"
        />
      </ViewChrome>
    );
  }

  return (
    <>
      <ViewChrome title="Today" sortValue={sort} onSortChange={setSort} quickAddPlaceholder="Add task">
        <div className={styles.viewBody} onKeyDown={handleKeyDown} tabIndex={-1}>
          {/* Overdue strip */}
          {overdue.length > 0 && (
            <section className={styles.section} aria-label={`Overdue, ${overdue.length} items`}>
              <div className={styles.overdueHeader}>
                <h2 className={styles.sectionTitle}>Overdue ({overdue.length})</h2>
                <button type="button" className={styles.ghostBtn} onClick={() => setBulkConfirmOpen(true)}>
                  Move all overdue to today
                </button>
              </div>
              <ul className={styles.list}>
                {overdue.map((item) => (
                  <TaskListRow
                    key={item.id}
                    item={item}
                    todayLocalDate={today}
                    isFocused={focusedId === item.id}
                    inlineEditMode={inlineEditId === (item.id as ItemId)}
                    onClick={() => taskModal.openEdit(item.id as ItemId)}
                    onToggleCheckbox={() => handleToggleCheckbox(item)}
                    onTitleClickInlineEdit={() => setInlineEditId(item.id as ItemId)}
                    onTitleCommitInlineEdit={(newTitle) => {
                      setInlineEditId(null);
                      if (newTitle !== item.title) {
                        editTitleInline.mutate({ id: item.id as ItemId, title: newTitle });
                      }
                    }}
                    onDeleteRequest={() => setDeleteConfirmItem(item)}
                    onScheduleTodayKeyboard={() =>
                      reschedule.mutate({ id: item.id as ItemId, newDate: today })
                    }
                    onOpenChevronClick={() => taskModal.openEdit(item.id as ItemId)}
                  />
                ))}
              </ul>
            </section>
          )}

          {/* Today section */}
          <section className={styles.section} aria-label={`Today, ${todays.length} items`}>
            <h2 className={styles.sectionTitle}>
              Today <span className={styles.sectionDate}>{formatDayMonthDD(today)}</span>
            </h2>
            <ul className={styles.list}>
              {todays.map((item) => (
                <TaskListRow
                  key={item.id}
                  item={item}
                  todayLocalDate={today}
                  isFocused={focusedId === item.id}
                  inlineEditMode={inlineEditId === (item.id as ItemId)}
                  onClick={() => taskModal.openEdit(item.id as ItemId)}
                  onToggleCheckbox={() => handleToggleCheckbox(item)}
                  onTitleClickInlineEdit={() => setInlineEditId(item.id as ItemId)}
                  onTitleCommitInlineEdit={(newTitle) => {
                    setInlineEditId(null);
                    if (newTitle !== item.title) {
                      editTitleInline.mutate({ id: item.id as ItemId, title: newTitle });
                    }
                  }}
                  onDeleteRequest={() => setDeleteConfirmItem(item)}
                  onScheduleTodayKeyboard={() => reschedule.mutate({ id: item.id as ItemId, newDate: today })}
                  onOpenChevronClick={() => taskModal.openEdit(item.id as ItemId)}
                />
              ))}
            </ul>
          </section>
        </div>
      </ViewChrome>

      {/* Bulk move overdue confirmation */}
      <ConfirmationPrompt
        open={bulkConfirmOpen}
        onCancel={() => setBulkConfirmOpen(false)}
        onConfirm={() => {
          bulkMoveOverdue.mutate();
          setBulkConfirmOpen(false);
        }}
        title={`Move ${overdue.length} overdue items to today?`}
        body="Their due dates will be set to today."
        confirmLabel="Move all"
        destructive={false}
        isPending={bulkMoveOverdue.isPending}
      />

      {/* Delete confirmation */}
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

      {/* Parent completion blocking */}
      <ConfirmationPrompt
        open={parentCompletionItem !== null}
        onCancel={() => setParentCompletionItem(null)}
        onConfirm={handleConfirmParentCompletion}
        title="Complete all children and continue?"
        body={`This task has ${parentCompletionItem?.subtasks.filter((s) => s.status !== 'done').length ?? 0} incomplete subtasks. Completing it will mark them all done.`}
        confirmLabel="Complete all"
        destructive={false}
      />
    </>
  );
}
