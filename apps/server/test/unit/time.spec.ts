/**
 * Unit tests for domain/time.ts
 *
 * Covers:
 * - parseLocalDate / formatLocalDate round-trip (via addDays 0)
 * - addDays: positive, negative, zero, cross-month, cross-year, leap year
 * - daysBetween: same, ordered, negative, cross-year
 * - lastDayOfMonth: every month incl. Feb leap (2028) vs non-leap (2026, 2027)
 * - weekdayOf: known anchor dates Mon/Wed/Fri/Sun
 * - nextScheduledWeekday: Sun + {Mon,Wed,Fri}, Fri + {Mon}, Mon + {Mon} = +7, empty throws
 * - nextMonthlyDate: normal, clamp Jan→Feb non-leap, clamp Jan→Feb leap, clamp Mar→Apr, Dec→Jan
 * - nextYearlyDate: normal, Feb-29 leap → Feb-28 non-leap, same-year branch, passed-date → next-year
 */
import type { LocalDate, Weekday } from '@tasko/types';
import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  daysBetween,
  lastDayOfMonth,
  nextMonthlyDate,
  nextScheduledWeekday,
  nextYearlyDate,
  weekdayOf,
} from '../../src/domain/time.js';

// Convenience cast — avoids cluttering every test with `as LocalDate`
const d = (s: string): LocalDate => s as LocalDate;

// ─── addDays ─────────────────────────────────────────────────────────────────

describe('addDays', () => {
  it('round-trips: addDays with n=0 returns same date', () => {
    expect(addDays(d('2026-01-01'), 0)).toBe('2026-01-01');
  });

  it('adds 1 day within a month', () => {
    expect(addDays(d('2026-05-18'), 1)).toBe('2026-05-19');
  });

  it('adds a positive number of days across a month boundary (Jan 31 + 1 → Feb 1)', () => {
    expect(addDays(d('2026-01-31'), 1)).toBe('2026-02-01');
  });

  it('adds across year boundary (Dec 31 + 1 → Jan 1)', () => {
    expect(addDays(d('2026-12-31'), 1)).toBe('2027-01-01');
  });

  it('handles leap year: Feb 28 2028 + 1 = Feb 29 2028', () => {
    expect(addDays(d('2028-02-28'), 1)).toBe('2028-02-29');
  });

  it('handles non-leap year: Feb 28 2026 + 1 = Mar 1 2026', () => {
    expect(addDays(d('2026-02-28'), 1)).toBe('2026-03-01');
  });

  it('handles Feb 29 2028 + 365 = Feb 28 2029 (non-leap)', () => {
    expect(addDays(d('2028-02-29'), 365)).toBe('2029-02-28');
  });

  it('adds 365 days: 2026-01-01 + 365 = 2027-01-01', () => {
    expect(addDays(d('2026-01-01'), 365)).toBe('2027-01-01');
  });

  it('subtracts 1 day (negative n)', () => {
    expect(addDays(d('2026-05-19'), -1)).toBe('2026-05-18');
  });

  it('subtracts across month boundary (Mar 1 - 1 = Feb 28 non-leap)', () => {
    expect(addDays(d('2026-03-01'), -1)).toBe('2026-02-28');
  });

  it('subtracts across year boundary (Jan 1 - 1 = Dec 31 prior year)', () => {
    expect(addDays(d('2026-01-01'), -1)).toBe('2025-12-31');
  });

  it('adds 0 days to Dec 15 returns Dec 15', () => {
    expect(addDays(d('2026-12-15'), 0)).toBe('2026-12-15');
  });
});

// ─── daysBetween ─────────────────────────────────────────────────────────────

