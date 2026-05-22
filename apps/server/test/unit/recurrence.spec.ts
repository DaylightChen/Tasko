/**
 * Unit tests for domain/recurrence.ts — the 80-case matrix.
 *
 * Covers all 5 frequencies × 2 anchor modes × edge cases:
 * - daily: on_schedule (on-time, early, late), after_completion (on-time, late)
 * - every_n_days: on_schedule and after_completion, various intervals
 * - weekly: single weekday, multi-weekday, both anchor modes, Saturday/Sunday sets,
 *            after_completion with completion on non-weekday
 * - monthly: normal, day clamping (Jan→Feb non-leap, Jan→Feb leap, Mar→Apr, Nov→Dec),
 *            day=29 Feb edge, after_completion (anchor shifts)
 * - yearly: normal, Feb-29 non-leap clamp, same-year branch, April-31→April-30
 * - multi-day span preservation: weekly, daily, every_n_days cases
 * - overdue completion: on_schedule ignores completion date, after_completion uses it
 * - anchor mode determinism: same rule + prev → different completed dates
 * - start_date=null → start_date preserved as null in output
 */
import type { LocalDate, RecurrenceRule } from '@tasko/types';
import { describe, expect, it } from 'vitest';
import { nextDueDate } from '../../src/domain/recurrence.js';

const d = (s: string): LocalDate => s as LocalDate;

// Helper to build a call and assert
function calc(opts: {
  rule: RecurrenceRule;
  prev: LocalDate;
  completedAt: LocalDate;
  prevStart?: LocalDate | null;
}): { due_date: LocalDate; start_date: LocalDate | null } {
  return nextDueDate({
    rule: opts.rule,
    previousDueDate: opts.prev,
    completedAt: opts.completedAt,
    previousStartDate: opts.prevStart ?? null,
  });
}

// ─── DAILY ───────────────────────────────────────────────────────────────────

describe('daily — on_schedule', () => {
  const rule: RecurrenceRule = { frequency: 'daily', anchor_mode: 'on_schedule' };

  it('completed on due date → next = due + 1', () => {
    const r = calc({ rule, prev: d('2026-05-18'), completedAt: d('2026-05-18') });
    expect(r.due_date).toBe('2026-05-19');
    expect(r.start_date).toBeNull();
  });

  it('early completion → next still = prev_due + 1 (on_schedule ignores completion date)', () => {
    const r = calc({ rule, prev: d('2026-05-18'), completedAt: d('2026-05-17') });
    expect(r.due_date).toBe('2026-05-19');
  });

  it('late completion (overdue by a week) → next = prev_due + 1', () => {
    const r = calc({ rule, prev: d('2026-05-18'), completedAt: d('2026-05-25') });
    expect(r.due_date).toBe('2026-05-19');
  });

  it('cross-month: prev=Jan 31 → next=Feb 1', () => {
    const r = calc({ rule, prev: d('2026-01-31'), completedAt: d('2026-01-31') });
    expect(r.due_date).toBe('2026-02-01');
  });

  it('cross-year: prev=Dec 31 → next=Jan 1', () => {
    const r = calc({ rule, prev: d('2026-12-31'), completedAt: d('2026-12-31') });
    expect(r.due_date).toBe('2027-01-01');
  });
});

describe('daily — after_completion', () => {
  const rule: RecurrenceRule = { frequency: 'daily', anchor_mode: 'after_completion' };

  it('completed one day after due → next = completed + 1', () => {
    const r = calc({ rule, prev: d('2026-05-18'), completedAt: d('2026-05-19') });
    expect(r.due_date).toBe('2026-05-20');
    expect(r.start_date).toBeNull();
  });

  it('late by a week → next = completed + 1 (ignores prev)', () => {
    const r = calc({ rule, prev: d('2026-05-18'), completedAt: d('2026-05-25') });
    expect(r.due_date).toBe('2026-05-26');
  });

  it('completed on same day as due → next = completed + 1', () => {
    const r = calc({ rule, prev: d('2026-05-18'), completedAt: d('2026-05-18') });
    expect(r.due_date).toBe('2026-05-19');
  });

  it('completed early → next = completed + 1 (uses completion, not prev)', () => {
    const r = calc({ rule, prev: d('2026-05-18'), completedAt: d('2026-05-15') });
    expect(r.due_date).toBe('2026-05-16');
  });
});

