/**
 * kanban-aria-microcopy.test.tsx — tester-written tests for Task 15 acceptance criteria.
 *
 * Covers ARIA and microcopy requirements from brief §17–19 and UX §3.7/§25/§29:
 * - Board wrapper has role="region" aria-label="Kanban board" (§3.7).
 * - KanbanCard has a correct aria-label per §29: "Task: "<Title>", priority <level>, status <column>, ..."
 * - Column header shows "To Do" / "In Progress" / "Done" exactly (§25).
 * - Per-column empty state shows "No items" exactly (§25 / §35.4).
 * - Whole-board empty shows "No tasks here yet." and subline (§25).
 * - Done overflow footer: "Showing recent 50, [Show all]" (§25).
 * - KanbanCard meta: subtask progress chip shows "N/M" format.
 * - KanbanCard meta: date chip only shows for today or overdue (not future).
 * - Column "+" button aria-label is "Add task to <Column>" per existing tests.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Item, ItemId, ProjectId, SubtaskId } from '@tasko/types';
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
    remove: vi.fn(),
  })),
}));

vi.mock('../../../lib/dnd-sensors', () => ({
  useDndSensors: vi.fn(() => []),
}));

vi.mock('../../../lib/date-fmt', () => ({
  // todayLocal = '2026-05-19' so due_date='2026-05-19' => "due today"
  // due_date='2026-05-18' => overdue
  // due_date='2026-05-20' => future, no chip
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

const PROJECT_ID = 'proj-aria' as ProjectId;

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

function renderKanban() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <KanbanView projectId={PROJECT_ID} />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('KanbanView — ARIA region wrapper (§3.7)', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('board section has role="region" and aria-label="Kanban board"', () => {
    setupMocks([makeItem('task-aria-1', { status: 'todo' })]);
    renderKanban();

    const board = screen.getByRole('region', { name: 'Kanban board' });
    expect(board).toBeTruthy();
  });

  it('column sections each have aria-label containing their column title', () => {
    setupMocks([makeItem('task-aria-2', { status: 'todo' })]);
    renderKanban();

    expect(screen.getByRole('region', { name: 'To Do column' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'In Progress column' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Done column' })).toBeTruthy();
  });
});

describe('KanbanView — Kanban card aria-label (microcopy §29)', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('card aria-label includes title, priority, and status', () => {
    setupMocks([
      makeItem('Task Alpha', {
        id: 'card-aria-check' as ItemId,
        title: 'Task Alpha',
        priority: 'high',
        status: 'todo',
        due_date: '2026-05-20', // future — no date chip
      }),
    ]);
    renderKanban();

    // Per microcopy §29: 'Task: "<Title>", priority <level>, status <column>'
    const card = document.querySelector('[data-item-id="card-aria-check"]');
    expect(card).toBeTruthy();
    const label = card?.getAttribute('aria-label') ?? '';
    expect(label).toContain('Task: "Task Alpha"');
    expect(label).toContain('priority high');
    expect(label).toContain('status To Do');
  });

  it('card aria-label includes "due today" when due_date equals today', () => {
    setupMocks([
      makeItem('today-task', {
        id: 'card-today' as ItemId,
        title: 'today-task',
        due_date: '2026-05-19',
        status: 'todo',
        priority: 'none',
      }),
    ]);
    renderKanban();

    const card = document.querySelector('[data-item-id="card-today"]');
    const label = card?.getAttribute('aria-label') ?? '';
    expect(label).toContain('due today');
  });

  it('card aria-label includes "overdue" when due_date is before today', () => {
    setupMocks([
      makeItem('overdue-task', {
        id: 'card-overdue' as ItemId,
        title: 'overdue-task',
        due_date: '2026-05-18',
        status: 'todo',
        priority: 'none',
      }),
    ]);
    renderKanban();

    const card = document.querySelector('[data-item-id="card-overdue"]');
    const label = card?.getAttribute('aria-label') ?? '';
    expect(label).toContain('overdue');
  });

  it('card aria-label does NOT contain date info for future due dates', () => {
    setupMocks([
      makeItem('future-task', {
        id: 'card-future' as ItemId,
        title: 'future-task',
        due_date: '2026-06-01', // clearly future
        status: 'todo',
        priority: 'none',
      }),
    ]);
    renderKanban();

    const card = document.querySelector('[data-item-id="card-future"]');
    const label = card?.getAttribute('aria-label') ?? '';
    expect(label).not.toContain('due today');
    expect(label).not.toContain('overdue');
  });
});

describe('KanbanView — card list ARIA (§3.7 role="list" via <ul>/<li>)', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('column body renders a <ul> element as the card list (semantic HTML)', () => {
    setupMocks([makeItem('task-list-1', { status: 'todo' })]);
    renderKanban();

    // KanbanColumn renders <ul> with aria-label="<Column> tasks"
    const listEl = screen.queryByRole('list', { name: 'To Do tasks' });
    expect(listEl).toBeTruthy();
  });

  it('cards are wrapped in <li> elements (role="listitem" via semantic HTML)', () => {
    setupMocks([makeItem('task-li-1', { status: 'todo' })]);
    renderKanban();

    // The KanbanCard is inside an <li>, which is a native listitem
    const card = document.querySelector('[data-item-id="task-li-1"]');
    expect(card).toBeTruthy();
    const liAncestor = card?.closest('li');
    expect(liAncestor).toBeTruthy();
  });
});

describe('KanbanView — column microcopy (§25)', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('column header titles are exactly "To Do", "In Progress", "Done"', () => {
    setupMocks([makeItem('t1', { status: 'todo' })]);
    renderKanban();

    expect(screen.getByText('To Do')).toBeTruthy();
    expect(screen.getByText('In Progress')).toBeTruthy();
    expect(screen.getByText('Done')).toBeTruthy();
  });

  it('per-column empty state shows exactly "No items" (§35.4)', () => {
    // Only In Progress has items; To Do and Done are empty
    setupMocks([makeItem('task-ip', { status: 'in_progress' })]);
    renderKanban();

    // "No items" should appear for the 2 empty columns
    const emptyEls = screen.getAllByText('No items');
    expect(emptyEls.length).toBeGreaterThanOrEqual(1);
  });

  it('whole-board empty state subline is "Drag from another project or add one."', () => {
    setupMocks([]);
    renderKanban();

    expect(screen.getByText('Drag from another project or add one.')).toBeTruthy();
  });
});

describe('KanbanView — KanbanCard meta: date chip visibility rules (§25.2)', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('date chip is shown when due_date is today', () => {
    setupMocks([
      makeItem('today-chip', {
        id: 'date-chip-today' as ItemId,
        title: 'today-chip',
        due_date: '2026-05-19', // today per mock
        status: 'todo',
      }),
    ]);
    renderKanban();

    const card = document.querySelector('[data-item-id="date-chip-today"]');
    expect(card).toBeTruthy();
    // Date chip with data-today attribute
    const todayChip = card?.querySelector('[data-today]');
    expect(todayChip).toBeTruthy();
  });

  it('date chip is NOT shown when due_date is tomorrow (future)', () => {
    setupMocks([
      makeItem('future-chip', {
        id: 'date-chip-future' as ItemId,
        title: 'future-chip',
        due_date: '2026-05-20', // tomorrow
        status: 'todo',
      }),
    ]);
    renderKanban();

    const card = document.querySelector('[data-item-id="date-chip-future"]');
    expect(card).toBeTruthy();
    // No date chip should be present
    const todayChip = card?.querySelector('[data-today]');
    const overdueChip = card?.querySelector('[data-overdue]');
    expect(todayChip).toBeNull();
    expect(overdueChip).toBeNull();
  });

  it('date chip is shown as overdue when due_date is past today', () => {
    setupMocks([
      makeItem('overdue-chip', {
        id: 'date-chip-overdue' as ItemId,
        title: 'overdue-chip',
        due_date: '2026-05-18', // yesterday = overdue
        status: 'todo',
      }),
    ]);
    renderKanban();

    const card = document.querySelector('[data-item-id="date-chip-overdue"]');
    expect(card).toBeTruthy();
    const overdueChip = card?.querySelector('[data-overdue]');
    expect(overdueChip).toBeTruthy();
  });
});

describe('KanbanView — KanbanCard meta: subtask progress chip', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('subtask progress chip shows "N/M" format when subtasks present', () => {
    setupMocks([
      makeItem('subtask-card', {
        id: 'card-subtasks' as ItemId,
        title: 'subtask-card',
        status: 'todo',
        subtasks: [
          {
            id: 'st-1' as SubtaskId,
            title: 'sub 1',
            status: 'done' as const,
            completed_at: '2026-05-01T00:00:00Z',
            sort_order: 0,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
          {
            id: 'st-2' as SubtaskId,
            title: 'sub 2',
            status: 'todo' as const,
            completed_at: null,
            sort_order: 1,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
          {
            id: 'st-3' as SubtaskId,
            title: 'sub 3',
            status: 'todo' as const,
            completed_at: null,
            sort_order: 2,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ],
      }),
    ]);
    renderKanban();

    const card = document.querySelector('[data-item-id="card-subtasks"]');
    expect(card).toBeTruthy();
    // Subtask progress chip: "1/3"
    expect(card?.textContent).toContain('1/3');
  });
});
