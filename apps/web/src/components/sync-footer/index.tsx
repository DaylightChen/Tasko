import type React from 'react';
import styles from './styles.module.css';

export interface SyncFooterProps {
  dataDir?: string | undefined;
}

/**
 * SyncFooter — static sidebar footer showing app version and data directory.
 * Right-click: copy the data-dir to clipboard (one menu item).
 */
export function SyncFooter({ dataDir }: SyncFooterProps) {
  const handleContextMenu = (e: React.MouseEvent) => {
    if (!dataDir) return;
    e.preventDefault();
    // Use native clipboard API — a simple right-click-to-copy behavior.
    // This is "not load-bearing; nice to have" per brief.
    navigator.clipboard.writeText(dataDir).catch(() => {
      // Ignore clipboard errors silently.
    });
  };

  return (
    <div
      className={styles.footer}
      onContextMenu={handleContextMenu}
      title={dataDir ? `Right-click to copy: ${dataDir}` : undefined}
    >
      <span>Tasko v1.0</span>
      {dataDir && <span> · Local files in {dataDir}</span>}
    </div>
  );
}

export default SyncFooter;
