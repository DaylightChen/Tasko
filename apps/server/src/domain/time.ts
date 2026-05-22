import type { LocalDate, Weekday } from '@tasko/types';

const WEEKDAY_NAMES: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function parseLocalDate(d: LocalDate): { y: number; m: number; d: number } {
  const parts = d.split('-').map(Number);
  return { y: parts[0] ?? 2000, m: parts[1] ?? 1, d: parts[2] ?? 1 };
}

function formatLocalDate(y: number, m: number, d: number): LocalDate {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` as LocalDate;
}

/** Returns today's YYYY-MM-DD per the server's local clock. */
export function todayLocal(): LocalDate {
  const now = new Date();
  return formatLocalDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/**
 * Adds n days (n may be negative). Uses local-timezone Date arithmetic to avoid
 * UTC midnight boundary pitfalls: constructing new Date(y, m-1, d) gives local
 * midnight, then setDate advances/retreats by calendar days.
 */
export function addDays(date: LocalDate, n: number): LocalDate {
  const { y, m, d } = parseLocalDate(date);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return formatLocalDate(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

/**
 * Returns the number of integer days from `a` to `b` (positive if b > a).
 * Uses Math.round to absorb DST jitter (±1 hour around spring/fall transitions).
 */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  const { y: ay, m: am, d: ad } = parseLocalDate(a);
  const { y: by, m: bm, d: bd } = parseLocalDate(b);
  const dateA = new Date(ay, am - 1, ad);
  const dateB = new Date(by, bm - 1, bd);
  return Math.round((dateB.getTime() - dateA.getTime()) / 86_400_000);
}

/** Last day of the given month (handles leap years for Feb). */
export function lastDayOfMonth(year: number, month: number): number {
  // new Date(year, month, 0) gives the last day of (month-1) in the given year.
  // So new Date(year, month, 0) gives last day of `month` (1-indexed).
  return new Date(year, month, 0).getDate();
}

/** Returns the weekday string for the date. */
export function weekdayOf(date: LocalDate): Weekday {
  const { y, m, d } = parseLocalDate(date);
  const dt = new Date(y, m - 1, d);
  const idx = dt.getDay(); // 0 = Sun … 6 = Sat
  return WEEKDAY_NAMES[idx] as Weekday;
}

/**
 * Returns the next LocalDate strictly AFTER `after` that matches one of `weekdays`.
 * Throws if weekdays is empty (defensive).
 */
export function nextScheduledWeekday(after: LocalDate, weekdays: Weekday[]): LocalDate {
  if (weekdays.length === 0) {
    throw new Error('nextScheduledWeekday: weekdays array must not be empty');
  }
  const set = new Set(weekdays);
  for (let k = 1; k <= 7; k++) {
    const candidate = addDays(after, k);
    if (set.has(weekdayOf(candidate))) {
      return candidate;
    }
  }
  // Unreachable: weekdays has ≥1 entry and we walk 7 days (one full week)
  throw new Error('nextScheduledWeekday: no match found in 7-day window (should be impossible)');
}

/**
 * Returns the next monthly date strictly AFTER `anchor` on `dayOfMonth`,
 * clamping to last-day-of-month when the month is shorter.
 */
export function nextMonthlyDate(anchor: LocalDate, dayOfMonth: number): LocalDate {
  const { y, m } = parseLocalDate(anchor);
  let nextYear = y;
  let nextMonth = m + 1;
  if (nextMonth > 12) {
    nextYear++;
    nextMonth = 1;
  }
  const last = lastDayOfMonth(nextYear, nextMonth);
  const day = Math.min(dayOfMonth, last);
  return formatLocalDate(nextYear, nextMonth, day);
}

/**
 * Adds n calendar months to a date, clamping the day to the last day of the
 * resulting month when the source day exceeds it (e.g. Jan 31 + 1 → Feb 28/29).
 * Handles negative n and year rollovers correctly.
 */
export function addMonths(date: LocalDate, n: number): LocalDate {
  const { y, m, d } = parseLocalDate(date);
  // Total months since year 0 (using 0-indexed month)
  const totalMonths = y * 12 + (m - 1) + n;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (totalMonths % 12) + 1;
  const clampedDay = Math.min(d, lastDayOfMonth(newYear, newMonth));
  return formatLocalDate(newYear, newMonth, clampedDay);
}

/**
 * Returns the next yearly date strictly AFTER `anchor` for (month, day),
 * clamping for Feb 29 → Feb 28 in non-leap years.
 *
 * Algorithm: try anchor.year+1 first. If anchor is before this year's date, use
 * this year instead (handles the edge case where the task is completed early in
 * the year before this year's occurrence).
 */
export function nextYearlyDate(anchor: LocalDate, month: number, day: number): LocalDate {
  const { y: anchorYear } = parseLocalDate(anchor);

  // Try the same year first (only if the date is strictly after anchor)
  const lastSameYear = lastDayOfMonth(anchorYear, month);
  const daySameYear = Math.min(day, lastSameYear);
  const candidateSameYear = formatLocalDate(anchorYear, month, daySameYear);
  if (candidateSameYear > anchor) {
    return candidateSameYear;
  }

  // Otherwise use next year
  const nextYear = anchorYear + 1;
  const lastNextYear = lastDayOfMonth(nextYear, month);
  const dayNextYear = Math.min(day, lastNextYear);
  return formatLocalDate(nextYear, month, dayNextYear);
}
