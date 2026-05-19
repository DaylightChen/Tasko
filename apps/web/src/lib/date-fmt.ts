import type { LocalDate, LocalTime } from '@tasko/types';

/** Parse a LocalDate string ("YYYY-MM-DD") into a plain Date at midnight UTC. */
function parseLocal(d: LocalDate): Date {
  const parts = d.split('-').map(Number);
  const y = parts[0] ?? 2000;
  const m = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  return new Date(Date.UTC(y, m - 1, day));
}

/** Return a LocalDate string ("YYYY-MM-DD") for a given Date (using its UTC date parts). */
function toLocalDate(d: Date): LocalDate {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}` as LocalDate;
}

/** Number of whole days from a to b (positive when b is after a). */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  const msPerDay = 86_400_000;
  return Math.round((parseLocal(b).getTime() - parseLocal(a).getTime()) / msPerDay);
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface DateChipResult {
  short: string;
  long: string;
  overdueDays?: number;
}

/**
 * Format a date as a short label for use in a row chip.
 * Returns "Today", "Tomorrow", "Wed May 18", or "May 14 (4d)" for overdue.
 * Also returns the accessible long-form label and overdue day count.
 */
export function formatDateChip(
  date: LocalDate,
  today: LocalDate,
  _weekStart: 'sun' | 'mon' = 'mon',
): DateChipResult {
  const diff = daysBetween(today, date); // positive = future, negative = past

  const d = parseLocal(date);
  const dow = d.getUTCDay();
  const month = MONTH_SHORT[d.getUTCMonth()];
  const dayNum = d.getUTCDate();
  const year = d.getUTCFullYear();

  const longBase = formatDateLong(date, today);

  if (diff === 0) {
    return { short: 'Today', long: longBase };
  }
  if (diff === 1) {
    return { short: 'Tomorrow', long: longBase };
  }
  if (diff < 0) {
    const overdueDays = Math.abs(diff);
    const short = `${month} ${dayNum} (${overdueDays}d)`;
    return { short, long: longBase, overdueDays };
  }
  // Future: "Wed May 18"
  const short = `${WEEKDAY_SHORT[dow]} ${month} ${dayNum}`;
  return { short, long: `${longBase}` };
}

/**
 * Long-form date for aria-label:
 * "Wednesday, May 18, 2026"
 * "Wednesday, May 18, 2026 — today"
 * "Wednesday, May 18, 2026, 4 days overdue"
 */
export function formatDateLong(date: LocalDate, today: LocalDate): string {
  const diff = daysBetween(today, date);
  const d = parseLocal(date);
  const dow = d.getUTCDay();
  const month = MONTH_LONG[d.getUTCMonth()];
  const dayNum = d.getUTCDate();
  const year = d.getUTCFullYear();

  const base = `${WEEKDAY_LONG[dow]}, ${month} ${dayNum}, ${year}`;
  if (diff === 0) return `${base} — today`;
  if (diff < 0) return `${base}, ${Math.abs(diff)} days overdue`;
  return base;
}

/**
 * Format a LocalTime string ("HH:MM") according to the device locale's hour convention.
 * Uses Intl.DateTimeFormat to detect 12h vs 24h preference.
 */
export function formatTimeChip(time: LocalTime): string {
  const parts = time.split(':').map(Number);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  // Create a representative date in the local timezone
  const d = new Date();
  d.setHours(h, m, 0, 0);
  try {
    const fmt = new Intl.DateTimeFormat(navigator.language, { hour: 'numeric', minute: '2-digit' });
    return fmt.format(d);
  } catch {
    // Fallback: 24h
    return time;
  }
}

/**
 * Format a date for a group header ("Today", "Tomorrow", "Wed May 18").
 */
export function formatRelativeForGroup(date: LocalDate, today: LocalDate): string {
  const diff = daysBetween(today, date);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  const d = parseLocal(date);
  const dow = d.getUTCDay();
  const month = MONTH_SHORT[d.getUTCMonth()];
  const dayNum = d.getUTCDate();
  return `${WEEKDAY_SHORT[dow]} ${month} ${dayNum}`;
}

/**
 * Return today's date in "YYYY-MM-DD" format from the device clock.
 */
export function todayLocal(): LocalDate {
  return toLocalDate(new Date());
}

/** Whether a date is overdue relative to today. */
export function isOverdue(date: LocalDate, today: LocalDate): boolean {
  return date < today;
}
