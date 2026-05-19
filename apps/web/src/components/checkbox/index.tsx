/**
 * Checkbox — task completion control.
 *
 * Animation note: The checkbox itself animates its filled state on check with
 * `motion-fast` + `ease-spring-soft`. The strike-through and fade-collapse of
 * the parent row are owned by the row component, NOT this checkbox. This keeps
 * the checkbox reusable outside of row contexts.
 *
 * ARIA: native <input type="checkbox"> wrapped in a <label>. aria-checked
 * reflects state. After check, the PARENT ROW (task-08) calls announce() —
 * this component does not self-announce.
 */
import { Check } from 'lucide-react';
import type React from 'react';
import styles from './styles.module.css';

export interface CheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  'aria-label': string;
  size?: 'sm' | 'md';
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function Checkbox({
  checked,
  indeterminate = false,
  onChange,
  'aria-label': ariaLabel,
  size = 'md',
  disabled = false,
  id,
  className,
}: CheckboxProps) {
  const state = indeterminate ? 'indeterminate' : checked ? 'checked' : 'unchecked';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!disabled) {
      onChange(e.target.checked);
    }
  };

  return (
    <label
      className={[styles.label, className].filter(Boolean).join(' ')}
      data-size={size}
      data-state={state}
      data-disabled={disabled ? '' : undefined}
      aria-label={ariaLabel}
    >
      <input
        id={id}
        type="checkbox"
        className={styles.input}
        checked={indeterminate ? false : checked}
        ref={(el) => {
          if (el) el.indeterminate = indeterminate;
        }}
        onChange={handleChange}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-checked={indeterminate ? 'mixed' : checked}
      />
      <span className={styles.visual} aria-hidden="true">
        {state === 'checked' && <Check size={size === 'sm' ? 10 : 14} strokeWidth={2} />}
        {state === 'indeterminate' && <span className={styles.indeterminateBar} />}
      </span>
    </label>
  );
}

export default Checkbox;