// ─── EVERY N DAYS ─────────────────────────────────────────────────────────────

describe('every_n_days — on_schedule', () => {
  it('n=3, completed on time → next = prev + 3', () => {
    const rule: RecurrenceRule = { frequency: 'every_n_days', interval: 3, anchor_mode: 'on_schedule' };
    const r = calc({ rule, prev: d('2026-05-18'), completedAt: d('2026-05-20') });
    expect(r.due_date).toBe('2026-05-21');
  });

  it('n=3, completed late → next = prev + 3 (uses prev, not completion)', () => {
    const rule: RecurrenceRule = { frequency: 'every_n_days', interval: 3, anchor_mode: 'on_schedule' };
    const r = calc({ rule, prev: d('2026-05-18'), completedAt: d('2026-05-30') });
    expect(r.due_date).toBe('2026-05-21');
  });

  it('n=7 → next = prev + 7', () => {
    const rule: RecurrenceRule = { frequency: 'every_n_days', interval: 7, anchor_mode: 'on_schedule' };
    const r = calc({ rule, prev: d('2026-05-11'), completedAt: d('2026-05-11') });
    expect(r.due_date).toBe('2026-05-18');
  });

  it('n=14 cross-month → prev=Jan 25 → next=Feb 8', () => {
    const rule: RecurrenceRule = { frequency: 'every_n_days', interval: 14, anchor_mode: 'on_schedule' };
    const r = calc({ rule, prev: d('2026-01-25'), completedAt: d('2026-01-25') });
    expect(r.due_date).toBe('2026-02-08');
  });

  it('n=1 behaves like daily on_schedule', () => {
    const rule: RecurrenceRule = { frequency: 'every_n_days', interval: 1, anchor_mode: 'on_schedule' };
    const r = calc({ rule, prev: d('2026-05-18'), completedAt: d('2026-05-18') });
    expect(r.due_date).toBe('2026-05-19');
  });
});

describe('every_n_days — after_completion', () => {
  it('n=3, completed 2 days after due → next = completed + 3', () => {
    const rule: RecurrenceRule = { frequency: 'every_n_days', interval: 3, anchor_mode: 'after_completion' };
    const r = calc({ rule, prev: d('2026-05-18'), completedAt: d('2026-05-20') });
    expect(r.due_date).toBe('2026-05-23');
  });

  it('n=7, late completion by several days → anchors from completion', () => {
    const rule: RecurrenceRule = { frequency: 'every_n_days', interval: 7, anchor_mode: 'after_completion' };
    const r = calc({ rule, prev: d('2026-05-11'), completedAt: d('2026-05-20') });
    expect(r.due_date).toBe('2026-05-27');
  });

  it('n=30 → next = completedAt + 30', () => {
    const rule: RecurrenceRule = { frequency: 'every_n_days', interval: 30, anchor_mode: 'after_completion' };
    const r = calc({ rule, prev: d('2026-05-01'), completedAt: d('2026-05-10') });
    expect(r.due_date).toBe('2026-06-09');
  });
});

// ─── WEEKLY ───────────────────────────────────────────────────────────────────

