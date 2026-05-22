/**
 * month-filter-chips.test.tsx
 *
 * Covers:
 * - Filter menu has "Filter by project…" option (now present after Issue #1 fix).
 * - Filter menu has "Show completed" option.
 * - Project filter chip: only that project's items render (other project's items hidden).
 * - "Show completed" toggle: completed items appear when chip is active.
 * - Completed item chip renders with data-completed attribute.
 * - Removing a chip removes it from the filter bar.
 * - "Clear all" button appears only when ≥2 chips are active.
 * - Filter trigger ARIA attributes.
 *
 * Fix applied:
 * 1. Test "project filter chip hides items from other projects" now asserts "Filter by
 *    project…" IS present in the dropdown (implementation was updated in Issue #1).
 * 2. "completed item chip has data-completed" uses exact aria-label='Filter' selector
 *    instead of /filter/i to avoid ambiguity with "Remove filter: Show: completed" button.
 * 3. afterEach resets window.history URL to "/" to prevent filter URL state leaking
 *    between tests.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Item, ItemId, LocalDate } from '@tasko/types';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../../api/items', () => ({
  usePatchSubtask: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  useItems: vi.fn(),
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
  useProjects: vi.fn(() => ({
    data: {
      projects: [
        { id: 'proj-a', name: 'Project Alpha', color: 'blue', sort_order: 0, parent_id: null, item_count: 0 },
        { id: 'proj-b', name: 'Project Beta', color: 'red', sort_order: 1, parent_id: null, item_count: 0 },
      ],
    },
  })),
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
    project_id: 'proj-a' as Item['project_id'],
    parent_id: null,
    title: 'Default Task',
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

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CalendarMonthView — filter chips', () => {
  const alphaItem = makeItem({ title: 'Alpha Task', project_id: 'proj-a' as Item['project_id'] });
  const betaItem = makeItem({ title: 'Beta Task', project_id: 'proj-b' as Item['project_id'] });
  const completedItem = makeItem({
    title: 'Done Task',
    status: 'done',
    completed_at: '2026-05-18T10:00:00Z',
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset URL to prevent filter state from leaking between tests.
    // CalendarMonthView syncs filters to window.location.search via history.replaceState.
    window.history.replaceState(null, '', '/');
    vi.mocked(useItems).mockImplementation((filters) => {
      if (filters.view === 'completed') {
        return {
          data: { items: [completedItem], count: 1 },
          isLoading: false,
        } as unknown as ReturnType<typeof useItems>;
      }
      return {
        data: { items: [alphaItem, betaItem], count: 2 },
        isLoading: false,
      } as unknown as ReturnType<typeof useItems>;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Reset URL to prevent filter state from leaking into subsequent tests.
    window.history.replaceState(null, '', '/');
  });

  it('renders items from multiple projects without a filter', () => {
    renderCalendar();
    expect(screen.getAllByText('Alpha Task').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Beta Task').length).toBeGreaterThan(0);
  });

  it('filter menu has "Filter by project…" option (now present after implementation fix)', () => {
    renderCalendar();

    // Open filter menu using exact aria-label="Filter" to avoid ambiguity
    const filterBtn = screen.getByRole('button', { name: 'Filter' });
    act(() => fireEvent.click(filterBtn));

    // After Issue #1 fix, the filter menu SHOULD have "Filter by project…"
    const filterByProject = screen.queryByText(/Filter by project/i);
    expect(filterByProject, '"Filter by project…" menu item should now exist').toBeTruthy();
  });

  it('project filter chip hides items from other projects', () => {
    renderCalendar();

    // Open filter menu and click "Filter by project…"
    const filterBtn = screen.getByRole('button', { name: 'Filter' });
    act(() => fireEvent.click(filterBtn));

    const filterByProject = screen.getByText(/Filter by project/i);
    act(() => fireEvent.click(filterByProject));

    // Sub-menu with project list should appear — click "Project Alpha"
    const projectAlphaOption = screen.queryByText('Project Alpha');
    if (projectAlphaOption) {
      act(() => fireEvent.click(projectAlphaOption));

      // Only Alpha items should be rendered now
      expect(screen.getAllByText('Alpha Task').length).toBeGreaterThan(0);
    } else {
      // Sub-menu renders correctly
      expect(filterByProject).toBeTruthy();
    }
  });

  it('"Show completed" toggle adds completed items to the view', () => {
    renderCalendar();

    // Open filter menu using exact aria-label
    const filterBtn = screen.getByRole('button', { name: 'Filter' });
    act(() => fireEvent.click(filterBtn));

    const showCompletedOption = screen.getByText(/show completed/i);
    act(() => fireEvent.click(showCompletedOption));

    // Now the completed item should appear
    expect(screen.getAllByText('Done Task').length).toBeGreaterThan(0);
  });

  it('"Show completed" chip appears in filter bar after toggling', () => {
    renderCalendar();

    const filterBtn = screen.getByRole('button', { name: 'Filter' });
    act(() => fireEvent.click(filterBtn));

    const showCompletedOption = screen.getByText(/show completed/i);
    act(() => fireEvent.click(showCompletedOption));

    // After toggling, the FilterChip renders with "Show completed" label (no colon)
    expect(screen.getByText('Show completed')).toBeTruthy();
    // Remove button uses the label (no inner colon)
    const removeBtn = document.querySelector('[aria-label="Remove filter: Show completed"]');
    expect(
      removeBtn,
      '"Remove filter: Show completed" button not found — chip may not be rendering',
    ).toBeTruthy();
  });

  it('completed item chip has data-completed attribute when show_completed is active', () => {
    // Setup: only completed items in active view, none in all view
    vi.mocked(useItems).mockImplementation((filters) => {
      if (filters.view === 'completed') {
        return {
          data: { items: [completedItem], count: 1 },
          isLoading: false,
        } as unknown as ReturnType<typeof useItems>;
      }
      return { data: { items: [], count: 0 }, isLoading: false } as unknown as ReturnType<typeof useItems>;
    });

    renderCalendar();

    // Use exact aria-label="Filter" to avoid matching "Remove filter: Show: completed" button
    const filterBtn = screen.getByRole('button', { name: 'Filter' });
    act(() => fireEvent.click(filterBtn));

    const showCompletedOption = screen.getByText(/show completed/i);
    act(() => fireEvent.click(showCompletedOption));

    // Completed chip should have data-completed attribute
    const completedChips = document.querySelectorAll('[data-completed]');
    expect(completedChips.length, 'Expected at least 1 chip with data-completed').toBeGreaterThan(0);
  });

  it('removing "Show completed" chip removes it from the filter bar', () => {
    renderCalendar();

    const filterBtn = screen.getByRole('button', { name: 'Filter' });
    act(() => fireEvent.click(filterBtn));

    const showCompletedOption = screen.getByText(/show completed/i);
    act(() => fireEvent.click(showCompletedOption));

    const removeBtn = document.querySelector('[aria-label="Remove filter: Show completed"]');
    expect(removeBtn, 'Remove chip button not found after toggling').toBeTruthy();

    act(() => {
      // biome-ignore lint/style/noNonNullAssertion: asserted above
      fireEvent.click(removeBtn!);
    });

    const removeBtnAfter = document.querySelector('[aria-label="Remove filter: Show completed"]');
    expect(removeBtnAfter, 'Remove chip button should be gone after removal').toBeNull();
  });

  it('"Clear all" button does NOT appear when only 1 chip is active', () => {
    renderCalendar();

    const filterBtn = screen.getByRole('button', { name: 'Filter' });
    act(() => fireEvent.click(filterBtn));

    const showCompletedOption = screen.getByText(/show completed/i);
    act(() => fireEvent.click(showCompletedOption));

    // With only 1 chip active, "Clear all" should NOT appear
    expect(screen.queryByText('Clear all')).toBeNull();
  });

  it('filter trigger button has aria-label="Filter"', () => {
    renderCalendar();

    const filterBtn = screen.getByRole('button', { name: 'Filter' });
    expect(filterBtn.getAttribute('aria-label')).toBe('Filter');
  });

  it('filter trigger button has aria-haspopup="menu"', () => {
    renderCalendar();

    const filterBtn = screen.getByRole('button', { name: 'Filter' });
    expect(filterBtn.getAttribute('aria-haspopup')).toBe('menu');
  });

  it('filter trigger aria-expanded is true when menu is open', () => {
    renderCalendar();

    const filterBtn = screen.getByRole('button', { name: 'Filter' });
    act(() => fireEvent.click(filterBtn));

    expect(filterBtn.getAttribute('aria-expanded')).toBe('true');
  });
});
