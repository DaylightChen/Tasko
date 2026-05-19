import type { Item, LocalDate } from '@tasko/types';
import { daysBetween } from '../../lib/date-fmt';

export type CompletedGroup =
  | 'today'
  | 'yesterday'
  | 'earlier_this_week'
  | 'last_week'
  | 'earlier_this_month'
  | 'earlier';

export interface GroupedItems {
  group: CompletedGroup;
  label: string;
  items: Item[];
}

/** Labels in order, per microcopy §23. */
const GROUP_LABELS: Record<CompletedGroup, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  earlier_this_week: 'Earlier this week',
  last_week: 'Last week',
  earlier_this_month: 'Earlier this month',
  earlier: 'Earlier',
};

/** Return the start of the week (Sunday or Monday) that contains the given date. */
function startOfWeek(date: LocalDate, weekStart: 'sun' | 'mon'): LocalDate {
  const parts = date.split('-').map(Number);
  const y = parts[0] ?? 2000;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const offset = weekStart === 'sun' ? dow : dow === 0 ? 6 : dow - 1;
  dt.setUTCDate(dt.getUTCDate() - offset);
  const ry = dt.getUTCFullYear();
  const rm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const rd = String(dt.getUTCDate()).padStart(2, '0');
  return `${ry}-${rm}-${rd}` as LocalDate;
}

/**
 * Classify a single item's completed_at date into one of the 6 time buckets.
 *
 * Bucket logic (relative to `today`):
 *   today               → completed_date === today
 *   yesterday           → completed_date === today - 1 day
 *   earlier_this_week   → completed_date is in the current week (per weekStart) but before yesterday
 *   last_week           → completed_date is in the prior week
 *   earlier_this_month  → completed_date is in the current calendar month but not in this/last week
 *   earlier             → everything else
 */
function classifyDate(completedDate: LocalDate, today: LocalDate, weekStart: 'sun' | 'mon'): CompletedGroup {
  const diff = daysBetween(completedDate, today); // positive when completedDate is in the past

  if (diff === 0) return 'today';
  if (diff === 1) return 'yesterday';

  const thisWeekStart = startOfWeek(today, weekStart);
  const lastWeekStart = startOfWeek(
    (() => {
      const parts = thisWeekStart.split('-').map(Number);
      const y = parts[0] ?? 2000;
      const m = parts[1] ?? 1;
      const d = parts[2] ?? 1;
      const dt = new Date(Date.UTC(y, m - 1, d - 7));
      const ry = dt.getUTCFullYear();
      const rm = String(dt.getUTCMonth() + 1).padStart(2, '0');
      const rd = String(dt.getUTCDate()).padStart(2, '0');
      return `${ry}-${rm}-${rd}` as LocalDate;
    })(),
    weekStart,
  );

  // "Earlier this week" = in current week range but not today/yesterday
  if (completedDate >= thisWeekStart && completedDate < today) {
    // completedDate is before yesterday (diff > 1) but within this week
    return 'earlier_this_week';
  }

  // "Last week" = in last week's range
  if (completedDate >= lastWeekStart && completedDate < thisWeekStart) {
    return 'last_week';
  }

  // "Earlier this month" = same calendar month as today, but not in this/last week
  const todayParts = today.split('-').map(Number);
  const completedParts = completedDate.split('-').map(Number);
  const sameYear = todayParts[0] === completedParts[0];
  const sameMonth = todayParts[1] === completedParts[1];

  if (sameYear && sameMonth) {
    return 'earlier_this_month';
  }

  return 'earlier';
}

/**
 * Group completed items by time bucket.
 *
 * Items without a `completed_at` are dropped (shouldn't occur for completed items
 * but is defensive). Groups are returned in display order and empty groups are omitted.
 */
export function groupCompleted(items: Item[], today: LocalDate, weekStart: 'sun' | 'mon'): GroupedItems[] {
  const buckets: Map<CompletedGroup, Item[]> = new Map([
    ['today', []],
    ['yesterday', []],
    ['earlier_this_week', []],
    ['last_week', []],
    ['earlier_this_month', []],
    ['earlier', []],
  ]);

  for (const item of items) {
    if (!item.completed_at) continue;
    // completed_at is an ISO UTC timestamp; extract the date portion using UTC parts
    const completedDate = item.completed_at.slice(0, 10) as LocalDate;
    const group = classifyDate(completedDate, today, weekStart);
    buckets.get(group)?.push(item);
  }

  const result: GroupedItems[] = [];
  for (const [group, groupItems] of buckets) {
    if (groupItems.length > 0) {
      result.push({ group, label: GROUP_LABELS[group], items: groupItems });
    }
  }
  return result;
}
