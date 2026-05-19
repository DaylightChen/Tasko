import { Link } from '@tanstack/react-router';
import type { LucideIcon } from 'lucide-react';
import styles from './styles.module.css';

export interface SidebarNavItemProps {
  to: string;
  icon?: LucideIcon;
  label: string;
  count?: number | undefined;
  overdueCount?: number | undefined;
  selected: boolean;
  disabled?: boolean;
}

/**
 * SidebarNavItem — a single row in the sidebar navigation.
 * Uses native <a> via TanStack Router Link.
 * aria-current="page" when selected.
 * Overdue sub-badge is part of the accessible name.
 */
export function SidebarNavItem({
  to,
  icon: Icon,
  label,
  count,
  overdueCount,
  selected,
  disabled = false,
}: SidebarNavItemProps) {
  // Build accessible name
  let ariaLabel = label;
  if (count !== undefined && count > 0) {
    ariaLabel += `, ${count} items`;
    if (overdueCount && overdueCount > 0) {
      ariaLabel += `, ${overdueCount} overdue`;
    }
  }

  return (
    <Link
      to={to}
      className={styles.item}
      data-selected={selected ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      aria-current={selected ? 'page' : undefined}
      aria-label={ariaLabel !== label ? ariaLabel : undefined}
      tabIndex={disabled ? -1 : undefined}
    >
      {Icon && (
        <span className={styles.icon} aria-hidden="true">
          <Icon size={20} />
        </span>
      )}
      <span className={styles.label}>{label}</span>
      {count !== undefined && count > 0 && (
        <span className={styles.badge} aria-hidden="true">
          ({count})
          {overdueCount !== undefined && overdueCount > 0 && (
            <span className={styles.overdueBadge}>{overdueCount}</span>
          )}
        </span>
      )}
    </Link>
  );
}

export default SidebarNavItem;
