/**
 * SubtaskCheckbox — a smaller (16px) checkbox for use inside the Task modal's
 * subtask list. Binary todo/done only; no indeterminate state needed.
 * No animation (subtask is inside a modal — too noisy).
 */
import { Checkbox } from '../checkbox';
import type { CheckboxProps } from '../checkbox';

export type SubtaskCheckboxProps = Omit<CheckboxProps, 'size' | 'indeterminate'>;

export function SubtaskCheckbox(props: SubtaskCheckboxProps) {
  return <Checkbox {...props} size="sm" indeterminate={false} />;
}

export default SubtaskCheckbox;
