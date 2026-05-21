/**
 * kanban-empty-board.test.tsx
 *
 * Covers:
 * - When ALL columns are empty (no Tasks in project), the full-view empty state
 *   renders with "No tasks here yet." headline (microcopy §25).
 * - Subline "Drag from another project or add one." is shown.
 * - No KanbanColumn bodies are rendered when completely empty.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Item, ItemId, ProjectId } from '@tasko/types';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../../api/items', () => ({
  useDeleteItem: () => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue({ trashed: [] }), isPending: false }),
  usePatchSubtask: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  useItems: vi.fn(() => ({ data: { items: [], count: 0 }, isLoading: false })),
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

const PROJECT_ID = 'proj-empty' as ProjectId;

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

function renderKanban() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <KanbanView projectId={PROJECT_ID} />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('KanbanView — empty board state (microcopy §25)', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('shows "No tasks here yet." when all columns are empty', () => {
    renderKanban();
    expect(screen.getByText('No tasks here yet.')).toBeTruthy();
  });

  it('shows subline "Drag from another project or add one." when empty', () => {
    renderKanban();
    expect(screen.getByText('Drag from another project or add one.')).toBeTruthy();
  });

  it('does NOT render the kanban board section when empty', () => {
    renderKanban();
    // No "Kanban board" region when showing empty state
    const board = screen.queryByRole('region', { name: 'Kanban board' });
    expect(board).toBeNull();
  });

  it('shows empty state for project with only non-task types (epics/features/subtasks)', () => {
    vi.mocked(useItems).mockReturnValue({
      data: {
        items: [
          {
            id: 'epic-1',
            type: 'epic',
            project_id: PROJECT_ID,
            status: 'todo',
            title: 'Epic 1',
            sort_order: 0,
            due_date: '2026-05-19',
            start_date: null,
            due_time: null,
            priority: 'none',
            tags: [],
            subtasks: [],
            recurrence: null,
            completed_at: null,
            trashed_at: null,
            trashed_with: null,
            notes: '',
            parent_id: null,
            schema_version: 1,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ],
        count: 1,
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useItems>);

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <KanbanView projectId={PROJECT_ID} />
      </QueryClientProvider>,
    );

    expect(screen.getByText('No tasks here yet.')).toBeTruthy();
  });
});

// ── Folded from kanban-wired-hooks.test.tsx ──────────────────────────────────

describe('KanbanView — useItems wired (folded from kanban-wired-hooks)', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('useItems is called with include_completed: true (Done column needs completed items)', () => {
    vi.mocked(useItems).mockReturnValue({
      data: { items: [], count: 0 },
      isLoading: false,
    } as unknown as ReturnType<typeof useItems>);
    renderKanban();

    expect(vi.mocked(useItems)).toHaveBeenCalledWith(
      expect.objectContaining({
        view: 'project',
        include_completed: true,
      }),
    );
  });

  it('empty board state when API returns only epic-type items (all filtered out)', () => {
    vi.mocked(useItems).mockReturnValue({
      data: {
        items: [makeItem('epic-only-1', { type: 'epic' }), makeItem('epic-only-2', { type: 'epic' })],
        count: 2,
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useItems>);
    renderKanban();

    expect(screen.getByText('No tasks here yet.')).toBeTruthy();
    expect(screen.getByText('Drag from another project or add one.')).toBeTruthy();
  });

  it('empty board state when API returns only feature-type items (all filtered out)', () => {
    vi.mocked(useItems).mockReturnValue({
      data: { items: [makeItem('feature-only-1', { type: 'feature' })], count: 1 },
      isLoading: false,
    } as unknown as ReturnType<typeof useItems>);
    renderKanban();

    expect(screen.getByText('No tasks here yet.')).toBeTruthy();
  });
});
