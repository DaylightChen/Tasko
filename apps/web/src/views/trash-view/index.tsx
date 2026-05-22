import { useVirtualizer } from '@tanstack/react-virtual';
import type { Item, ItemId } from '@tasko/types';
import { Trash2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useEmptyTrash, usePermanentDeleteItem, useRestoreItem, useTrashList } from '../../api/trash';
import { ConfirmationPrompt } from '../../components/confirmation-prompt';
import { EmptyState } from '../../components/empty-state';
import { useMultiSelect } from '../../hooks/useMultiSelect';
import styles from './styles.module.css';
import { TrashRow } from './trash-row';

const VIRTUALIZE_THRESHOLD = 200;
const ESTIMATED_ROW_HEIGHT = 56;

export function TrashView() {
  const [sort, setSort] = useState<'trashed_desc' | 'title_asc'>('trashed_desc');
  const { data, isLoading } = useTrashList(sort);
  const items = (data?.items ?? []) as Item[];
  const count = data?.count ?? 0;

  const restoreItem = useRestoreItem();
  const permanentDelete = usePermanentDeleteItem();
  const emptyTrash = useEmptyTrash();

  const [emptyConfirmOpen, setEmptyConfirmOpen] = useState(false);
  const [deleteForeverItem, setDeleteForeverItem] = useState<Item | null>(null);

  const visibleIds = useMemo(() => items.map((i) => i.id as ItemId), [items]);
  const { handleListClick } = useMultiSelect(visibleIds, 'trash');

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 5,
  });
  const useVirtualList = items.length > VIRTUALIZE_THRESHOLD;

  if (isLoading && items.length === 0) {
    return (
      <div className={styles.root}>
        <div className={styles.header}>
          <h1 className={styles.title}>Trash</h1>
        </div>
        <div aria-busy="true" className={styles.loadingPlaceholder} />
      </div>
    );
  }

  if (count === 0) {
    return (
      <div className={styles.root}>
        <div className={styles.header}>
          <h1 className={styles.title}>Trash</h1>
        </div>
        <EmptyState
          icon={Trash2}
          headline="Trash is empty."
          subline="Deleted items land here. Restore or permanently delete from here."
        />
      </div>
    );
  }

  return (
    <>
      <div className={styles.root}>
        <div className={styles.header}>
          <h1 className={styles.title}>Trash</h1>
          <div className={styles.headerRight}>
            <select
              className={styles.sortSelect}
              value={sort}
              onChange={(e) => setSort(e.target.value as 'trashed_desc' | 'title_asc')}
              aria-label="Sort order"
            >
              <option value="trashed_desc">Recently trashed</option>
              <option value="title_asc">Title (A–Z)</option>
            </select>
            <button type="button" className={styles.emptyTrashBtn} onClick={() => setEmptyConfirmOpen(true)}>
              Empty Trash
            </button>
          </div>
        </div>

        <p className={styles.subline}>
          {count} item{count !== 1 ? 's' : ''} in Trash. Restored items return to their previous state.
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
              aria-label="Trash items"
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
                    <TrashRow
                      item={item}
                      onRestore={() => restoreItem.mutate(item.id as ItemId)}
                      onDeleteForever={() => setDeleteForeverItem(item)}
                      isRestoring={restoreItem.isPending}
                      isDeletingForever={permanentDelete.isPending}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          /* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard access provided by individual <li> rows */
          <ul className={styles.list} onClick={handleListClick}>
            {items.map((item) => (
              <TrashRow
                key={item.id}
                item={item}
                onRestore={() => restoreItem.mutate(item.id as ItemId)}
                onDeleteForever={() => setDeleteForeverItem(item)}
                isRestoring={restoreItem.isPending}
                isDeletingForever={permanentDelete.isPending}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Empty Trash confirmation */}
      <ConfirmationPrompt
        open={emptyConfirmOpen}
        onCancel={() => setEmptyConfirmOpen(false)}
        onConfirm={() => {
          emptyTrash.mutate();
          setEmptyConfirmOpen(false);
        }}
        title="Empty Trash?"
        body={`All ${count} items in Trash will be permanently deleted. This cannot be undone.`}
        confirmLabel="Empty Trash"
        destructive={true}
        isPending={emptyTrash.isPending}
      />

      {/* Permanent delete confirmation */}
      <ConfirmationPrompt
        open={deleteForeverItem !== null}
        onCancel={() => setDeleteForeverItem(null)}
        onConfirm={() => {
          if (deleteForeverItem) {
            permanentDelete.mutate(deleteForeverItem.id as ItemId);
          }
          setDeleteForeverItem(null);
        }}
        title="Permanently delete?"
        body="This cannot be undone."
        confirmLabel="Delete forever"
        destructive={true}
        isPending={permanentDelete.isPending}
      />
    </>
  );
}
