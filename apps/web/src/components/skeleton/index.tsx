import styles from './styles.module.css';

export interface SkeletonProps {
  variant?: 'list' | 'sidebar' | 'kanban' | 'calendar';
  rowCount?: number;
}

function SkeletonBar({
  width = '100%',
  height = '12px',
  radius,
  className,
}: {
  width?: string;
  height?: string;
  radius?: string | undefined;
  className?: string | undefined;
}) {
  return (
    <div
      className={[styles.bar, className, styles.shimmer].filter(Boolean).join(' ')}
      style={{ width, height, borderRadius: radius ?? 'var(--radius-sm)' }}
      aria-hidden="true"
    />
  );
}

function ListSkeleton({ rowCount = 10 }: { rowCount: number }) {
  return (
    <>
      {Array.from({ length: rowCount }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders have no identity; index is the natural key
        <div key={i} className={styles.listRow}>
          <SkeletonBar width="8px" height="8px" radius="var(--radius-full)" />
          <SkeletonBar width="20px" height="20px" radius="var(--radius-full)" />
          <SkeletonBar width={`${55 + Math.random() * 30}%`} height="14px" />
          <SkeletonBar width="60px" height="12px" className={styles.datePill} />
        </div>
      ))}
    </>
  );
}

function SidebarSkeleton({ rowCount = 10 }: { rowCount: number }) {
  return (
    <div className={styles.sidebarWrapper}>
      {Array.from({ length: rowCount }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders have no identity; index is the natural key
        <div key={i} className={styles.sidebarRow}>
          <SkeletonBar width="16px" height="16px" radius="var(--radius-xs)" />
          <SkeletonBar width={`${40 + Math.random() * 40}%`} height="13px" />
        </div>
      ))}
    </div>
  );
}

function KanbanSkeleton() {
  return (
    <div className={styles.kanbanWrapper}>
      {Array.from({ length: 3 }).map((_, col) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders have no identity; index is the natural key
        <div key={col} className={styles.kanbanColumn}>
          <SkeletonBar width="80%" height="16px" />
          {Array.from({ length: 3 }).map((__, card) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders have no identity; index is the natural key
            <div key={card} className={styles.kanbanCard}>
              <SkeletonBar width="90%" height="14px" />
              <SkeletonBar width="50%" height="12px" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div className={styles.calendarWrapper}>
      {Array.from({ length: 6 }).map((_, row) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders have no identity; index is the natural key
        <div key={row} className={styles.calendarRow}>
          {Array.from({ length: 7 }).map((__, cell) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders have no identity; index is the natural key
            <div key={cell} className={styles.calendarCell}>
              <SkeletonBar width="24px" height="24px" radius="var(--radius-full)" />
              <SkeletonBar width="80%" height="10px" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function Skeleton({ variant = 'list', rowCount = 10 }: SkeletonProps) {
  return (
    <section
      className={styles.root}
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading content"
      data-variant={variant}
    >
      {variant === 'list' && <ListSkeleton rowCount={rowCount} />}
      {variant === 'sidebar' && <SidebarSkeleton rowCount={rowCount} />}
      {variant === 'kanban' && <KanbanSkeleton />}
      {variant === 'calendar' && <CalendarSkeleton />}
    </section>
  );
}

export default Skeleton;