describe('weekly — on_schedule', () => {
  it('{Mon,Wed,Fri} on_schedule: prev=Mon May 18, completed=Mon → next Wed May 20', () => {
    const rule: RecurrenceRule = {
      frequency: 'weekly',
      weekdays: ['mon', 'wed', 'fri'],
      anchor_mode: 'on_schedule',
    };
    const r = calc({ rule, prev: d('2026-05-18'), completedAt: d('2026-05-18') });
    expect(r.due_date).toBe('2026-05-20');
  });

  it('{Mon,Wed,Fri} on_schedule: late completion (Fri) still anchors on prev (Mon) → next Wed', () => {
    const rule: RecurrenceRule = {
      frequency: 'weekly',
      weekdays: ['mon', 'wed', 'fri'],
      anchor_mode: 'on_schedule',
    };
    const r = calc({ rule, prev: d('2026-05-18'), completedAt: d('2026-05-22') });
    expect(r.due_date).toBe('2026-05-20');
  });

  it('{Mon} on_schedule: prev=Mon May 11 Thu completed → next Mon May 18', () => {
    const rule: RecurrenceRule = {
      frequency: 'weekly',
      weekdays: ['mon'],
      anchor_mode: 'on_schedule',
    };
    const r = calc({ rule, prev: d('2026-05-11'), completedAt: d('2026-05-14') });
    expect(r.due_date).toBe('2026-05-18');
  });

  it('{Mon} on_schedule: prev=Mon → next Mon is anchor+7', () => {
    const rule: RecurrenceRule = {
      frequency: 'weekly',
      weekdays: ['mon'],
      anchor_mode: 'on_schedule',
    };
    const r = calc({ rule, prev: d('2026-05-18'), completedAt: d('2026-05-18') });
    expect(r.due_date).toBe('2026-05-25');
  });

  it('{Sat,Sun} on_schedule: prev=Sat May 23 → next Sun May 24', () => {
    const rule: RecurrenceRule = {
      frequency: 'weekly',
      weekdays: ['sat', 'sun'],
      anchor_mode: 'on_schedule',
    };
    const r = calc({ rule, prev: d('2026-05-23'), completedAt: d('2026-05-23') });
    expect(r.due_date).toBe('2026-05-24');
  });

  it('{Wed,Fri} on_schedule: prev=Fri → next Wed (wraps to following week)', () => {
    const rule: RecurrenceRule = {
      frequency: 'weekly',
      weekdays: ['wed', 'fri'],
      anchor_mode: 'on_schedule',
    };
    // 2026-05-22 is Friday; next after Fri in {wed,fri} is next Wed = May 27
    const r = calc({ rule, prev: d('2026-05-22'), completedAt: d('2026-05-22') });
    expect(r.due_date).toBe('2026-05-27');
  });

  it('{Mon,Wed,Fri}: even very late completion anchors on schedule', () => {
    const rule: RecurrenceRule = {
      frequency: 'weekly',
      weekdays: ['mon', 'wed', 'fri'],
      anchor_mode: 'on_schedule',
    };
    // prev = 2026-05-18 (Mon); completed way late on Jun 1 → next is still May 20 (Wed)
    const r = calc({ rule, prev: d('2026-05-18'), completedAt: d('2026-06-01') });
    expect(r.due_date).toBe('2026-05-20');
  });
});

describe('weekly — after_completion', () => {
  it('{Mon} after_completion: prev=May 11, completedAt=Thu May 14 → next Mon May 18', () => {
    const rule: RecurrenceRule = {
      frequency: 'weekly',
      weekdays: ['mon'],
      anchor_mode: 'after_completion',
    };
    const r = calc({ rule, prev: d('2026-05-11'), completedAt: d('2026-05-14') });
    expect(r.due_date).toBe('2026-05-18');
  });

  it('{Mon} after_completion: completedAt=Tue May 19 → next Mon May 25', () => {
    const rule: RecurrenceRule = {
      frequency: 'weekly',
      weekdays: ['mon'],
      anchor_mode: 'after_completion',
    };
    const r = calc({ rule, prev: d('2026-05-11'), completedAt: d('2026-05-19') });
    expect(r.due_date).toBe('2026-05-25');
  });

  it('{Mon,Wed,Fri} after_completion: completedAt=Thu May 14 → next Fri May 15', () => {
    const rule: RecurrenceRule = {
      frequency: 'weekly',
      weekdays: ['mon', 'wed', 'fri'],
      anchor_mode: 'after_completion',
    };
    const r = calc({ rule, prev: d('2026-05-11'), completedAt: d('2026-05-14') });
    expect(r.due_date).toBe('2026-05-15');
  });

  it('{Mon} after_completion: completedAt=Mon May 18 → next Mon = May 25 (strictly after)', () => {
    const rule: RecurrenceRule = {
      frequency: 'weekly',
      weekdays: ['mon'],
      anchor_mode: 'after_completion',
    };
    const r = calc({ rule, prev: d('2026-05-11'), completedAt: d('2026-05-18') });
    expect(r.due_date).toBe('2026-05-25');
  });

  it('{Sat,Sun} after_completion: completedAt=Sat May 23 → next Sun May 24', () => {
    const rule: RecurrenceRule = {
      frequency: 'weekly',
      weekdays: ['sat', 'sun'],
      anchor_mode: 'after_completion',
    };
    const r = calc({ rule, prev: d('2026-05-18'), completedAt: d('2026-05-23') });
    expect(r.due_date).toBe('2026-05-24');
  });
});

