import { ArrowDownNarrowWide } from 'lucide-react';
import { Dropdown } from '../dropdown';
import type { DropdownOption } from '../dropdown';
import styles from './styles.module.css';

export interface SortOption {
  value: string;
  label: string;
}

export interface SortDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options?: SortOption[];
}

/** Default sort options per microcopy §9 */
export const DEFAULT_SORT_OPTIONS: SortOption[] = [
  { value: 'due_asc', label: 'Due date (earliest)' },
  { value: 'priority_desc', label: 'Priority (high to low)' },
  { value: 'title_asc', label: 'Title (A–Z)' },
  { value: 'created_desc', label: 'Created (newest)' },
];

export const TRASH_SORT_OPTIONS: SortOption[] = [
  { value: 'trashed_desc', label: 'Recently trashed' },
  ...DEFAULT_SORT_OPTIONS,
];

export const COMPLETED_SORT_OPTIONS: SortOption[] = [
  { value: 'completed_desc', label: 'Recently completed' },
  ...DEFAULT_SORT_OPTIONS,
];

/**
 * SortDropdown — a ghost-button trigger "Sort: <current>" with a prefix icon
 * and chevron-down. Composes the Dropdown primitive from task-05.
 */
export function SortDropdown({ value, onChange, options = DEFAULT_SORT_OPTIONS }: SortDropdownProps) {
  const dropdownOptions: DropdownOption<string>[] = options.map((o) => ({
    value: o.value,
    label: o.label,
  }));

  const selected = options.find((o) => o.value === value);
  const triggerLabel = `Sort: ${selected?.label ?? value}`;

  return (
    <div className={styles.wrapper}>
      <span className={styles.prefix} aria-hidden="true">
        <ArrowDownNarrowWide size={16} />
      </span>
      <Dropdown
        options={dropdownOptions}
        value={value}
        onChange={onChange}
        ariaLabel={triggerLabel}
        placement="bottom-start"
      />
    </div>
  );
}

export default SortDropdown;
