import { Link } from '@tanstack/react-router';
import styles from './styles.module.css';

export interface ProjectRowProps {
  id: string;
  name: string;
  selected: boolean;
  color?: string | null | undefined;
  isInbox?: boolean;
  count?: number;
  disabled?: boolean;
}

/**
 * ProjectRow — a sidebar row for a Project.
 * Same shape as SidebarNavItem, but with an optional 8px color dot.
 * Inbox project: no context menu, pinned visually.
 * Right-click context menu is handled by the sidebar (Rename / Delete / Move / Toggle hierarchical).
 */
export function ProjectRow({
  id,
  name,
  selected,
  color,
  isInbox = false,
  count,
  disabled = false,
}: ProjectRowProps) {
  return (
    <Link
      to="/project/$id"
      params={{ id }}
      className={styles.item}
      data-selected={selected ? '' : undefined}
      data-inbox={isInbox ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      aria-current={selected ? 'page' : undefined}
      aria-label={count !== undefined ? `${name}, ${count} items` : name}
      tabIndex={disabled ? -1 : undefined}
    >
      {color ? (
        <span className={styles.colorDot} style={{ background: color }} aria-hidden="true" />
      ) : (
        <span className={styles.colorDotEmpty} aria-hidden="true" />
      )}
      <span className={styles.label}>{name}</span>
      {count !== undefined && count > 0 && (
        <span className={styles.badge} aria-hidden="true">
          {count}
        </span>
      )}
    </Link>
  );
}

export default ProjectRow;
