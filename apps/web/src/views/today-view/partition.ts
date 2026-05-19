import type { Item, LocalDate } from '@tasko/types';

export interface TodayPartition {
  overdue: Item[];
  todays: Item[];
}

/**
 * Partition items into overdue and today buckets.
 *
 * overdue: due_date < today AND status != 'done' AND trashed_at == null
 * todays:  (due_date == today OR (start_date <= today <= due_date)) AND due_date >= today
 *           AND status != 'done' AND trashed_at == null
 *
 * Per spec §9.4 #4: Today is strictly date-driven.
 * An item whose span includes today (start_date <= today <= due_date) appears in todays.
 * overdue and todays are mutually exclusive (items due today are in todays, not overdue).
 */
export function partitionOverdue(items: Item[], today: LocalDate): TodayPartition {
  const overdue: Item[] = [];
  const todays: Item[] = [];

  for (const item of items) {
    if (item.status === 'done') continue;
    if (item.trashed_at !== null) continue;

    const dueDate = item.due_date;
    const startDate = item.start_date;

    if (dueDate < today) {
      // Overdue: due date is in the past
      overdue.push(item);
    } else if (dueDate === today) {
      // Due today
      todays.push(item);
    } else if (startDate !== null && startDate <= today && today <= dueDate) {
      // Multi-day item spanning today (start_date <= today <= due_date)
      // due_date > today but span includes today
      todays.push(item);
    }
    // Items with due_date > today and no span including today are not in this view
  }

  return { overdue, todays };
}
