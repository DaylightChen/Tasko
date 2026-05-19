import styles from './styles.module.css';

export interface MultiDayChipProps {
  day: number;
  total: number;
}

/**
 * MultiDayChip — "Day N of M" pill for multi-day items.
 * First and last day get accent treatment; middle days use default tag styling.
 * Truncates total as "99+" when total >= 99.
 * Not interactive — announced as part of row label, not separately.
 */
export function MultiDayChip({ day, total }: MultiDayChipProps) {
  const displayTotal = total >= 99 ? '99+' : String(total);
  const isEdge = day === 1 || day === total;
  const ariaLabel = `Day ${day} of ${total >= 99 ? '99 or more' : total}`;

  return (
    <span className={styles.chip} data-edge={isEdge ? '' : undefined} aria-label={ariaLabel}>
      Day {day} of {displayTotal}
    </span>
  );
}

export default MultiDayChip;
