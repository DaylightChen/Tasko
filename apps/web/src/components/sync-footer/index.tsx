import { HardDrive } from 'lucide-react';
import type React from 'react';
import styles from './styles.module.css';

export interface SyncFooterProps {
  dataDir?: string | undefined;
}

/**
 * SyncFooter — static sidebar footer with an icon + caption. The UX preview
 * has a cloud-check + "Synced Xm ago" line; Tasko is local-only so we use
 * a HardDrive icon and surface the actual data directory instead.
 * Right-click: copy the data-dir to clipboard (nice-to-have).
 */
export function SyncFooter({ dataDir }: SyncFooterProps) {
  const handleContextMenu = (e: React.MouseEvent) => {
    if (!dataDir) return;
    e.preventDefault();
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
      <HardDrive size={14} aria-hidden="true" className={styles.icon} />
      <span className={styles.text}>{dataDir ? `Local · ${dataDir}` : 'Local files'}</span>
    </div>
  );
}

export default SyncFooter;
