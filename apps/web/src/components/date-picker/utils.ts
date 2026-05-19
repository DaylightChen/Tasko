import type { LocalDate } from '@tasko/types';

/** Convert a LocalDate string ("YYYY-MM-DD") to a Date at local midnight. */
export function localDateToDate(d: LocalDate): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y ?? 2000, (m ?? 1) - 1, day ?? 1);
}

/** Convert a Date to a LocalDate string ("YYYY-MM-DD"). */
export function dateToLocalDate(d: Date): LocalDate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}` as LocalDate;
}

/** Add N days to a LocalDate string. */
export function addDaysToLocalDate(d: LocalDate, n: number): LocalDate {
  const date = localDateToDate(d);
  date.setDate(date.getDate() + n);
  return dateToLocalDate(date);
}

/** Format a LocalDate for display in trigger button. */
export function formatLocalDate(d: LocalDate): string {
  const date = localDateToDate(d);
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