describe('daysBetween', () => {
  it('returns 0 for same date', () => {
    expect(daysBetween(d('2026-05-10'), d('2026-05-10'))).toBe(0);
  });

  it('returns 9 from May 1 to May 10', () => {
    expect(daysBetween(d('2026-05-01'), d('2026-05-10'))).toBe(9);
  });

  it('returns negative when b < a (reversed order)', () => {
    expect(daysBetween(d('2026-05-10'), d('2026-05-01'))).toBe(-9);
  });

  it('counts days across year boundary', () => {
    // Dec 31, 2025 → Jan 1, 2026 = 1 day
    expect(daysBetween(d('2025-12-31'), d('2026-01-01'))).toBe(1);
  });

  it('counts days across year boundary (multi-year)', () => {
    // 2026-01-01 → 2027-01-01 = 365 (non-leap 2026)
    expect(daysBetween(d('2026-01-01'), d('2027-01-01'))).toBe(365);
  });

  it('handles leap year: Feb 29 2028 exists — 2028-02-28 to 2028-03-01 = 2', () => {
    expect(daysBetween(d('2028-02-28'), d('2028-03-01'))).toBe(2);
  });
});

// ─── lastDayOfMonth ───────────────────────────────────────────────────────────

describe('lastDayOfMonth', () => {
  it('January has 31 days', () => {
    expect(lastDayOfMonth(2026, 1)).toBe(31);
  });

  it('February 2026 (non-leap) has 28 days', () => {
    expect(lastDayOfMonth(2026, 2)).toBe(28);
  });

  it('February 2027 (non-leap) has 28 days', () => {
    expect(lastDayOfMonth(2027, 2)).toBe(28);
  });

  it('February 2028 (leap) has 29 days', () => {
    expect(lastDayOfMonth(2028, 2)).toBe(29);
  });

  it('March has 31 days', () => {
    expect(lastDayOfMonth(2026, 3)).toBe(31);
  });

  it('April has 30 days', () => {
    expect(lastDayOfMonth(2026, 4)).toBe(30);
  });

  it('May has 31 days', () => {
    expect(lastDayOfMonth(2026, 5)).toBe(31);
  });

  it('June has 30 days', () => {
    expect(lastDayOfMonth(2026, 6)).toBe(30);
  });

  it('July has 31 days', () => {
    expect(lastDayOfMonth(2026, 7)).toBe(31);
  });

  it('August has 31 days', () => {
    expect(lastDayOfMonth(2026, 8)).toBe(31);
  });

  it('September has 30 days', () => {
    expect(lastDayOfMonth(2026, 9)).toBe(30);
  });

  it('October has 31 days', () => {
    expect(lastDayOfMonth(2026, 10)).toBe(31);
  });

  it('November has 30 days', () => {
    expect(lastDayOfMonth(2026, 11)).toBe(30);
  });

  it('December has 31 days', () => {
    expect(lastDayOfMonth(2026, 12)).toBe(31);
  });
});

// ─── weekdayOf ────────────────────────────────────────────────────────────────

describe('weekdayOf', () => {
  // 2026-05-18 is a Monday (verified: month starts Fri May 1, +17 days = Mon May 18)
  it('2026-05-18 is Monday', () => {
    expect(weekdayOf(d('2026-05-18'))).toBe('mon' as Weekday);
  });

  // 2026-05-20 is Wednesday
  it('2026-05-20 is Wednesday', () => {
    expect(weekdayOf(d('2026-05-20'))).toBe('wed' as Weekday);
  });

  // 2026-05-22 is Friday
  it('2026-05-22 is Friday', () => {
    expect(weekdayOf(d('2026-05-22'))).toBe('fri' as Weekday);
  });

  // 2026-05-24 is Sunday
  it('2026-05-24 is Sunday', () => {
    expect(weekdayOf(d('2026-05-24'))).toBe('sun' as Weekday);
  });

  // 2026-05-23 is Saturday
  it('2026-05-23 is Saturday', () => {
    expect(weekdayOf(d('2026-05-23'))).toBe('sat' as Weekday);
  });

  // 2026-05-19 is Tuesday
  it('2026-05-19 is Tuesday', () => {
    expect(weekdayOf(d('2026-05-19'))).toBe('tue' as Weekday);
  });

  // 2026-05-21 is Thursday
  it('2026-05-21 is Thursday', () => {
    expect(weekdayOf(d('2026-05-21'))).toBe('thu' as Weekday);
  });
});

