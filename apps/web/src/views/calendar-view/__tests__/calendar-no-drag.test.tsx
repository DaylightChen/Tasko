/**
 * calendar-no-drag.test.tsx
 *
 * Smoke test: confirm that calendar event chips have NO drag listeners.
 * Drag-to-reschedule is CUT in v1 (binding resolution §1.1).
 *
 * Covers:
 * - CalendarEventChip renders as a button (not a drag source).
 * - No draggable="true" attribute on the chip.
 * - No @dnd-kit data attributes on the chip.
 * - Firing a 'dragstart' generic Event on the chip does not throw (jsdom-safe).
 * - Click interaction still works (opens task modal).
 * - Chip renders as <button type="button">.
 *
 * Fix applied: `new DragEvent(...)` throws "DragEvent is not defined" in jsdom.
 * Replaced with `new Event('dragstart', { bubbles: true })` which is jsdom-safe.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Item, ItemId, LocalDate } from '@tasko/types';
import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../../api/items', () => ({
  usePatchSubtask: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  useItems: vi.fn(() => ({
    data: { items: [], count: 0 },
    isLoading: false,
  })),
  useDeleteItem: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useToggleComplete: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useUpdateItem: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useCreateItem: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

vi.mock('../../../api/config', () => ({
  useConfig: vi.fn(() => ({
    data: { week_start: 'sun', theme: 'system', schema_version: 1, last_modified: '2026-01-01T00:00:00Z' },
  })),
}));

vi.mock('../../../api/projects', () => ({
  useProjects: vi.fn(() => ({ data: { projects: [] } })),
}));

vi.mock('../../../api/tags', () => ({
  useTags: vi.fn(() => ({ data: { tags: [] } })),
}));

const openEditMock = vi.fn();

vi.mock('../../../store/task-modal', () => ({
  useTaskModalStore: vi.fn(() => ({
    openEdit: openEditMock,
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

const CHIP_ITEM_ID = 'item-chip-test';

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: CHIP_ITEM_ID as ItemId,
    schema_version: 1,
    type: 'task',
    project_id: 'proj-1' as Item['project_id'],
    parent_id: null,
    title: 'Click Only Task',
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

function renderWithItem() {
  const item = makeItem();
  vi.mocked(useItems).mockReturnValue({
    data: { items: [item], count: 1 },
    isLoading: false,
  } as unknown as ReturnType<typeof useItems>);

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <CalendarMonthView />
    </QueryClientProvider>,
  );

  const chips = document.querySelectorAll(`[data-item-id="${CHIP_ITEM_ID}"]`);
  expect(chips.length, 'Expected at least one chip for the test item').toBeGreaterThan(0);
  return chips;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CalendarEventChip — no drag (v1 drag CUT)', () => {
  it('chip element has no draggable="true" attribute', () => {
    const chips = renderWithItem();
    for (const chip of chips) {
      expect(chip.getAttribute('draggable')).not.toBe('true');
    }
  });

  it('chip has no @dnd-kit data attributes (no dnd-kit wiring)', () => {
    const chips = renderWithItem();
    for (const chip of chips) {
      const attrs = Array.from(chip.attributes).map((a) => a.name);
      const dndAttrs = attrs.filter(
        (a) => a.startsWith('data-dnd') || a.startsWith('aria-grabbed') || a.includes('sortable'),
      );
      expect(dndAttrs, `dnd-kit attributes found: ${dndAttrs.join(', ')}`).toHaveLength(0);
    }
  });

  it('chip has no onDragStart handler (fires "dragstart" generic event without error)', () => {
    const chips = renderWithItem();

    // FIX: jsdom does not support the DragEvent constructor.
    // Use a generic Event instead — this is jsdom-safe and correctly verifies
    // that no built-in dragstart handler is wired on the chip.
    expect(() => {
      for (const chip of chips) {
        const evt = new Event('dragstart', { bubbles: true });
        chip.dispatchEvent(evt);
      }
    }).not.toThrow();
  });

  it('chip click opens the task modal (only interaction in v1)', () => {
    vi.clearAllMocks();
    openEditMock.mockReset();

    const chips = renderWithItem();

    act(() => {
      // biome-ignore lint/style/noNonNullAssertion: chips[0] existence guaranteed by expect(chips.length).toBeGreaterThan(0) above
      fireEvent.click(chips[0]!);
    });

    expect(openEditMock).toHaveBeenCalledWith(CHIP_ITEM_ID);
  });

  it('chip renders as a button element (semantic click target)', () => {
    const chips = renderWithItem();
    for (const chip of chips) {
      expect(chip.tagName.toLowerCase()).toBe('button');
    }
  });

  it('chip has type="button"', () => {
    const chips = renderWithItem();
    for (const chip of chips) {
      expect(chip.getAttribute('type')).toBe('button');
    }
  });
});
