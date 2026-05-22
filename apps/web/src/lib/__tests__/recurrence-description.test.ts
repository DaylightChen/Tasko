/**
 * Unit tests for lib/recurrence-description.ts — describeRecurrence().
 *
 * Covers:
 * - null rule → empty string
 * - daily, both anchor modes
 * - every_n_days with various intervals (1, 3, 7, 30), both anchor modes
 * - weekly with single weekday, multi-weekday (Mon+Wed+Fri), all-weekday set, both anchor modes
 *   Weekday sort order: Mon < Tue < Wed < Thu < Fri < Sat < Sun
 * - monthly with various day_of_month values, both anchor modes
 * - yearly with various month/day combinations including Apr 30 edge, both anchor modes
 */
import type { RecurrenceRule } from '@tasko/types';
import { describe, expect, it } from 'vitest';
import { describeRecurrence } from '../recurrence-description';

// ─── null ─────────────────────────────────────────────────────────────────────

describe('describeRecurrence — null rule', () => {
  it('returns empty string for null', () => {
    expect(describeRecurrence(null)).toBe('');
  });
});

// ─── daily ────────────────────────────────────────────────────────────────────

describe('describeRecurrence — daily', () => {
  it('daily on_schedule → "Every day • on schedule"', () => {
    const rule: RecurrenceRule = { frequency: 'daily', anchor_mode: 'on_schedule' };
    expect(describeRecurrence(rule)).toBe('Every day • on schedule');
  });

  it('daily after_completion → "Every day • after completion"', () => {
    const rule: RecurrenceRule = { frequency: 'daily', anchor_mode: 'after_completion' };
    expect(describeRecurrence(rule)).toBe('Every day • after completion');
  });
});

// ─── every_n_days ─────────────────────────────────────────────────────────────

describe('describeRecurrence — every_n_days', () => {
  it('interval=1 on_schedule → "Every day • on schedule" (treated as daily)', () => {
    const rule: RecurrenceRule = { frequency: 'every_n_days', interval: 1, anchor_mode: 'on_schedule' };
    expect(describeRecurrence(rule)).toBe('Every day • on schedule');
  });

  it('interval=3 on_schedule → "Every 3 days • on schedule"', () => {
    const rule: RecurrenceRule = { frequency: 'every_n_days', interval: 3, anchor_mode: 'on_schedule' };
    expect(describeRecurrence(rule)).toBe('Every 3 days • on schedule');
  });

  it('interval=7 after_completion → "Every 7 days • after completion"', () => {
    const rule: RecurrenceRule = { frequency: 'every_n_days', interval: 7, anchor_mode: 'after_completion' };
    expect(describeRecurrence(rule)).toBe('Every 7 days • after completion');
  });

  it('interval=14 on_schedule → "Every 14 days • on schedule"', () => {
    const rule: RecurrenceRule = { frequency: 'every_n_days', interval: 14, anchor_mode: 'on_schedule' };
    expect(describeRecurrence(rule)).toBe('Every 14 days • on schedule');
  });

  it('interval=30 after_completion → "Every 30 days • after completion"', () => {
    const rule: RecurrenceRule = { frequency: 'every_n_days', interval: 30, anchor_mode: 'after_completion' };
    expect(describeRecurrence(rule)).toBe('Every 30 days • after completion');
  });

  it('interval=365 on_schedule → "Every 365 days • on schedule"', () => {
    const rule: RecurrenceRule = { frequency: 'every_n_days', interval: 365, anchor_mode: 'on_schedule' };
    expect(describeRecurrence(rule)).toBe('Every 365 days • on schedule');
  });
});

// ─── weekly ───────────────────────────────────────────────────────────────────

describe('describeRecurrence — weekly', () => {
  it('single weekday Mon on_schedule → "Every Mon • on schedule"', () => {
    const rule: RecurrenceRule = { frequency: 'weekly', weekdays: ['mon'], anchor_mode: 'on_schedule' };
    expect(describeRecurrence(rule)).toBe('Every Mon • on schedule');
  });

  it('Mon, Wed, Fri after_completion → "Every Mon, Wed, Fri • after completion"', () => {
    const rule: RecurrenceRule = {
      frequency: 'weekly',
      weekdays: ['mon', 'wed', 'fri'],
      anchor_mode: 'after_completion',
    };
    expect(describeRecurrence(rule)).toBe('Every Mon, Wed, Fri • after completion');
  });

  it('Mon, Wed, Fri on_schedule → "Every Mon, Wed, Fri • on schedule"', () => {
    const rule: RecurrenceRule = {
      frequency: 'weekly',
      weekdays: ['mon', 'wed', 'fri'],
      anchor_mode: 'on_schedule',
    };
    expect(describeRecurrence(rule)).toBe('Every Mon, Wed, Fri • on schedule');
  });

  it('weekdays provided out of order are sorted Mon-first', () => {
    // Input: fri, mon, wed — output should be Mon, Wed, Fri
    const rule: RecurrenceRule = {
      frequency: 'weekly',
      weekdays: ['fri', 'mon', 'wed'],
      anchor_mode: 'on_schedule',
    };
    expect(describeRecurrence(rule)).toBe('Every Mon, Wed, Fri • on schedule');
  });

  it('Sat, Sun on_schedule → "Every Sat, Sun • on schedule"', () => {
    const rule: RecurrenceRule = {
      frequency: 'weekly',
      weekdays: ['sat', 'sun'],
      anchor_mode: 'on_schedule',
    };
    expect(describeRecurrence(rule)).toBe('Every Sat, Sun • on schedule');
  });

  it('Sun only after_completion → "Every Sun • after completion"', () => {
    const rule: RecurrenceRule = {
      frequency: 'weekly',
      weekdays: ['sun'],
      anchor_mode: 'after_completion',
    };
    expect(describeRecurrence(rule)).toBe('Every Sun • after completion');
  });

  it('all 7 weekdays on_schedule → "Every Mon, Tue, Wed, Thu, Fri, Sat, Sun • on schedule"', () => {
    const rule: RecurrenceRule = {
      frequency: 'weekly',
      weekdays: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
      anchor_mode: 'on_schedule',
    };
    expect(describeRecurrence(rule)).toBe('Every Mon, Tue, Wed, Thu, Fri, Sat, Sun • on schedule');
  });

  it('Tue, Thu on_schedule → "Every Tue, Thu • on schedule"', () => {
    const rule: RecurrenceRule = {
      frequency: 'weekly',
      weekdays: ['tue', 'thu'],
      anchor_mode: 'on_schedule',
    };
    expect(describeRecurrence(rule)).toBe('Every Tue, Thu • on schedule');
  });
});

