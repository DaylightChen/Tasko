import type { LucideIcon } from 'lucide-react';
import type React from 'react';
import styles from './styles.module.css';

export interface ViewOption {
  value: string;
  icon: LucideIcon;
  label: string;
}

export interface ViewToggleProps {
  options: ViewOption[];
  value: string;
  onChange: (value: string) => void;
  /** Optional id prefix for aria-controls; the parent view panel should have id="<controlsPrefix>-<value>" */
  controlsPrefix?: string;
}

/**
 * ViewToggle — a connected group of icon-toggle buttons (List / Tree / Kanban).
 * Uses role="tablist" with role="tab" children per ARIA spec.
 * Left/Right arrows move selection within the group.
 */
export function ViewToggle({ options, value, onChange, controlsPrefix }: ViewToggleProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const idx = options.findIndex((o) => o.value === value);
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = (idx + 1) % options.length;
      const nextOpt = options[next];
      if (nextOpt) onChange(nextOpt.value);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = (idx - 1 + options.length) % options.length;
      const prevOpt = options[prev];
      if (prevOpt) onChange(prevOpt.value);
    }
  };

  return (
    <div className={styles.group} role="tablist" aria-label="View" onKeyDown={handleKeyDown}>
      {options.map((opt) => {
        const Icon = opt.icon;
        const selected = opt.value === value;
        const controlsId = controlsPrefix ? `${controlsPrefix}-${opt.value}` : undefined;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            className={styles.tab}
            aria-selected={selected}
            aria-controls={controlsId}
            aria-label={opt.label}
            tabIndex={selected ? 0 : -1}
            data-selected={selected ? '' : undefined}
            onClick={() => onChange(opt.value)}
            title={opt.label}
          >
            <Icon size={20} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

export default ViewToggle;