// ─── MONTHLY ─────────────────────────────────────────────────────────────────

describe('monthly — on_schedule', () => {
  it('day=15: prev=May 15, completed same day → next Jun 15', () => {
    const rule: RecurrenceRule = { frequency: 'monthly', day_of_month: 15, anchor_mode: 'on_schedule' };
    const r = calc({ rule, prev: d('2026-05-15'), completedAt: d('2026-05-15') });
    expect(r.due_date).toBe('2026-06-15');
  });

  it('day=31 on_schedule, Jan→Feb non-leap: next=Feb 28', () => {
    const rule: RecurrenceRule = { frequency: 'monthly', day_of_month: 31, anchor_mode: 'on_schedule' };
    const r = calc({ rule, prev: d('2026-01-31'), completedAt: d('2026-01-31') });
    expect(r.due_date).toBe('2026-02-28');
  });

  it('day=31 leap year 2028, Jan→Feb: next=Feb 29', () => {
    const rule: RecurrenceRule = { frequency: 'monthly', day_of_month: 31, anchor_mode: 'on_schedule' };
    const r = calc({ rule, prev: d('2028-01-31'), completedAt: d('2028-01-31') });
    expect(r.due_date).toBe('2028-02-29');
  });

  it('day=31 on_schedule, Mar→Apr: next=Apr 30', () => {
    const rule: RecurrenceRule = { frequency: 'monthly', day_of_month: 31, anchor_mode: 'on_schedule' };
    const r = calc({ rule, prev: d('2026-03-31'), completedAt: d('2026-03-31') });
    expect(r.due_date).toBe('2026-04-30');
  });

  it('day=29 on_schedule, non-leap Feb 2026: Jan→Feb clamped to Feb 28', () => {
    const rule: RecurrenceRule = { frequency: 'monthly', day_of_month: 29, anchor_mode: 'on_schedule' };
    const r = calc({ rule, prev: d('2026-01-29'), completedAt: d('2026-01-29') });
    expect(r.due_date).toBe('2026-02-28');
  });

  it('day=29 on_schedule, leap Feb 2028: Jan→Feb lands on Feb 29', () => {
    const rule: RecurrenceRule = { frequency: 'monthly', day_of_month: 29, anchor_mode: 'on_schedule' };
    const r = calc({ rule, prev: d('2028-01-29'), completedAt: d('2028-01-29') });
    expect(r.due_date).toBe('2028-02-29');
  });

  it('day=1 Dec→Jan wraps to next year', () => {
    const rule: RecurrenceRule = { frequency: 'monthly', day_of_month: 1, anchor_mode: 'on_schedule' };
    const r = calc({ rule, prev: d('2026-12-01'), completedAt: d('2026-12-01') });
    expect(r.due_date).toBe('2027-01-01');
  });

  it('day=30 Nov→Dec (no clamp needed)', () => {
    const rule: RecurrenceRule = { frequency: 'monthly', day_of_month: 30, anchor_mode: 'on_schedule' };
    const r = calc({ rule, prev: d('2026-11-30'), completedAt: d('2026-11-30') });
    expect(r.due_date).toBe('2026-12-30');
  });
});

