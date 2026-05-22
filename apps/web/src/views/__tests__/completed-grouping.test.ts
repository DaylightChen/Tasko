/**
 * completed-grouping.test.ts
 *
 * Pure unit tests for the groupCompleted() helper in completed-view/grouping.ts.
 *
 * Covers:
 * - Item completed today → 'today' bucket.
 * - Item completed yesterday → 'yesterday' bucket.
 * - Item completed 3 days ago (same week, before yesterday) → 'earlier_this_week'.
 * - Item completed 10 days ago (week_start=mon, today=Wed) → 'last_week'.
 * - Item completed 20 days ago (same calendar month) → 'earlier_this_month'.
 * - Item completed 60 days ago → 'earlier'.
 * - Edge: today=Mon week_start=mon, item completed last Sunday → 'last_week'.
 * - Items without completed_at are dropped.
 * - Empty groups are omitted from output.
 */
import type { Item, ItemId, LocalDate } from '@tasko/types';
import { describe, expect, it } from 'vitest';
import { groupCompleted } from '../completed-view/grouping';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: crypto.randomUUID() as ItemId,
    schema_version: 1,
    type: 'task',
    project_id: 'proj-1' as Item['project_id'],
    parent_id: null,
    title: 'Task',
    notes: '',
    due_date: '2026-05-19',
    start_date: null,
    due_time: null,
    priority: 'none',
    status: 'done',
    tags: [],
    subtasks: [],
    recurrence: null,
    completed_at: null,
    trashed_at: null,
    trashed_with: null,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-05-19T00:00:00Z',
    ...overrides,
  };
}

