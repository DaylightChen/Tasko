import type { LocalDate, RecurrenceRule } from '@tasko/types';
import {
  addDays,
  addMonths,
  daysBetween,
  nextMonthlyDate,
  nextScheduledWeekday,
  nextYearlyDate,
} from './time.js';

/**
 * Computes the next instance's due_date and start_date (if multi-day) for a
 * recurring item. Pure function: no I/O, no side effects.
 *
 * Multi-day span preservation: when previousStartDate is non-null, the new
 * instance preserves the same duration (delta = daysBetween(prevStart, prevDue))
 * so nextStart = addDays(nextDue, -delta).
 */
export function nextDueDate(opts: {
  rule: RecurrenceRule;
  previousDueDate: LocalDate;
  completedAt: LocalDate;
  previousStartDate: LocalDate | null;
}): { due_date: LocalDate; start_date: LocalDate | null } {
  const { rule, previousDueDate, completedAt, previousStartDate } = opts;

  // Anchor: the base date from which the next occurrence is calculated.
  const anchor: LocalDate = rule.anchor_mode === 'on_schedule' ? previousDueDate : completedAt;

  let nextDue: LocalDate;

  switch (rule.frequency) {
    case 'daily':
      nextDue = addDays(anchor, 1);
      break;

    case 'every_n_days':
      nextDue = addDays(anchor, rule.interval);
      break;

    case 'weekly':
      // Find the next allowed weekday strictly after anchor.
      // on_schedule: anchor = previousDueDate → next weekday after the scheduled date.
      // after_completion: anchor = completedAt → next weekday after completion date.
      nextDue = nextScheduledWeekday(anchor, rule.weekdays);
      break;

    case 'monthly':
      if (rule.anchor_mode === 'on_schedule') {
        nextDue = nextMonthlyDate(previousDueDate, rule.day_of_month);
      } else {
        // after_completion: add one calendar month to the completion date.
        // day_of_month is ignored — the cadence anchors to the day the user actually completes.
        nextDue = addMonths(completedAt, 1);
      }
      break;

    // NOTE: yearly after_completion still uses the rule's (month, day) calendar date as
    // the landing target, not completedAt + 1 year. This is intentional: a yearly rule
    // specifies a specific calendar date (e.g., "New Year's Day", a birthday). The
    // after_completion mode shifts the *anchor* used to find the *next calendar occurrence*
    // of that date, not the date itself. This is asymmetric with daily/monthly where the
    // interval is the primary signal; for yearly, the calendar date is the primary signal.
    case 'yearly':
      nextDue = nextYearlyDate(anchor, rule.month, rule.day);
      break;
  }

  // Multi-day span preservation
  let nextStart: LocalDate | null = null;
  if (previousStartDate !== null) {
    const delta = daysBetween(previousStartDate, previousDueDate); // non-negative
    nextStart = addDays(nextDue, -delta);
  }

  return { due_date: nextDue, start_date: nextStart };
}
