import { ChevronDown, ChevronRight, Folder } from 'lucide-react';
import type React from 'react';
import styles from './styles.module.css';

export interface FolderHeaderProps {
  name: string;
  expanded: boolean;
  onToggle: () => void;
  /** Folder context actions are surfaced via right-click on the sidebar row.
   * These callbacks are kept so the parent can still wire context actions;
   * we no longer render a hover ⋯ button (preview parity + the old button
   * only triggered rename anyway). */
  onRename?: () => void;
  onDelete?: () => void;
  onNewProject?: () => void;
  children?: React.ReactNode;
  id?: string;
}

/**
 * FolderHeader — collapsible sidebar folder row.
 * Chevron rotates from 0° (collapsed) to 90° (expanded) on toggle.
 * Keyboard: Right/Enter/Space = expand; Left = collapse.
 * Folder icon is fixed (Folder); the chevron carries the expanded state.
 */
export function FolderHeader({ name, expanded, onToggle, children, id }: FolderHeaderProps) {
  const controlsId = id ? `folder-${id}-list` : undefined;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (!expanded) onToggle();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (expanded) onToggle();
    }
  };

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={expanded}
        aria-controls={controlsId}
        onClick={onToggle}
        onKeyDown={handleKeyDown}
      >
        {expanded ? (
          <ChevronDown size={16} aria-hidden="true" className={styles.chevron} data-expanded="" />
        ) : (
          <ChevronRight size={16} aria-hidden="true" className={styles.chevron} />
        )}
        <Folder size={16} aria-hidden="true" className={styles.folderIcon} />
        <span className={styles.name}>{name}</span>
      </button>

      {expanded && children && <div id={controlsId}>{children}</div>}
    </div>
  );
}

export default FolderHeader;