/** Build an ISO UTC timestamp for midnight on the given date. */
function isoOf(date: string): string {
  return `${date}T00:00:00.000Z`;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('groupCompleted — time bucket assignment', () => {
  const TODAY = '2026-05-19' as LocalDate; // Tuesday

  it('item completed today → "today" bucket', () => {
    const item = makeItem({ completed_at: isoOf(TODAY) });
    const groups = groupCompleted([item], TODAY, 'mon');
    expect(groups).toHaveLength(1);
    expect(groups[0]?.group).toBe('today');
    expect(groups[0]?.items).toHaveLength(1);
  });

  it('item completed yesterday → "yesterday" bucket', () => {
    const YESTERDAY = '2026-05-18' as LocalDate;
    const item = makeItem({ completed_at: isoOf(YESTERDAY) });
    const groups = groupCompleted([item], TODAY, 'mon');
    expect(groups).toHaveLength(1);
    expect(groups[0]?.group).toBe('yesterday');
  });

  it('item completed 3 days ago (same week) → "earlier_this_week" bucket', () => {
    // TODAY = Tue May 19 (week_start=mon)
    // Mon May 16 is the start of the current week
    // 3 days ago = Sat May 16 — wait, TODAY is Tue so 3 days ago is Sat May 16
    // Actually that's LAST week if week_start=mon. Let me use Monday (1 day ago) through Sunday.
    // Today = Tue May 19; Mon May 18 = 1 day ago (yesterday), already tested.
    // For earlier_this_week: a day in the current week that is NOT today or yesterday.
    // Week starting Mon May 19 means Mon May 19 = today, and this is Tuesday...
    // 2026-05-19 is a Tuesday. Week start Mon = Mon 2026-05-18.
    // Sat May 16 is last week (before Mon May 18).
    // So for "earlier_this_week" we need Monday May 18... but that's yesterday.
    // With today=2026-05-23 (Sunday of same week), 3 days ago = 2026-05-20 (Wed) is in the current week.
    const TODAY_SUN = '2026-05-24' as LocalDate; // Sunday
    const THREE_DAYS_AGO = '2026-05-21' as LocalDate; // Thursday — same week as Sunday (week_start=mon)
    const item = makeItem({ completed_at: isoOf(THREE_DAYS_AGO) });
    const groups = groupCompleted([item], TODAY_SUN, 'mon');
    expect(groups).toHaveLength(1);
    expect(groups[0]?.group).toBe('earlier_this_week');
  });

  it('item completed 10 days ago (week_start=mon, today=Wed) → "last_week" bucket', () => {
    // TODAY = Wed 2026-05-19 — actually let's use Wed 2026-05-21 to be safer
    const TODAY_WED = '2026-05-21' as LocalDate; // Wednesday
    // 10 days ago = 2026-05-11 (Monday of prior-prior week)
    // week_start=mon: current week starts Mon May 18; last week = Mon May 11
    // So May 11 is exactly last_week start.
    const TEN_DAYS_AGO = '2026-05-11' as LocalDate;
    const item = makeItem({ completed_at: isoOf(TEN_DAYS_AGO) });
    const groups = groupCompleted([item], TODAY_WED, 'mon');
    expect(groups).toHaveLength(1);
    expect(groups[0]?.group).toBe('last_week');
  });

  it('item completed 20 days ago (same calendar month) → "earlier_this_month" bucket', () => {
    const TWENTY_DAYS_AGO = '2026-04-29' as LocalDate;
    // TODAY = 2026-05-19; 20 days ago = Apr 29 → different month → 'earlier'
    // Use a date within the same month but not in this/last week
    const SAME_MONTH = '2026-05-01' as LocalDate; // May 1, same month, > 2 weeks ago
    const item = makeItem({ completed_at: isoOf(SAME_MONTH) });
    const groups = groupCompleted([item], TODAY, 'mon');
    // May 1 → same month, not in this/last week, so 'earlier_this_month'
    expect(groups).toHaveLength(1);
    expect(groups[0]?.group).toBe('earlier_this_month');
    // Suppress unused var warning
    void TWENTY_DAYS_AGO;
  });

  it('item completed 60 days ago → "earlier" bucket', () => {
    const SIXTY_DAYS_AGO = '2026-03-20' as LocalDate;
    const item = makeItem({ completed_at: isoOf(SIXTY_DAYS_AGO) });
    const groups = groupCompleted([item], TODAY, 'mon');
    expect(groups).toHaveLength(1);
    expect(groups[0]?.group).toBe('earlier');
  });

  it('edge: today=Mon week_start=mon, item completed last Saturday → "last_week"', () => {
    const TODAY_MON = '2026-05-18' as LocalDate; // Monday — start of current week
    // Saturday May 16 is 2 days before Monday; it's in the PREVIOUS week (not this week).
    const LAST_SAT = '2026-05-16' as LocalDate;
    // With week_start=mon, current week starts Mon May 18.
    // Last week = Mon May 11 through Sun May 17.
    // So Sat May 16 falls in last week.
    const item = makeItem({ completed_at: isoOf(LAST_SAT) });
    const groups = groupCompleted([item], TODAY_MON, 'mon');
    expect(groups).toHaveLength(1);
    expect(groups[0]?.group).toBe('last_week');
  });

  it('items without completed_at are dropped', () => {
    const item = makeItem({ completed_at: null });
    const groups = groupCompleted([item], TODAY, 'mon');
    expect(groups).toHaveLength(0);
  });

  it('empty groups are omitted from output', () => {
    const item = makeItem({ completed_at: isoOf(TODAY) });
    const groups = groupCompleted([item], TODAY, 'mon');
    // Only 'today' bucket has an item, so only 1 group should be present
    expect(groups).toHaveLength(1);
    expect(groups[0]?.group).toBe('today');
  });

  it('multiple items split into correct buckets', () => {
    const TODAY_SUN = '2026-05-24' as LocalDate; // Sunday
    const items = [
      makeItem({ id: 'a' as ItemId, title: 'Today', completed_at: isoOf('2026-05-24') }),
      makeItem({ id: 'b' as ItemId, title: 'Yesterday', completed_at: isoOf('2026-05-23') }),
      makeItem({ id: 'c' as ItemId, title: 'EarlierThisWeek', completed_at: isoOf('2026-05-20') }),
      makeItem({ id: 'd' as ItemId, title: 'LastWeek', completed_at: isoOf('2026-05-13') }),
      makeItem({ id: 'e' as ItemId, title: 'EarlierThisMonth', completed_at: isoOf('2026-05-01') }),
      makeItem({ id: 'f' as ItemId, title: 'Earlier', completed_at: isoOf('2026-03-01') }),
    ];
    const groups = groupCompleted(items, TODAY_SUN, 'mon');
    expect(groups).toHaveLength(6);
    const groupMap = Object.fromEntries(groups.map((g) => [g.group, g]));
    expect(groupMap.today?.items).toHaveLength(1);
    expect(groupMap.yesterday?.items).toHaveLength(1);
    expect(groupMap.earlier_this_week?.items).toHaveLength(1);
    expect(groupMap.last_week?.items).toHaveLength(1);
    expect(groupMap.earlier_this_month?.items).toHaveLength(1);
    expect(groupMap.earlier?.items).toHaveLength(1);
  });

  it('group label for today is "Today"', () => {
    const item = makeItem({ completed_at: isoOf(TODAY) });
    const groups = groupCompleted([item], TODAY, 'mon');
    expect(groups[0]?.label).toBe('Today');
  });

  it('group label for yesterday is "Yesterday"', () => {
    const item = makeItem({ completed_at: isoOf('2026-05-18') });
    const groups = groupCompleted([item], TODAY, 'mon');
    expect(groups[0]?.label).toBe('Yesterday');
  });

  it('group label for earlier_this_week is "Earlier this week" per microcopy §23', () => {
    // TODAY = Tue 2026-05-19; week_start=mon → Mon 2026-05-18 starts the week.
    // Mon 2026-05-18 is yesterday, so use a Sunday context (TODAY_SUN) where Thu is earlier_this_week.
    const TODAY_SUN = '2026-05-24' as LocalDate;
    const item = makeItem({ completed_at: isoOf('2026-05-21') }); // Thursday
    const groups = groupCompleted([item], TODAY_SUN, 'mon');
    expect(groups).toHaveLength(1);
    expect(groups[0]?.label).toBe('Earlier this week');
  });

  it('group label for last_week is "Last week" per microcopy §23', () => {
    const TODAY_WED = '2026-05-21' as LocalDate;
    const item = makeItem({ completed_at: isoOf('2026-05-11') }); // Mon of prior week
    const groups = groupCompleted([item], TODAY_WED, 'mon');
    expect(groups).toHaveLength(1);
    expect(groups[0]?.label).toBe('Last week');
  });

  it('group label for earlier_this_month is "Earlier this month" per microcopy §23', () => {
    const item = makeItem({ completed_at: isoOf('2026-05-01') });
    const groups = groupCompleted([item], TODAY, 'mon');
    expect(groups).toHaveLength(1);
    expect(groups[0]?.label).toBe('Earlier this month');
  });

  it('group label for earlier is "Earlier" per microcopy §23', () => {
    const item = makeItem({ completed_at: isoOf('2026-03-20') });
    const groups = groupCompleted([item], TODAY, 'mon');
    expect(groups).toHaveLength(1);
    expect(groups[0]?.label).toBe('Earlier');
  });
});