// ─── monthly ─────────────────────────────────────────────────────────────────

describe('describeRecurrence — monthly', () => {
  it('day=15 on_schedule → "Day 15 of every month • on schedule"', () => {
    const rule: RecurrenceRule = { frequency: 'monthly', day_of_month: 15, anchor_mode: 'on_schedule' };
    expect(describeRecurrence(rule)).toBe('Day 15 of every month • on schedule');
  });

  it('day=1 on_schedule → "Day 1 of every month • on schedule"', () => {
    const rule: RecurrenceRule = { frequency: 'monthly', day_of_month: 1, anchor_mode: 'on_schedule' };
    expect(describeRecurrence(rule)).toBe('Day 1 of every month • on schedule');
  });

  it('day=31 after_completion → "Day 31 of every month • after completion"', () => {
    const rule: RecurrenceRule = { frequency: 'monthly', day_of_month: 31, anchor_mode: 'after_completion' };
    expect(describeRecurrence(rule)).toBe('Day 31 of every month • after completion');
  });

  it('day=28 on_schedule → "Day 28 of every month • on schedule"', () => {
    const rule: RecurrenceRule = { frequency: 'monthly', day_of_month: 28, anchor_mode: 'on_schedule' };
    expect(describeRecurrence(rule)).toBe('Day 28 of every month • on schedule');
  });

  it('day=10 after_completion → "Day 10 of every month • after completion"', () => {
    const rule: RecurrenceRule = { frequency: 'monthly', day_of_month: 10, anchor_mode: 'after_completion' };
    expect(describeRecurrence(rule)).toBe('Day 10 of every month • after completion');
  });
});

// ─── yearly ──────────────────────────────────────────────────────────────────

describe('describeRecurrence — yearly', () => {
  it('month=4, day=23 on_schedule → "Apr 23 each year • on schedule"', () => {
    const rule: RecurrenceRule = { frequency: 'yearly', month: 4, day: 23, anchor_mode: 'on_schedule' };
    expect(describeRecurrence(rule)).toBe('Apr 23 each year • on schedule');
  });

  it('month=1, day=1 on_schedule → "Jan 1 each year • on schedule"', () => {
    const rule: RecurrenceRule = { frequency: 'yearly', month: 1, day: 1, anchor_mode: 'on_schedule' };
    expect(describeRecurrence(rule)).toBe('Jan 1 each year • on schedule');
  });

  it('month=12, day=25 after_completion → "Dec 25 each year • after completion"', () => {
    const rule: RecurrenceRule = { frequency: 'yearly', month: 12, day: 25, anchor_mode: 'after_completion' };
    expect(describeRecurrence(rule)).toBe('Dec 25 each year • after completion');
  });

  it('month=2, day=29 on_schedule → "Feb 29 each year • on schedule"', () => {
    const rule: RecurrenceRule = { frequency: 'yearly', month: 2, day: 29, anchor_mode: 'on_schedule' };
    expect(describeRecurrence(rule)).toBe('Feb 29 each year • on schedule');
  });

  it('month=6, day=15 after_completion → "Jun 15 each year • after completion"', () => {
    const rule: RecurrenceRule = { frequency: 'yearly', month: 6, day: 15, anchor_mode: 'after_completion' };
    expect(describeRecurrence(rule)).toBe('Jun 15 each year • after completion');
  });

  it('all 12 months produce correct label', () => {
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let m = 1; m <= 12; m++) {
      const rule: RecurrenceRule = { frequency: 'yearly', month: m, day: 15, anchor_mode: 'on_schedule' };
      const expected = `${monthLabels[m - 1]} 15 each year • on schedule`;
      expect(describeRecurrence(rule)).toBe(expected);
    }
  });
});