// ─── nextScheduledWeekday ─────────────────────────────────────────────────────

describe('nextScheduledWeekday', () => {
  // anchor = Sunday (2026-05-24)
  it('anchor Sun + {Mon,Wed,Fri} → next Mon (2026-05-25)', () => {
    expect(nextScheduledWeekday(d('2026-05-24'), ['mon', 'wed', 'fri'] as Weekday[])).toBe('2026-05-25');
  });

  // anchor = Friday (2026-05-22) + {Mon} → next Mon = May 25
  it('anchor Fri + {Mon} → next Mon (2026-05-25)', () => {
    expect(nextScheduledWeekday(d('2026-05-22'), ['mon'] as Weekday[])).toBe('2026-05-25');
  });

  // anchor = Monday (2026-05-18) + {Mon} → strictly AFTER, so next Mon = May 25
  it('anchor Mon + {Mon} → anchor+7 (2026-05-25)', () => {
    expect(nextScheduledWeekday(d('2026-05-18'), ['mon'] as Weekday[])).toBe('2026-05-25');
  });

  // anchor = Monday (2026-05-18) + {Mon,Wed,Fri} → next Wed = May 20
  it('anchor Mon + {Mon,Wed,Fri} → next Wed (2026-05-20)', () => {
    expect(nextScheduledWeekday(d('2026-05-18'), ['mon', 'wed', 'fri'] as Weekday[])).toBe('2026-05-20');
  });

  // anchor = Sat (2026-05-23) + {Sat,Sun} → Sun (2026-05-24)
  it('anchor Sat + {Sat,Sun} → next Sun (2026-05-24)', () => {
    expect(nextScheduledWeekday(d('2026-05-23'), ['sat', 'sun'] as Weekday[])).toBe('2026-05-24');
  });

  // empty weekdays array throws
  it('throws when weekdays array is empty', () => {
    expect(() => nextScheduledWeekday(d('2026-05-18'), [])).toThrow();
  });
});

// ─── nextMonthlyDate ──────────────────────────────────────────────────────────

describe('nextMonthlyDate', () => {
  it('May 15 + dom=15 → Jun 15', () => {
    expect(nextMonthlyDate(d('2026-05-15'), 15)).toBe('2026-06-15');
  });

  it('Jan 31 + dom=31 → Feb 28 (non-leap 2026)', () => {
    expect(nextMonthlyDate(d('2026-01-31'), 31)).toBe('2026-02-28');
  });

  it('Jan 31 2028 + dom=31 → Feb 29 (leap 2028)', () => {
    expect(nextMonthlyDate(d('2028-01-31'), 31)).toBe('2028-02-29');
  });

  it('Mar 31 + dom=31 → Apr 30 (April has 30 days)', () => {
    expect(nextMonthlyDate(d('2026-03-31'), 31)).toBe('2026-04-30');
  });

  it('Dec 15 + dom=15 → Jan 15 next year', () => {
    expect(nextMonthlyDate(d('2026-12-15'), 15)).toBe('2027-01-15');
  });

  it('Jan 29 (non-leap) + dom=29 → Feb 28 (2026)', () => {
    expect(nextMonthlyDate(d('2026-01-29'), 29)).toBe('2026-02-28');
  });

  it('Jan 29 2028 (leap) + dom=29 → Feb 29 2028', () => {
    expect(nextMonthlyDate(d('2028-01-29'), 29)).toBe('2028-02-29');
  });

  it('Nov 30 + dom=30 → Dec 30 (Dec has 31 days, no clamp needed)', () => {
    expect(nextMonthlyDate(d('2026-11-30'), 30)).toBe('2026-12-30');
  });

  it('dom=1 always lands on the 1st of the next month', () => {
    expect(nextMonthlyDate(d('2026-05-01'), 1)).toBe('2026-06-01');
  });
});

