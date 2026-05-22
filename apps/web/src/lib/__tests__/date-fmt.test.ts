import type { LocalDate } from '@tasko/types';
/**
 * Tests for lib/date-fmt.ts
 * Covers: formatDateChip, formatDateLong, formatRelativeForGroup, daysBetween, todayLocal, isOverdue
 */
import { describe, expect, it } from 'vitest';

import {
  daysBetween,
  formatDateChip,
  formatDateLong,
  formatRelativeForGroup,
  isOverdue,
  todayLocal,
} from '../date-fmt';

const d = (s: string) => s as LocalDate;

describe('daysBetween', () => {
  it('returns 0 for same date', () => {
    expect(daysBetween(d('2026-05-18'), d('2026-05-18'))).toBe(0);
  });

  it('returns 1 for consecutive dates', () => {
    expect(daysBetween(d('2026-05-18'), d('2026-05-19'))).toBe(1);
  });

  it('returns negative for dates in the past', () => {
    expect(daysBetween(d('2026-05-18'), d('2026-05-14'))).toBe(-4);
  });
});

describe('formatDateChip', () => {
  const TODAY = d('2026-05-18');

  it('returns "Today" when date equals today', () => {
    const result = formatDateChip(d('2026-05-18'), TODAY);
    expect(result.short).toBe('Today');
    expect(result.overdueDays).toBeUndefined();
  });

  it('returns "Tomorrow" for next day', () => {
    const result = formatDateChip(d('2026-05-19'), TODAY);
    expect(result.short).toBe('Tomorrow');
    expect(result.overdueDays).toBeUndefined();
  });

  it('returns overdue format with day count for past date', () => {
    const result = formatDateChip(d('2026-05-14'), TODAY);
    expect(result.short).toBe('May 14 (4d)');
    expect(result.overdueDays).toBe(4);
  });

  it('returns weekday + month + day for future date > 1 day', () => {
    // 2026-05-20 is a Wednesday
    const result = formatDateChip(d('2026-05-20'), TODAY);
    expect(result.short).toBe('Wed May 20');
    expect(result.overdueDays).toBeUndefined();
  });

  it('returns long form with "— today" suffix for today', () => {
    const result = formatDateChip(d('2026-05-18'), TODAY);
    expect(result.long).toContain('— today');
  });

  it('returns long form with overdue days for past date', () => {
    const result = formatDateChip(d('2026-05-14'), TODAY);
    expect(result.long).toContain('4 days overdue');
  });
});

describe('formatDateLong', () => {
  const TODAY = d('2026-05-18');

  it('returns base date with "— today" for today', () => {
    expect(formatDateLong(d('2026-05-18'), TODAY)).toBe('Monday, May 18, 2026 — today');
  });

  it('returns base date with overdue info for past date', () => {
    expect(formatDateLong(d('2026-05-14'), TODAY)).toBe('Thursday, May 14, 2026, 4 days overdue');
  });

  it('returns plain base date for future date', () => {
    expect(formatDateLong(d('2026-05-20'), TODAY)).toBe('Wednesday, May 20, 2026');
  });

  it('returns correct long form for "tomorrow"', () => {
    expect(formatDateLong(d('2026-05-19'), TODAY)).toBe('Tuesday, May 19, 2026');
  });
});

describe('formatRelativeForGroup', () => {
  const TODAY = d('2026-05-18');

  it('returns "Today" for today', () => {
    expect(formatRelativeForGroup(d('2026-05-18'), TODAY)).toBe('Today');
  });

  it('returns "Tomorrow" for tomorrow', () => {
    expect(formatRelativeForGroup(d('2026-05-19'), TODAY)).toBe('Tomorrow');
  });

  it('returns weekday + month + day for other dates', () => {
    expect(formatRelativeForGroup(d('2026-05-20'), TODAY)).toBe('Wed May 20');
  });
});

describe('isOverdue', () => {
  const TODAY = d('2026-05-18');

  it('returns true for date before today', () => {
    expect(isOverdue(d('2026-05-17'), TODAY)).toBe(true);
  });

  it('returns false for today', () => {
    expect(isOverdue(d('2026-05-18'), TODAY)).toBe(false);
  });

  it('returns false for future date', () => {
    expect(isOverdue(d('2026-05-19'), TODAY)).toBe(false);
  });
});

describe('todayLocal', () => {
  it('returns a YYYY-MM-DD string', () => {
    expect(todayLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
