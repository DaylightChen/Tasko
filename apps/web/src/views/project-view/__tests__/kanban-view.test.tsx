/**
 * kanban-view.test.tsx
 *
 * Covers:
 * - Hierarchical project with 1 Epic, 2 Features, 6 Tasks (3 To Do, 2 In Progress, 1 Done),
 *   2 Subtasks. Only the 6 Tasks render as cards (Epics, Features, Subtasks excluded per §9.4 #1).
 * - Column counts correct.
 * - "To Do", "In Progress", "Done" column headers are rendered.
 * - The board section has an aria-label "Kanban board".
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Item, ItemId, ProjectId } from '@tasko/types';
import { render, screen } from '@testing-library/react';
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
  useTaskModalStore: vi.fn(() => ({
    openEdit: vi.fn(),
    openNew: vi.fn(),
  })),
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
    remove: vi.fn(),
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

const PROJECT_ID = 'proj-kanban' as ProjectId;

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

function setupMocks(items: Item[]) {
  vi.mocked(useItems).mockReturnValue({
    data: { items, count: items.length },
    isLoading: false,
  } as unknown as ReturnType<typeof useItems>);
}

function renderKanban(projectId = PROJECT_ID) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <KanbanView projectId={projectId} />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('KanbanView — type filtering (§9.4 #1)', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('renders only task-type items (excludes epics and features)', () => {
    const items = [
      makeItem('epic-1', { type: 'epic' }),
      makeItem('feature-1', { type: 'feature' }),
      makeItem('feature-2', { type: 'feature' }),
      makeItem('task-todo-1', { type: 'task', status: 'todo' }),
      makeItem('task-todo-2', { type: 'task', status: 'todo' }),
      makeItem('task-todo-3', { type: 'task', status: 'todo' }),
      makeItem('task-inprog-1', { type: 'task', status: 'in_progress' }),
      makeItem('task-inprog-2', { type: 'task', status: 'in_progress' }),
      makeItem('task-done-1', { type: 'task', status: 'done', completed_at: '2026-05-18T10:00:00Z' }),
    ];
    setupMocks(items);
    renderKanban();

    // Only the 6 tasks should be visible as cards
    expect(document.querySelector('[data-item-id="epic-1"]')).toBeNull();
    expect(document.querySelector('[data-item-id="feature-1"]')).toBeNull();
    expect(document.querySelector('[data-item-id="feature-2"]')).toBeNull();

    expect(document.querySelector('[data-item-id="task-todo-1"]')).toBeTruthy();
    expect(document.querySelector('[data-item-id="task-inprog-1"]')).toBeTruthy();
    expect(document.querySelector('[data-item-id="task-done-1"]')).toBeTruthy();
  });

  it('column count badges show correct per-column counts', () => {
    const items = [
      makeItem('t1', { type: 'task', status: 'todo' }),
      makeItem('t2', { type: 'task', status: 'todo' }),
      makeItem('t3', { type: 'task', status: 'todo' }),
      makeItem('t4', { type: 'task', status: 'in_progress' }),
      makeItem('t5', { type: 'task', status: 'in_progress' }),
      makeItem('t6', { type: 'task', status: 'done', completed_at: '2026-05-01T00:00:00Z' }),
    ];
    setupMocks(items);
    renderKanban();

    // Column headers should show (3), (2), (1)
    expect(screen.getByLabelText('3 items')).toBeTruthy();
    expect(screen.getByLabelText('2 items')).toBeTruthy();
    expect(screen.getByLabelText('1 items')).toBeTruthy();
  });
});

describe('KanbanView — column structure', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('renders "To Do", "In Progress", "Done" column headers', () => {
    setupMocks([makeItem('t1', { type: 'task', status: 'todo' })]);
    renderKanban();

    expect(screen.getByText('To Do')).toBeTruthy();
    expect(screen.getByText('In Progress')).toBeTruthy();
    expect(screen.getByText('Done')).toBeTruthy();
  });

  it('Kanban board section has aria-label "Kanban board"', () => {
    setupMocks([makeItem('t1', { type: 'task', status: 'todo' })]);
    renderKanban();

    const board = screen.getByRole('region', { name: 'Kanban board' });
    expect(board).toBeTruthy();
  });
});
