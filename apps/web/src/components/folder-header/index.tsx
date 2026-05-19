import { ChevronDown, ChevronRight, Folder, FolderOpen, MoreHorizontal } from 'lucide-react';
import type React from 'react';
import styles from './styles.module.css';

export interface FolderHeaderProps {
  name: string;
  expanded: boolean;
  onToggle: () => void;
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
 * Hover-only ⋯ for context actions.
 */
export function FolderHeader({
  name,
  expanded,
  onToggle,
  onRename,
  onDelete,
  onNewProject,
  children,
  id,
}: FolderHeaderProps) {
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

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    // Context menu is shown via the ⋯ button; right-click delegates to the same menu
    // The parent decides menu rendering — this just exposes callbacks.
  };

  const hasMenu = onRename || onDelete || onNewProject;

  return (
    <div className={styles.wrapper} onContextMenu={handleContextMenu}>
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
        {expanded ? (
          <FolderOpen size={16} aria-hidden="true" className={styles.folderIcon} />
        ) : (
          <Folder size={16} aria-hidden="true" className={styles.folderIcon} />
        )}
        <span className={styles.name}>{name}</span>
      </button>

      {hasMenu && (
        <button
          type="button"
          className={styles.moreBtn}
          aria-label={`More actions for ${name}`}
          onClick={(e) => {
            e.stopPropagation();
            // Trigger context menu — parent wires this via onRename / onDelete / onNewProject
            // For now show a native context menu at button position
            onRename?.();
          }}
        >
          <MoreHorizontal size={16} aria-hidden="true" />
        </button>
      )}

      {expanded && children && <div id={controlsId}>{children}</div>}
    </div>
  );
}

export default FolderHeader;
