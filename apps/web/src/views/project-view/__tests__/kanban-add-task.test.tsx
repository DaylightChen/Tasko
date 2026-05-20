/**
 * kanban-add-task.test.tsx
 *
 * Covers:
 * - Click + on the To Do column → taskModal.openNew called with
 *   { initialProjectId, initialStatus: 'todo' }.
 * - Click + on the In Progress column → taskModal.openNew called with
 *   { initialProjectId, initialStatus: 'in_progress' }.
 * - Click + on the Done column → taskModal.openNew called with
 *   { initialProjectId, initialStatus: 'done' }.
 * - Each column's + button has the correct aria-label.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Item, ItemId, ProjectId } from '@tasko/types';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const openNewMock = vi.fn();

vi.mock('../../../api/items', () => ({
  useItems: vi.fn(),
  usePatchItem: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useToggleComplete: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

vi.mock('../../../store/task-modal', () => ({
  useTaskModalStore: vi.fn(() => ({ openEdit: vi.fn(), openNew: openNewMock })),
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

const PROJECT_ID = 'proj-addtask' as ProjectId;

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
  vi.mocked(useItems).mockReturnValue({
    data: { items: [makeItem('t1')], count: 1 },
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

describe('KanbanView — + add task per column', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    openNewMock.mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it('each column has an + add button', () => {
    renderKanban();

    const addButtons = screen.getAllByRole('button', { name: /Add task to/i });
    expect(addButtons.length).toBe(3);
  });

  it('+ on To Do column opens modal with status=todo and projectId pre-filled', () => {
    renderKanban();

    const addTodoBtn = screen.getByRole('button', { name: 'Add task to To Do' });
    act(() => {
      fireEvent.click(addTodoBtn);
    });

    expect(openNewMock).toHaveBeenCalledWith(
      expect.objectContaining({
        initialStatus: 'todo',
        initialProjectId: PROJECT_ID,
      }),
    );
  });

  it('+ on In Progress column opens modal with status=in_progress and projectId pre-filled', () => {
    renderKanban();

    const addInProgBtn = screen.getByRole('button', { name: 'Add task to In Progress' });
    act(() => {
      fireEvent.click(addInProgBtn);
    });

    expect(openNewMock).toHaveBeenCalledWith(
      expect.objectContaining({
        initialStatus: 'in_progress',
        initialProjectId: PROJECT_ID,
      }),
    );
  });

  it('+ on Done column opens modal with status=done and projectId pre-filled', () => {
    renderKanban();

    const addDoneBtn = screen.getByRole('button', { name: 'Add task to Done' });
    act(() => {
      fireEvent.click(addDoneBtn);
    });

    expect(openNewMock).toHaveBeenCalledWith(
      expect.objectContaining({
        initialStatus: 'done',
        initialProjectId: PROJECT_ID,
      }),
    );
  });
});
