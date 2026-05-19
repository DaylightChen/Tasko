import type { ItemId } from '@tasko/types';
import { useEffect, useState } from 'react';
import { useBulkComplete, useBulkDelete } from '../../api/bulk';
import { ConfirmationPrompt } from '../../components/confirmation-prompt';
import { useMultiSelectStore } from '../../store/multi-select';
import styles from './BulkActionsToolbar.module.css';

interface BulkActionsToolbarProps {
  /** Called when "Move to…" is clicked — opens the move-to picker */
  onMoveToClick?: (ids: ItemId[]) => void;
}

/**
 * BulkActionsToolbar — slides in above the quick-add bar when 2+ rows are selected.
 *
 * Per interaction-patterns.md §3.2:
 *   "<N> selected · Move to… · Delete · Mark complete · Cancel"
 *
 * Confirmation is required when N >= 5 items are deleted (per interaction-patterns.md §11).
 */
export function BulkActionsToolbar({ onMoveToClick }: BulkActionsToolbarProps) {
  const multiSelect = useMultiSelectStore();
  const selectedIds = [...multiSelect.set] as ItemId[];
  const count = selectedIds.length;

  const bulkDelete = useBulkDelete();
  const bulkComplete = useBulkComplete();

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Auto-clear on Esc
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        multiSelect.clear();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [multiSelect]);

  if (count < 2) return null;

  const handleDelete = () => {
    if (count >= 5) {
      setDeleteConfirmOpen(true);
    } else {
      bulkDelete.mutate({ item_ids: selectedIds });
      multiSelect.clear();
    }
  };

  const handleComplete = () => {
    bulkComplete.mutate({ item_ids: selectedIds });
    multiSelect.clear();
  };

  const handleConfirmDelete = () => {
    bulkDelete.mutate({ item_ids: selectedIds });
    multiSelect.clear();
    setDeleteConfirmOpen(false);
  };

  return (
    <>
      <div className={styles.toolbar} role="toolbar" aria-label="Bulk actions">
        <span className={styles.count}>{count} selected</span>
        <div className={styles.actions}>
          {onMoveToClick && (
            <button type="button" className={styles.actionBtn} onClick={() => onMoveToClick(selectedIds)}>
              Move to…
            </button>
          )}
          <button
            type="button"
            className={styles.actionBtn}
            onClick={handleDelete}
            disabled={bulkDelete.isPending}
          >
            Delete
          </button>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={handleComplete}
            disabled={bulkComplete.isPending}
          >
            Mark complete
          </button>
          <button type="button" className={styles.cancelBtn} onClick={() => multiSelect.clear()}>
            Cancel
          </button>
        </div>
      </div>

      {/* Confirmation for bulk delete of 5+ items */}
      <ConfirmationPrompt
        open={deleteConfirmOpen}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title={`Move ${count} items to Trash?`}
        body="These items will be moved to Trash. You can restore them later."
        confirmLabel="Move to Trash"
        destructive={true}
        isPending={bulkDelete.isPending}
      />
    </>
  );
}
