/**
 * DragOverlayContent — wrapper applied to the ghost clone inside a DragOverlay.
 * Sets data-state="dragging" so the drag CSS rules apply.
 */
import type React from 'react';
import styles from './styles.module.css';

interface DragOverlayContentProps {
  children: React.ReactNode;
}

export function DragOverlayContent({ children }: DragOverlayContentProps) {
  return (
    <div className={styles.dragging} data-state="dragging">
      {children}
    </div>
  );
}
