import type React from 'react';
import styles from './styles.module.css';

export interface CardProps {
  selected?: boolean;
  dragging?: boolean;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  /** aria-label for interactive cards that are the primary action surface. */
  'aria-label'?: string;
  tabIndex?: number;
}

/**
 * Card — generic surface used for kanban cards, project tiles, etc.
 * State is communicated via data-state attributes for CSS styling.
 */
export function Card({
  selected = false,
  dragging = false,
  children,
  className,
  onClick,
  'aria-label': ariaLabel,
  tabIndex,
}: CardProps) {
  const states: string[] = [];
  if (selected) states.push('selected');
  if (dragging) states.push('dragging');

  return (
    <div
      className={[styles.root, className].filter(Boolean).join(' ')}
      data-state={states.length > 0 ? states.join(' ') : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      aria-label={ariaLabel}
      tabIndex={tabIndex}
      role={onClick ? 'button' : undefined}
    >
      {children}
    </div>
  );
}

export default Card;
