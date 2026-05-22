/**
 * useCalendarItems — data hook for the calendar month view.
 *
 * Fetches active items (view='all') and optionally completed items
 * (view='completed') when the "Show completed" filter chip is active.
 * Applies project/tag filter chips client-side.
 * Returns a Map<LocalDate, Item[]> keyed by ISO date "YYYY-MM-DD".
 *
 * Multi-day items (start_date set) appear on every date in [start_date, due_date].
 * Single-day items appear only on due_date.
 */
import type { Item, LocalDate } from '@tasko/types';
import { useMemo } from 'react';
import { useItems } from '../../api/items';
import { daysBetween } from '../../lib/date-fmt';
import type { CalendarFilters } from './filters';

/** Return all LocalDates in [start, end] inclusive. */
function dateRange(start: LocalDate, end: LocalDate): LocalDate[] {
  const days = daysBetween(start, end);
  if (days < 0) return [start];
  const result: LocalDate[] = [];
  for (let i = 0; i <= days; i++) {
    const d = new Date(`${start}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    result.push(`${y}-${m}-${day}` as LocalDate);
  }
  return result;
}

export interface CalendarItemsResult {
  /** All items that satisfy current filters, deduplicated. */
  items: Item[];
  /** Date → items map covering the full visible date range. */
  byDate: Map<LocalDate, Item[]>;
  isLoading: boolean;
}

export function useCalendarItems(filters: CalendarFilters): CalendarItemsResult {
  const activeQuery = useItems({ view: 'all' });
  // Always call the completed query hook (Rules of Hooks), but only use its data
  // when show_completed is true. The query key differs so TanStack Query tracks them
  // separately and won't re-run the 'all' query unnecessarily.
  const completedQuery = useItems({ view: 'completed' });

  const isLoading = activeQuery.isLoading || (filters.show_completed && completedQuery.isLoading);

  const allItems = useMemo(() => {
    const active = (activeQuery.data?.items ?? []) as Item[];
    const completed = filters.show_completed ? ((completedQuery.data?.items ?? []) as Item[]) : [];
    // Merge, deduplicating by id
    const map = new Map<string, Item>();
    for (const item of active) map.set(item.id, item);
    for (const item of completed) map.set(item.id, item);
    return Array.from(map.values());
  }, [activeQuery.data, completedQuery.data, filters.show_completed]);

  const filtered = useMemo(() => {
    let result = allItems;
    if (filters.filter_project_id) {
      result = result.filter((item) => item.project_id === filters.filter_project_id);
    }
    if (filters.filter_tag_id) {
      result = result.filter((item) => item.tags.includes(filters.filter_tag_id as Item['tags'][number]));
    }
    return result;
  }, [allItems, filters.filter_project_id, filters.filter_tag_id]);

  const byDate = useMemo(() => {
    const map = new Map<LocalDate, Item[]>();

    for (const item of filtered) {
      const dates = item.start_date !== null ? dateRange(item.start_date, item.due_date) : [item.due_date];

      for (const date of dates) {
        const existing = map.get(date);
        if (existing) {
          existing.push(item);
        } else {
          map.set(date, [item]);
        }
      }
    }
    return map;
  }, [filtered]);

  return { items: filtered, byDate, isLoading };
}
