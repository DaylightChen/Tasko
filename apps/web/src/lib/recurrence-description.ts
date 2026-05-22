import type { RecurrenceRule, Weekday } from '@tasko/types';

const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

const WEEKDAY_ORDER: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function anchorSuffix(mode: 'on_schedule' | 'after_completion'): string {
  return mode === 'on_schedule' ? 'on schedule' : 'after completion';
}

/**
 * Produces a concise human-readable description of a recurrence rule for display
 * in the Task modal recurrence section.
 *
 * Examples:
 *   - null → ''
 *   - daily, on_schedule → 'Every day • on schedule'
 *   - every_n_days n=3, after_completion → 'Every 3 days • after completion'
 *   - weekly {mon,wed,fri}, on_schedule → 'Every Mon, Wed, Fri • on schedule'
 *   - monthly day=15, on_schedule → 'Day 15 of every month • on schedule'
 *   - yearly month=4, day=23, on_schedule → 'Apr 23 each year • on schedule'
 */
export function describeRecurrence(rule: RecurrenceRule | null): string {
  if (rule === null) return '';

  const suffix = anchorSuffix(rule.anchor_mode);

  switch (rule.frequency) {
    case 'daily':
      return `Every day • ${suffix}`;

    case 'every_n_days':
      return rule.interval === 1 ? `Every day • ${suffix}` : `Every ${rule.interval} days • ${suffix}`;

    case 'weekly': {
      // Sort weekdays in canonical Mon–Sun order for a predictable display
      const sorted = [...rule.weekdays].sort((a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b));
      const labels = sorted.map((d) => WEEKDAY_LABELS[d]).join(', ');
      return `Every ${labels} • ${suffix}`;
    }

    case 'monthly':
      return `Day ${rule.day_of_month} of every month • ${suffix}`;

    case 'yearly': {
      const monthLabel = MONTH_LABELS[rule.month - 1] ?? '';
      return `${monthLabel} ${rule.day} each year • ${suffix}`;
    }
  }
}