describe('monthly — after_completion', () => {
  it('day=15 after_completion (early): prev=May 15, completed=May 10 → next = Jun 10 (per brief §3 spec)', () => {
    // Per data-model.md §6.4 and brief step 3: after_completion monthly should anchor to completedAt's date
    // and find next occurrence of day=15 AFTER completedAt. With completedAt=May 10, the next occurrence
    // of day=15 in after_completion mode should be Jun 10 in the spec's intent.
    // NOTE: The implementation calls nextMonthlyDate(May 10, 15) = Jun 15 (next month's day 15).
    // This test asserts the brief's expected behavior (Jun 10). If this fails, it's an implementation bug.
    const rule: RecurrenceRule = { frequency: 'monthly', day_of_month: 15, anchor_mode: 'after_completion' };
    const r = calc({ rule, prev: d('2026-05-15'), completedAt: d('2026-05-10') });
    expect(r.due_date).toBe('2026-06-10');
  });

  it('day=31 after_completion: completedAt=Jan 15 → next Feb 15 (no clamp needed since day=15 after 15)', () => {
    // after_completion adds 1 calendar month to completedAt: addMonths(Jan 15, 1) = Feb 15
    const rule: RecurrenceRule = { frequency: 'monthly', day_of_month: 31, anchor_mode: 'after_completion' };
    const r = calc({ rule, prev: d('2026-01-31'), completedAt: d('2026-01-15') });
    expect(r.due_date).toBe('2026-02-15');
  });

  it('day=15 after_completion: completedAt=May 20 → next Jun 20 (anchors on completion)', () => {
    // after_completion adds 1 calendar month to completedAt: addMonths(May 20, 1) = Jun 20
    const rule: RecurrenceRule = { frequency: 'monthly', day_of_month: 15, anchor_mode: 'after_completion' };
    const r = calc({ rule, prev: d('2026-05-15'), completedAt: d('2026-05-20') });
    expect(r.due_date).toBe('2026-06-20');
  });
});

// ─── YEARLY ──────────────────────────────────────────────────────────────────

describe('yearly — on_schedule', () => {
  it('Jan 1 on_schedule: prev=2026-01-01 → next=2027-01-01', () => {
    const rule: RecurrenceRule = { frequency: 'yearly', month: 1, day: 1, anchor_mode: 'on_schedule' };
    const r = calc({ rule, prev: d('2026-01-01'), completedAt: d('2026-01-01') });
    expect(r.due_date).toBe('2027-01-01');
  });

  it('Feb 29 leap year → 2029-02-28 (clamp in non-leap)', () => {
    const rule: RecurrenceRule = { frequency: 'yearly', month: 2, day: 29, anchor_mode: 'on_schedule' };
    const r = calc({ rule, prev: d('2028-02-29'), completedAt: d('2028-02-29') });
    expect(r.due_date).toBe('2029-02-28');
  });

  it('early in year, target is Dec 25 same year: prev=2026-03-15 → 2026-12-25', () => {
    const rule: RecurrenceRule = { frequency: 'yearly', month: 12, day: 25, anchor_mode: 'on_schedule' };
    const r = calc({ rule, prev: d('2026-03-15'), completedAt: d('2026-03-15') });
    expect(r.due_date).toBe('2026-12-25');
  });

  it('prev=2026-03-15, target=Feb 14 (already passed in year) → 2027-02-14', () => {
    const rule: RecurrenceRule = { frequency: 'yearly', month: 2, day: 14, anchor_mode: 'on_schedule' };
    const r = calc({ rule, prev: d('2026-03-15'), completedAt: d('2026-03-15') });
    expect(r.due_date).toBe('2027-02-14');
  });

  it('month=4 day=31 → Apr 30 clamp (April has only 30 days)', () => {
    const rule: RecurrenceRule = { frequency: 'yearly', month: 4, day: 31, anchor_mode: 'on_schedule' };
    // anchor = Jan 1 2026 → same year candidate Apr 30 (clamped) is strictly after Jan 1 → Apr 30 this year
    const r = calc({ rule, prev: d('2026-01-01'), completedAt: d('2026-01-01') });
    expect(r.due_date).toBe('2026-04-30');
  });

  it('Dec 31 → next Dec 31 of following year', () => {
    const rule: RecurrenceRule = { frequency: 'yearly', month: 12, day: 31, anchor_mode: 'on_schedule' };
    const r = calc({ rule, prev: d('2026-12-31'), completedAt: d('2026-12-31') });
    expect(r.due_date).toBe('2027-12-31');
  });
});

