import { X } from 'lucide-react';
import type React from 'react';
import styles from './styles.module.css';

export interface FilterChipProps {
  facet: string;
  value: string;
  onRemove: () => void;
  tone?: 'neutral' | 'accent';
  /** Optional override for the visible chip label and aria-label. When provided,
   * overrides the auto-formatted "${facet}: ${value}" text. */
  label?: string;
}

/**
 * FilterChip — a dismissable pill showing "Facet: Value".
 * Accessible remove button with Delete/Backspace keyboard shortcut.
 * Height: 24px desktop / 32px mobile.
 */
export function FilterChip({ facet, value, onRemove, tone = 'neutral', label: labelProp }: FilterChipProps) {
  const label = labelProp ?? `${facet}: ${value}`;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onRemove();
    }
  };

  return (
    <div className={styles.chip} data-tone={tone} aria-label={label}>
      <span className={styles.text}>{label}</span>
      <button
        type="button"
        className={styles.remove}
        aria-label={`Remove filter: ${label}`}
        onClick={onRemove}
        onKeyDown={handleKeyDown}
      >
        <X size={12} aria-hidden="true" />
      </button>
    </div>
  );
}

export default FilterChip;
