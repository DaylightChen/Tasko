import styles from './styles.module.css';

export interface SubtaskChipProps {
  done: number;
  total: number;
  expanded?: boolean;
  onClick?: () => void;
}

/**
 * Pill-shaped progress chip that displays "X/N" subtasks done.
 * Doubles as the expand-toggle for the row's inline subtask list:
 * clicking it should flip the row's expansion state.
 */
export function SubtaskChip({ done, total, expanded, onClick }: SubtaskChipProps) {
  return (
    <button
      type="button"
      className={styles.chip}
      data-expanded={expanded ? '' : undefined}
      aria-label={`${done} of ${total} subtasks complete`}
      aria-expanded={expanded ?? false}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      {done}/{total}
    </button>
  );
}

export default SubtaskChip;