describe('yearly — after_completion', () => {
  it('after_completion shifts anchor to completedAt', () => {
    const rule: RecurrenceRule = { frequency: 'yearly', month: 1, day: 1, anchor_mode: 'after_completion' };
    // completed on Jul 1 2026 → anchor = 2026-07-01 → nextYearlyDate(Jul 1, Jan 1):
    // same-year Jan 1 is before Jul 1 → wraps to 2027-01-01
    const r = calc({ rule, prev: d('2026-01-01'), completedAt: d('2026-07-01') });
    expect(r.due_date).toBe('2027-01-01');
  });

  it('after_completion early in year: completedAt=Jan 15, target=Dec 25 → same-year Dec 25', () => {
    const rule: RecurrenceRule = { frequency: 'yearly', month: 12, day: 25, anchor_mode: 'after_completion' };
    const r = calc({ rule, prev: d('2026-01-01'), completedAt: d('2026-01-15') });
    expect(r.due_date).toBe('2026-12-25');
  });
});

// ─── MULTI-DAY SPAN PRESERVATION ─────────────────────────────────────────────

describe('multi-day span preservation', () => {
  it('weekly {Sun} on_schedule: prev_start=Mon May 11, prev_due=Thu May 14 (delta=3) → next_due=Sun May 17, next_start=Thu May 14', () => {
    const rule: RecurrenceRule = {
      frequency: 'weekly',
      weekdays: ['sun'],
      anchor_mode: 'on_schedule',
    };
    // prev_due = May 14 (Thu), anchor = May 14, next weekday Sun = May 17
    // delta = daysBetween(May 11, May 14) = 3 → next_start = May 17 - 3 = May 14
    const r = calc({ rule, prev: d('2026-05-14'), completedAt: d('2026-05-14'), prevStart: d('2026-05-11') });
    expect(r.due_date).toBe('2026-05-17');
    expect(r.start_date).toBe('2026-05-14');
  });

  it('daily on_schedule multi-day: prev_start=May 18, prev_due=May 20 (delta=2) → next_due=May 21, next_start=May 19', () => {
    const rule: RecurrenceRule = { frequency: 'daily', anchor_mode: 'on_schedule' };
    const r = calc({ rule, prev: d('2026-05-20'), completedAt: d('2026-05-20'), prevStart: d('2026-05-18') });
    expect(r.due_date).toBe('2026-05-21');
    expect(r.start_date).toBe('2026-05-19');
  });

  it('every_n_days n=7 after_completion multi-day: prev_start=May 15, prev_due=May 18 (delta=3), completed=May 20 → next_due=May 27, next_start=May 24', () => {
    const rule: RecurrenceRule = { frequency: 'every_n_days', interval: 7, anchor_mode: 'after_completion' };
    const r = calc({ rule, prev: d('2026-05-18'), completedAt: d('2026-05-20'), prevStart: d('2026-05-15') });
    expect(r.due_date).toBe('2026-05-27');
    expect(r.start_date).toBe('2026-05-24');
  });

  it('monthly on_schedule multi-day: prev_start=Jan 28, prev_due=Jan 31 (delta=3) → next_due=Feb 28 (clamped), next_start=Feb 25', () => {
    const rule: RecurrenceRule = { frequency: 'monthly', day_of_month: 31, anchor_mode: 'on_schedule' };
    // delta = daysBetween(Jan 28, Jan 31) = 3 → next_start = Feb 28 - 3 = Feb 25
    const r = calc({ rule, prev: d('2026-01-31'), completedAt: d('2026-01-31'), prevStart: d('2026-01-28') });
    expect(r.due_date).toBe('2026-02-28');
    expect(r.start_date).toBe('2026-02-25');
  });

  it('start_date=null → start_date is null in result', () => {
    const rule: RecurrenceRule = { frequency: 'daily', anchor_mode: 'on_schedule' };
    const r = calc({ rule, prev: d('2026-05-18'), completedAt: d('2026-05-18'), prevStart: null });
    expect(r.start_date).toBeNull();
  });

  it('delta=1 span: start=May 17, due=May 18 → next_due=May 19, next_start=May 18', () => {
    const rule: RecurrenceRule = { frequency: 'daily', anchor_mode: 'on_schedule' };
    const r = calc({ rule, prev: d('2026-05-18'), completedAt: d('2026-05-18'), prevStart: d('2026-05-17') });
    expect(r.due_date).toBe('2026-05-19');
    expect(r.start_date).toBe('2026-05-18');
  });
});