// ─── addMonths ────────────────────────────────────────────────────────────────

describe('addMonths', () => {
  it('normal: May 15 + 1 month → Jun 15', () => {
    expect(addMonths(d('2026-05-15'), 1)).toBe('2026-06-15');
  });

  it('day clamp, non-leap: Jan 31 + 1 month → Feb 28 (2026)', () => {
    expect(addMonths(d('2026-01-31'), 1)).toBe('2026-02-28');
  });

  it('day clamp, leap: Jan 31 + 1 month → Feb 29 (2028)', () => {
    expect(addMonths(d('2028-01-31'), 1)).toBe('2028-02-29');
  });

  it('day clamp, April: Mar 31 + 1 month → Apr 30', () => {
    expect(addMonths(d('2026-03-31'), 1)).toBe('2026-04-30');
  });

  it('year rollover: Dec 15 + 1 month → Jan 15 next year', () => {
    expect(addMonths(d('2026-12-15'), 1)).toBe('2027-01-15');
  });

  it('negative n: May 15 - 1 month → Apr 15', () => {
    expect(addMonths(d('2026-05-15'), -1)).toBe('2026-04-15');
  });

  it('n=0: May 15 + 0 months → May 15', () => {
    expect(addMonths(d('2026-05-15'), 0)).toBe('2026-05-15');
  });

  it('no clamp needed: Jan 31 + 2 months → Mar 31 (March has 31 days)', () => {
    expect(addMonths(d('2026-01-31'), 2)).toBe('2026-03-31');
  });

  it('leap-day + 1 year: Feb 29 2028 + 12 months → Feb 28 2029 (non-leap, clamp)', () => {
    expect(addMonths(d('2028-02-29'), 12)).toBe('2029-02-28');
  });
});

// ─── nextYearlyDate ───────────────────────────────────────────────────────────

describe('nextYearlyDate', () => {
  it('2026-01-01 + Jan 1 → 2027-01-01 (same-day anchor wraps to next year)', () => {
    expect(nextYearlyDate(d('2026-01-01'), 1, 1)).toBe('2027-01-01');
  });

  it('2028-02-29 + Feb 29 → 2029-02-28 (Feb 29 non-existent in 2029 → clamp)', () => {
    expect(nextYearlyDate(d('2028-02-29'), 2, 29)).toBe('2029-02-28');
  });

  it('same-year branch: anchor 2026-03-15, target=Dec 25 → 2026-12-25 (still in same year)', () => {
    expect(nextYearlyDate(d('2026-03-15'), 12, 25)).toBe('2026-12-25');
  });

  it('2026-03-15 + Feb 14 → 2027-02-14 (target Feb 14 already passed in 2026)', () => {
    expect(nextYearlyDate(d('2026-03-15'), 2, 14)).toBe('2027-02-14');
  });

  it('yearly month=4, day=31 → Apr 30 clamp (April only has 30 days)', () => {
    // anchor is Jan 1 so same-year candidate Apr 30 is strictly after → returns Apr 30 this year
    expect(nextYearlyDate(d('2026-01-01'), 4, 31)).toBe('2026-04-30');
  });

  it('Dec 31 + Dec 31 → next year Dec 31', () => {
    expect(nextYearlyDate(d('2026-12-31'), 12, 31)).toBe('2027-12-31');
  });

  it('early in year, target same month earlier day → wraps to next year', () => {
    // anchor = 2026-05-20, target = May 18 (already passed in 2026) → 2027-05-18
    expect(nextYearlyDate(d('2026-05-20'), 5, 18)).toBe('2027-05-18');
  });
});
