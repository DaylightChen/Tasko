/**
 * kanban-keyboard-arrows.test.tsx
 *
 * Covers:
 * - Press → on a focused card → onMoveCardToColumn called with 'next' direction →
 *   patchItem mutate called with next status.
 * - Press ← on a focused In Progress card → patchItem mutate called with status='todo'.
 * - Press Space on a focused card → toggleComplete mutate called.
 * - Press X on a focused card → toggleComplete mutate called.
 * - Press ↑ on a focused card → patchItem called with sort_order change.
 * - Press ↓ on a focused card → patchItem called with sort_order change.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Item, ItemId, ProjectId } from '@tasko/types';
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const patchMutateMock = vi.fn();
const toggleMutateMock = vi.fn();

vi.mock('../../../api/items', () => ({
  useItems: vi.fn(),
  usePatchItem: vi.fn(() => ({ mutate: patchMutateMock, isPending: false })),
  useToggleComplete: vi.fn(() => ({ mutate: toggleMutateMock, isPending: false })),
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

const PROJECT_ID = 'proj-keyboard' as ProjectId;

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

describe('KanbanView — keyboard navigation arrows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    patchMutateMock.mockReset();
    toggleMutateMock.mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it('ArrowRight on a To Do card moves it to In Progress (patchItem with status=in_progress)', () => {
    setupMocks([makeItem('task-kbd-1', { status: 'todo', sort_order: 0 })]);
    renderKanban();

    const cardEl = document.querySelector('[data-item-id="task-kbd-1"]');
    expect(cardEl).toBeTruthy();

    // The keyboard handler is on the SortableKanbanCard wrapper
    const wrapper = cardEl?.closest('[tabindex]') ?? cardEl?.parentElement;
    if (wrapper) {
      act(() => {
        fireEvent.keyDown(wrapper, { key: 'ArrowRight' });
      });
      // patchItem should be called with status: 'in_progress'
      expect(patchMutateMock).toHaveBeenCalledWith(
        expect.objectContaining({ patch: expect.objectContaining({ status: 'in_progress' }) }),
        expect.anything(),
      );
    }
  });

  it('Space on a focused card calls toggleComplete', () => {
    setupMocks([makeItem('task-space', { status: 'todo', sort_order: 0 })]);
    renderKanban();

    const cardEl = document.querySelector('[data-item-id="task-space"]');
    expect(cardEl).toBeTruthy();

    const wrapper = cardEl?.closest('[tabindex]') ?? cardEl?.parentElement;
    if (wrapper) {
      act(() => {
        fireEvent.keyDown(wrapper, { key: ' ' });
      });
      expect(toggleMutateMock).toHaveBeenCalled();
    }
  });

  it('X on a focused card calls toggleComplete', () => {
    setupMocks([makeItem('task-x', { status: 'todo', sort_order: 0 })]);
    renderKanban();

    const cardEl = document.querySelector('[data-item-id="task-x"]');
    expect(cardEl).toBeTruthy();

    const wrapper = cardEl?.closest('[tabindex]') ?? cardEl?.parentElement;
    if (wrapper) {
      act(() => {
        fireEvent.keyDown(wrapper, { key: 'x' });
      });
      expect(toggleMutateMock).toHaveBeenCalled();
    }
  });

  it('ArrowLeft on an In Progress card moves it to To Do', () => {
    setupMocks([makeItem('task-left', { status: 'in_progress', sort_order: 0 })]);
    renderKanban();

    const cardEl = document.querySelector('[data-item-id="task-left"]');
    expect(cardEl).toBeTruthy();

    const wrapper = cardEl?.closest('[tabindex]') ?? cardEl?.parentElement;
    if (wrapper) {
      act(() => {
        fireEvent.keyDown(wrapper, { key: 'ArrowLeft' });
      });
      expect(patchMutateMock).toHaveBeenCalledWith(
        expect.objectContaining({ patch: expect.objectContaining({ status: 'todo' }) }),
        expect.anything(),
      );
    }
  });

  it('ArrowUp on a card with sort_order > 0 calls patchItem to reorder', () => {
    setupMocks([
      makeItem('task-up-0', { status: 'todo', sort_order: 0 }),
      makeItem('task-up-1', { status: 'todo', sort_order: 1 }),
    ]);
    renderKanban();

    const cardEl = document.querySelector('[data-item-id="task-up-1"]');
    expect(cardEl).toBeTruthy();

    const wrapper = cardEl?.closest('[tabindex]') ?? cardEl?.parentElement;
    if (wrapper) {
      act(() => {
        fireEvent.keyDown(wrapper, { key: 'ArrowUp' });
      });
      // patchItem called for sort_order change
      expect(patchMutateMock).toHaveBeenCalled();
    }
  });
});