// ─── OVERDUE COMPLETION ───────────────────────────────────────────────────────

describe('overdue completion', () => {
  it('on_schedule overdue: weekly {Mon} prev=May 11, completed=Thu May 14 → next Mon May 18 (based on prev, not completion)', () => {
    const rule: RecurrenceRule = { frequency: 'weekly', weekdays: ['mon'], anchor_mode: 'on_schedule' };
    const r = calc({ rule, prev: d('2026-05-11'), completedAt: d('2026-05-14') });
    expect(r.due_date).toBe('2026-05-18');
  });

  it('after_completion overdue: weekly {Mon} prev=May 11, completed=Thu May 14 → next Mon May 18 (next Mon after completion)', () => {
    const rule: RecurrenceRule = { frequency: 'weekly', weekdays: ['mon'], anchor_mode: 'after_completion' };
    const r = calc({ rule, prev: d('2026-05-11'), completedAt: d('2026-05-14') });
    expect(r.due_date).toBe('2026-05-18');
  });

  it('overdue daily on_schedule: completed a month late → next = prev + 1', () => {
    const rule: RecurrenceRule = { frequency: 'daily', anchor_mode: 'on_schedule' };
    const r = calc({ rule, prev: d('2026-04-01'), completedAt: d('2026-05-01') });
    expect(r.due_date).toBe('2026-04-02');
  });

  it('overdue daily after_completion: completed a month late → next = completedAt + 1', () => {
    const rule: RecurrenceRule = { frequency: 'daily', anchor_mode: 'after_completion' };
    const r = calc({ rule, prev: d('2026-04-01'), completedAt: d('2026-05-01') });
    expect(r.due_date).toBe('2026-05-02');
  });
});

// ─── ANCHOR MODE DETERMINISM ──────────────────────────────────────────────────

describe('anchor mode determinism', () => {
  it('same rule + same prev, different completed → on_schedule unchanged, after_completion shifts', () => {
    const ruleOn: RecurrenceRule = { frequency: 'weekly', weekdays: ['mon'], anchor_mode: 'on_schedule' };
    const ruleAfter: RecurrenceRule = {
      frequency: 'weekly',
      weekdays: ['mon'],
      anchor_mode: 'after_completion',
    };

    // Both with prev = Mon May 11
    const r1 = calc({ rule: ruleOn, prev: d('2026-05-11'), completedAt: d('2026-05-12') }); // Tue
    const r2 = calc({ rule: ruleOn, prev: d('2026-05-11'), completedAt: d('2026-05-14') }); // Thu
    // on_schedule: always next Mon after May 11 = May 18
    expect(r1.due_date).toBe('2026-05-18');
    expect(r2.due_date).toBe('2026-05-18');

    const r3 = calc({ rule: ruleAfter, prev: d('2026-05-11'), completedAt: d('2026-05-12') }); // Tue
    const r4 = calc({ rule: ruleAfter, prev: d('2026-05-11'), completedAt: d('2026-05-14') }); // Thu
    // after_completion: next Mon after Tue May 12 = May 18; next Mon after Thu May 14 = May 18 as well...
    // (both land May 18 — this is coincidental; verify they both work)
    expect(r3.due_date).toBe('2026-05-18');
    expect(r4.due_date).toBe('2026-05-18');

    // Now with completedAt spanning two different weeks
    const r5 = calc({ rule: ruleAfter, prev: d('2026-05-11'), completedAt: d('2026-05-18') }); // Mon (May 18)
    const r6 = calc({ rule: ruleAfter, prev: d('2026-05-11'), completedAt: d('2026-05-19') }); // Tue
    expect(r5.due_date).toBe('2026-05-25'); // next Mon after May 18
    expect(r6.due_date).toBe('2026-05-25'); // next Mon after May 19

    // on_schedule for same range still returns May 18
    const r7 = calc({ rule: ruleOn, prev: d('2026-05-11'), completedAt: d('2026-05-18') });
    const r8 = calc({ rule: ruleOn, prev: d('2026-05-11'), completedAt: d('2026-05-19') });
    expect(r7.due_date).toBe('2026-05-18');
    expect(r8.due_date).toBe('2026-05-18');
  });

  it('daily: on_schedule always returns prev+1; after_completion shifts per completion date', () => {
    const ruleOn: RecurrenceRule = { frequency: 'daily', anchor_mode: 'on_schedule' };
    const ruleAfter: RecurrenceRule = { frequency: 'daily', anchor_mode: 'after_completion' };

    expect(calc({ rule: ruleOn, prev: d('2026-05-10'), completedAt: d('2026-05-11') }).due_date).toBe(
      '2026-05-11',
    );
    expect(calc({ rule: ruleOn, prev: d('2026-05-10'), completedAt: d('2026-05-20') }).due_date).toBe(
      '2026-05-11',
    );

    expect(calc({ rule: ruleAfter, prev: d('2026-05-10'), completedAt: d('2026-05-11') }).due_date).toBe(
      '2026-05-12',
    );
    expect(calc({ rule: ruleAfter, prev: d('2026-05-10'), completedAt: d('2026-05-20') }).due_date).toBe(
      '2026-05-21',
    );
  });
});

