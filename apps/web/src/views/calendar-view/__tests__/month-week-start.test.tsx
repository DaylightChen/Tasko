/**
 * month-week-start.test.tsx
 *
 * Covers:
 * - week_start: 'sun' → first column header is "Sun".
 * - week_start: 'mon' → first column header is "Mon".
 * - Grid start date for Sun and Mon configurations.
 *
 * Fix applied:
 * 1. useConfigMock declared with vi.hoisted() so it is available when the
 *    vi.mock() factory runs (vi.mock factories are hoisted before variable
 *    declarations).
 * 2. useItems mock seeds at least 1 item so the calendar grid renders
 *    (not the empty state). Without items, the grid (and weekday headers)
 *    are not rendered.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Item, ItemId, LocalDate } from '@tasko/types';
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../../api/items', () => ({
  useItems: vi.fn(),
  useDeleteItem: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useToggleComplete: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useUpdateItem: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useCreateItem: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

// FIX: useConfigMock must be declared with vi.hoisted() so it is available when
// the vi.mock() factory runs (vi.mock factories are hoisted before variable declarations).
const { useConfigMock } = vi.hoisted(() => ({ useConfigMock: vi.fn() }));

vi.mock('../../../api/config', () => ({
  useConfig: useConfigMock,
}));

vi.mock('../../../api/projects', () => ({
  useProjects: vi.fn(() => ({ data: { projects: [] } })),
}));

vi.mock('../../../api/tags', () => ({
  useTags: vi.fn(() => ({ data: { tags: [] } })),
}));

vi.mock('../../../store/task-modal', () => ({
  useTaskModalStore: vi.fn(() => ({
    openEdit: vi.fn(),
    openNew: vi.fn(),
  })),
}));

vi.mock('../../../lib/a11y', () => ({
  announce: vi.fn(),
}));

vi.mock('../../../lib/date-fmt', () => ({
  todayLocal: vi.fn(() => '2026-05-19' as LocalDate),
  daysBetween: vi.fn((start: string, end: string) => {
    const s = new Date(`${start}T00:00:00Z`);
    const e = new Date(`${end}T00:00:00Z`);
    return Math.round((e.getTime() - s.getTime()) / 86_400_000);
  }),
  isOverdue: vi.fn((date: string, today: string) => date < today),
  formatDateChip: vi.fn(() => ({ short: 'May 19', long: 'May 19, 2026', overdueDays: 0 })),
  formatDateLong: vi.fn((date: string) => date),
  formatRelativeForGroup: vi.fn((date: string) => date),
  formatTimeChip: vi.fn((t: string) => t),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string; [k: string]: unknown }) => (
    <a href={to as string} {...rest}>
      {children}
    </a>
  ),
  useRouterState: () => ({ location: { pathname: '/calendar/month' } }),
}));

// ── Imports after mocks ──────────────────────────────────────────────────────
import { useItems } from '../../../api/items';
import { CalendarMonthView } from '../month';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: crypto.randomUUID() as ItemId,
    schema_version: 1,
    type: 'task',
    project_id: 'proj-1' as Item['project_id'],
    parent_id: null,
    title: 'Test Task',
    notes: '',
    due_date: '2026-05-19' as LocalDate,
    start_date: null,
    due_time: null,
    priority: 'none',
    status: 'todo',
    tags: [],
    subtasks: [],
    recurrence: null,
    completed_at: null,
    trashed_at: null,
    trashed_with: null,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function renderCalendar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CalendarMonthView />
    </QueryClientProvider>,
  );
}

/** Returns an array of the column header text content in order. */
function getWeekdayHeaders(): string[] {
  return Array.from(document.querySelectorAll('[role="columnheader"]')).map(
    (el) => el.textContent?.trim() ?? '',
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CalendarMonthView — week_start', () => {
  beforeEach(() => {
    // Seed at least 1 item so the calendar grid renders (not the empty state).
    // Without items, the grid and weekday headers are not rendered.
    vi.mocked(useItems).mockReturnValue({
      data: { items: [makeItem({ due_date: '2026-05-19' as LocalDate })], count: 1 },
      isLoading: false,
    } as unknown as ReturnType<typeof useItems>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('week_start: sun → first column header is "Sun"', () => {
    useConfigMock.mockReturnValue({
      data: { week_start: 'sun', theme: 'system', schema_version: 1, last_modified: '2026-01-01T00:00:00Z' },
    });

    renderCalendar();

    const headers = getWeekdayHeaders();
    expect(headers.length).toBe(7);
    expect(headers[0]).toBe('Sun');
    expect(headers[6]).toBe('Sat');
  });

  it('week_start: mon → first column header is "Mon"', () => {
    useConfigMock.mockReturnValue({
      data: { week_start: 'mon', theme: 'system', schema_version: 1, last_modified: '2026-01-01T00:00:00Z' },
    });

    renderCalendar();

    const headers = getWeekdayHeaders();
    expect(headers.length).toBe(7);
    expect(headers[0]).toBe('Mon');
    expect(headers[6]).toBe('Sun');
  });

  it('week_start: sun → May 2026 grid starts on Sunday April 26', () => {
    useConfigMock.mockReturnValue({
      data: { week_start: 'sun', theme: 'system', schema_version: 1, last_modified: '2026-01-01T00:00:00Z' },
    });

    renderCalendar();

    // May 1, 2026 is a Friday; with sun-start, the grid starts from Sunday April 26
    expect(document.querySelector('[data-date="2026-04-26"]')).toBeTruthy();
  });

  it('week_start: mon → May 2026 grid starts on Monday April 27', () => {
    useConfigMock.mockReturnValue({
      data: { week_start: 'mon', theme: 'system', schema_version: 1, last_modified: '2026-01-01T00:00:00Z' },
    });

    renderCalendar();

    // May 1, 2026 is a Friday; with mon-start, the first week contains Mon Apr 27 – Sun May 3
    expect(document.querySelector('[data-date="2026-04-27"]')).toBeTruthy();
  });
});
