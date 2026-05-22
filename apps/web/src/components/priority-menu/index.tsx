import type { Priority } from '@tasko/types';
import { Check } from 'lucide-react';
import { useId } from 'react';
import styles from './styles.module.css';

export interface PriorityMenuProps {
  value: Priority;
  onChange: (v: Priority) => void;
}

const PRIORITY_OPTIONS: { value: Priority; label: string; shortcut: string }[] = [
  { value: 'none', label: 'None', shortcut: '1' },
  { value: 'low', label: 'Low', shortcut: '2' },
  { value: 'medium', label: 'Medium', shortcut: '3' },
  { value: 'high', label: 'High', shortcut: '4' },
];

const PRIORITY_DOT_CLASS: Record<Priority, string> = {
  none: styles.dotNone ?? '',
  low: styles.dotLow ?? '',
  medium: styles.dotMedium ?? '',
  high: styles.dotHigh ?? '',
};

export function PriorityMenu({ value, onChange }: PriorityMenuProps) {
  const groupName = useId();

  return (
    <div className={styles.pills} role="radiogroup" aria-label="Priority">
      {PRIORITY_OPTIONS.map((opt) => {
        const isSelected = value === opt.value;
        return (
          <label key={opt.value} className={styles.pill} data-selected={isSelected ? '' : undefined}>
            <input
              type="radio"
              name={groupName}
              value={opt.value}
              checked={isSelected}
              onChange={() => onChange(opt.value)}
              className={styles.hiddenRadio}
              aria-label={`Priority: ${opt.label}`}
            />
            <span className={[styles.dot, PRIORITY_DOT_CLASS[opt.value]].join(' ')} aria-hidden="true" />
            <span className={styles.label}>{opt.label}</span>
            {isSelected && <Check size={12} aria-hidden="true" className={styles.check} />}
          </label>
        );
      })}
    </div>
  );
}

export default PriorityMenu;