// ─── ADDITIONAL EDGE CASES ────────────────────────────────────────────────────

describe('additional edge cases', () => {
  it('every_n_days n=365 on_schedule: effectively yearly + 1 day', () => {
    const rule: RecurrenceRule = { frequency: 'every_n_days', interval: 365, anchor_mode: 'on_schedule' };
    // 2026-01-01 + 365 = 2027-01-01 (non-leap 2026)
    const r = calc({ rule, prev: d('2026-01-01'), completedAt: d('2026-01-01') });
    expect(r.due_date).toBe('2027-01-01');
  });

  it('monthly day=28 always stays on the 28th regardless of month', () => {
    const rule: RecurrenceRule = { frequency: 'monthly', day_of_month: 28, anchor_mode: 'on_schedule' };
    const r1 = calc({ rule, prev: d('2026-01-28'), completedAt: d('2026-01-28') });
    expect(r1.due_date).toBe('2026-02-28');
    const r2 = calc({ rule, prev: d('2028-01-28'), completedAt: d('2028-01-28') });
    expect(r2.due_date).toBe('2028-02-28'); // Feb 28 in leap year (not clamped since 28 <= 29)
  });

  it('yearly Feb 28 non-leap year → same day next year', () => {
    const rule: RecurrenceRule = { frequency: 'yearly', month: 2, day: 28, anchor_mode: 'on_schedule' };
    const r = calc({ rule, prev: d('2026-02-28'), completedAt: d('2026-02-28') });
    expect(r.due_date).toBe('2027-02-28');
  });

  it('weekly with all 7 days: always advances exactly 1 day', () => {
    const rule: RecurrenceRule = {
      frequency: 'weekly',
      weekdays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      anchor_mode: 'on_schedule',
    };
    const r = calc({ rule, prev: d('2026-05-18'), completedAt: d('2026-05-18') });
    expect(r.due_date).toBe('2026-05-19');
  });

  it('multi-day every_n_days on_schedule: delta=5, interval=10 → next_due=prev+10, next_start=(prev+10)-5', () => {
    const rule: RecurrenceRule = { frequency: 'every_n_days', interval: 10, anchor_mode: 'on_schedule' };
    // prevStart = May 13, prevDue = May 18, delta = 5
    // anchor = prev = May 18, nextDue = May 28
    // nextStart = May 28 - 5 = May 23
    const r = calc({ rule, prev: d('2026-05-18'), completedAt: d('2026-05-18'), prevStart: d('2026-05-13') });
    expect(r.due_date).toBe('2026-05-28');
    expect(r.start_date).toBe('2026-05-23');
  });
});
