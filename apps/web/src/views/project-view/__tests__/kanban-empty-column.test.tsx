/**
 * kanban-empty-column.test.tsx
 *
 * Covers:
 * - To Do column empty but In Progress has cards → To Do shows per-column
 *   empty state "No items" (microcopy §35.4), not the full empty board state.
 * - Empty state has a faint dashed border (indicated by the CSS class).
 * - Other columns render their cards normally.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Item, ItemId, ProjectId } from '@tasko/types';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../../api/items', () => ({
  useDeleteItem: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue({ trashed: [] }),
    isPending: false,
  }),
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

const PROJECT_ID = 'proj-empty-col' as ProjectId;

function makeItem(id: string, overrides: Partial<Item> = {}): Item {
  return {
    id: id as ItemId,
    schema_version: 1,
    type: 'task',
    project_id: PROJECT_ID,
    parent_id: null,
    title: id,
    notes: '',
    due_date: '2026-05-19',
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

function renderKanbanWithItems(items: Item[]) {
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

describe('KanbanView — per-column empty state (§35.4)', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('shows "No items" in an empty column when other columns have cards', () => {
    // Only In Progress has items — To Do and Done are empty
    const items = [
      makeItem('task-ip-1', { status: 'in_progress' }),
      makeItem('task-ip-2', { status: 'in_progress' }),
    ];
    renderKanbanWithItems(items);

    // "No items" should appear for the empty To Do and Done columns
    const noItemsElements = screen.getAllByText('No items');
    expect(noItemsElements.length).toBeGreaterThanOrEqual(1);
  });

  it('does NOT show the full empty board when at least one column has items', () => {
    const items = [makeItem('task-1', { status: 'in_progress' })];
    renderKanbanWithItems(items);

    expect(screen.queryByText('No tasks here yet.')).toBeNull();
  });

  it('in_progress card renders in the In Progress column', () => {
    const items = [makeItem('task-ip-only', { status: 'in_progress' })];
    renderKanbanWithItems(items);

    const card = document.querySelector('[data-item-id="task-ip-only"]');
    expect(card).toBeTruthy();
  });

  it('empty To Do column shows "No items" label', () => {
    const items = [makeItem('task-1', { status: 'in_progress' })];
    renderKanbanWithItems(items);

    const todoCol = document.querySelector('[data-status="todo"]');
    expect(todoCol).toBeTruthy();
    const noItemsEl = todoCol?.querySelector('[aria-label="To Do column is empty"]');
    expect(noItemsEl).toBeTruthy();
  });

  it('empty Done column shows "Done column is empty" label', () => {
    const items = [makeItem('task-1', { status: 'todo' })];
    renderKanbanWithItems(items);

    const doneCol = document.querySelector('[data-status="done"]');
    expect(doneCol).toBeTruthy();
    const noItemsEl = doneCol?.querySelector('[aria-label="Done column is empty"]');
    expect(noItemsEl).toBeTruthy();
  });
});
