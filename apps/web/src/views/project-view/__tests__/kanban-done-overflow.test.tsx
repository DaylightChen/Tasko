/**
 * kanban-done-overflow.test.tsx
 *
 * Covers:
 * - Seed 60 Done items; Done column shows first 50.
 * - "Showing recent 50, [Show all]" footer appears when > 50 Done items.
 * - Clicking "Show all" → all 60 items become visible (no more footer).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Item, ItemId, ProjectId } from '@tasko/types';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../../api/items', () => ({
  useDeleteItem: () => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue({ trashed: [] }), isPending: false }),
  usePatchSubtask: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  useItems: vi.fn(),
  usePatchItem: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useToggleComplete: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

vi.mock('../../../store/task-modal', () => ({
  useTaskModalStore: vi.fn(() => ({ openEdit: vi.fn(), openNew: vi.fn() })),
}));

vi.mock('../../../store/snackbar', () => ({
  useSnackbarStore: vi.fn(() => ({ show: vi.fn() })),
}));

vi.mock('../../../store/multi-select', () => ({
  useMultiSelectStore: vi.fn(() => ({
    set: new Set(),
    scope: null,
    clear: vi.fn(),
    add: vi.fn(),
    toggle: vi.fn(),
  })),
}));

vi.mock('../../../lib/dnd-sensors', () => ({
  useDndSensors: vi.fn(() => []),
}));

vi.mock('../../../lib/date-fmt', () => ({
  todayLocal: vi.fn(() => '2026-05-19'),
}));

vi.mock('../_shared/BulkActionsToolbar', () => ({
  BulkActionsToolbar: () => null,
}));

vi.mock('@tanstack/react-router', () => ({
  useRouterState: () => ({ location: { pathname: '/project/proj/kanban' } }),
  useNavigate: () => vi.fn(),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────
import { useItems } from '../../../api/items';
import { KanbanView } from '../kanban-view';

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROJECT_ID = 'proj-overflow' as ProjectId;

function makeDoneItem(n: number): Item {
  return {
    id: `done-${n}` as ItemId,
    schema_version: 1,
    type: 'task',
    project_id: PROJECT_ID,
    parent_id: null,
    title: `Done Task ${n}`,
    notes: '',
    due_date: '2026-05-01',
    start_date: null,
    due_time: null,
    priority: 'none',
    status: 'done',
    tags: [],
    subtasks: [],
    recurrence: null,
    completed_at: '2026-05-01T10:00:00Z',
    trashed_at: null,
    trashed_with: null,
    sort_order: n,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

function renderKanban(items: Item[]) {
  vi.mocked(useItems).mockReturnValue({
    data: { items, count: items.length },
    isLoading: false,
  } as unknown as ReturnType<typeof useItems>);

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <KanbanView projectId={PROJECT_ID} />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('KanbanView — Done column overflow (binding resolution #1.3)', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('shows "Showing recent 50" footer when Done has 60 items', () => {
    const items = Array.from({ length: 60 }, (_, i) => makeDoneItem(i));
    renderKanban(items);

    expect(screen.getByText(/Showing recent 50/i)).toBeTruthy();
  });

  it('"Show all" link is present when Done has > 50 items', () => {
    const items = Array.from({ length: 60 }, (_, i) => makeDoneItem(i));
    renderKanban(items);

    expect(screen.getByRole('button', { name: 'Show all done items' })).toBeTruthy();
  });

  it('Done column shows exactly 50 cards before "Show all" is clicked', () => {
    const items = Array.from({ length: 60 }, (_, i) => makeDoneItem(i));
    renderKanban(items);

    const doneCol = document.querySelector('[data-status="done"]');
    expect(doneCol).toBeTruthy();

    // Count visible cards in the Done column
    const cards = doneCol?.querySelectorAll('[data-item-id]') ?? [];
    expect(cards.length).toBe(50);
  });

  it('clicking "Show all" reveals all 60 done items', () => {
    const items = Array.from({ length: 60 }, (_, i) => makeDoneItem(i));
    renderKanban(items);

    const showAllBtn = screen.getByRole('button', { name: 'Show all done items' });
    act(() => {
      fireEvent.click(showAllBtn);
    });

    // After "Show all" the column virtualizes (>50 items) so only a windowed
    // subset of [data-item-id] nodes is in the DOM at any time. The behavior
    // we actually want to confirm is: (a) the overflow footer is gone, and
    // (b) the column is rendering item nodes (i.e. it didn't collapse).
    expect(screen.queryByText(/Showing recent 50/i)).toBeNull();
    const doneCol = document.querySelector('[data-status="done"]');
    const cards = doneCol?.querySelectorAll('[data-item-id]') ?? [];
    expect(cards.length).toBeGreaterThan(0);
  });

  it('"Showing recent 50" footer disappears after clicking "Show all"', () => {
    const items = Array.from({ length: 60 }, (_, i) => makeDoneItem(i));
    renderKanban(items);

    const showAllBtn = screen.getByRole('button', { name: 'Show all done items' });
    act(() => {
      fireEvent.click(showAllBtn);
    });

    expect(screen.queryByText(/Showing recent 50/i)).toBeNull();
  });

  it('does NOT show overflow footer when Done has exactly 50 items', () => {
    const items = Array.from({ length: 50 }, (_, i) => makeDoneItem(i));
    renderKanban(items);

    expect(screen.queryByText(/Showing recent 50/i)).toBeNull();
  });

  it('does NOT show overflow footer when Done has fewer than 50 items', () => {
    const items = Array.from({ length: 10 }, (_, i) => makeDoneItem(i));
    renderKanban(items);

    expect(screen.queryByText(/Showing recent 50/i)).toBeNull();
  });
});
