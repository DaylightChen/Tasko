import type { Subtask } from '@tasko/types';
import { SubtaskCheckbox } from '../subtask-checkbox';
import styles from './styles.module.css';

export interface SubtaskInlineRowProps {
  subtask: Subtask;
  /** Fired when the checkbox is toggled. Argument is the new done state. */
  onToggle: (done: boolean) => void;
  /** Fired when the row body (title) is clicked. Use to open the parent task modal. */
  onOpenParent: () => void;
}

export function SubtaskInlineRow({ subtask, onToggle, onOpenParent }: SubtaskInlineRowProps) {
  const isDone = subtask.status === 'done';

  return (
    <div className={styles.row}>
      <span className={styles.checkboxWrap}>
        <SubtaskCheckbox
          checked={isDone}
          onChange={(checked) => onToggle(checked)}
          aria-label={`Mark subtask "${subtask.title}" complete`}
        />
      </span>
      <button
        type="button"
        className={styles.title}
        data-done={isDone ? '' : undefined}
        onClick={onOpenParent}
      >
        {subtask.title}
      </button>
    </div>
  );
}

export default SubtaskInlineRow;
