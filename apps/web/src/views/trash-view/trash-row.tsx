import type { Item } from '@tasko/types';
import { Layers, LayoutGrid, RotateCcw, SquareCheckBig, X } from 'lucide-react';
import { IconButton } from '../../components/icon-button';
import styles from './styles.module.css';

interface TrashRowProps {
  item: Item;
  onRestore: () => void;
  onDeleteForever: () => void;
  isRestoring?: boolean;
  isDeletingForever?: boolean;
}

function TypeIcon({ type }: { type: Item['type'] }) {
  if (type === 'epic') return <Layers size={16} aria-hidden="true" className={styles.typeIcon} />;
  if (type === 'feature') return <LayoutGrid size={16} aria-hidden="true" className={styles.typeIcon} />;
  return <SquareCheckBig size={16} aria-hidden="true" className={styles.typeIcon} />;
}

/**
 * TrashRow — a row in the Trash view.
 * Per screens.md: type icon left (no checkbox), title + trashed date right-side.
 * Actions: Restore (RotateCcw) + Delete-forever (X) as IconButtons.
 */
export function TrashRow({
  item,
  onRestore,
  onDeleteForever,
  isRestoring,
  isDeletingForever,
}: TrashRowProps) {
  const trashedDate = item.trashed_at
    ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(item.trashed_at))
    : null;

  return (
    <li className={styles.trashRow} data-item-id={item.id}>
      <div className={styles.trashRowLeft}>
        <TypeIcon type={item.type} />
      </div>
      <div className={styles.trashRowBody}>
        <span className={styles.trashRowTitle}>{item.title}</span>
        {trashedDate && <span className={styles.trashRowMeta}>Trashed {trashedDate}</span>}
      </div>
      <div className={styles.trashRowActions}>
        <IconButton
          icon={RotateCcw}
          aria-label="Restore"
          tooltip="Restore"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onRestore();
          }}
          disabled={isRestoring}
        />
        <IconButton
          icon={X}
          aria-label="Delete forever"
          tooltip="Delete forever"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteForever();
          }}
          disabled={isDeletingForever}
        />
      </div>
    </li>
  );
}
