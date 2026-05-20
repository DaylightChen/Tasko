/**
 * kanban-mobile-touch.test.tsx
 *
 * Smoke test:
 * - Long-press (pointerdown + delay) on a card enters multi-select mode
 *   (mobile gesture from task-06 — multi-select store is updated).
 * - The KanbanView is desktop-primary; touch support is secondary (§1.3).
 * - Verifies that a card renders and can receive pointer events without throwing.
 *
 * Note: Long-press triggering multi-select is implemented in task-06's
 * useLongPress hook / gesture layer. Since the kanban card wraps KanbanCard
 * and SortableKanbanCard, we verify the pointer event infrastructure is
 * available and the multi-select store is wired in KanbanColumn.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Item, ItemId, ProjectId } from '@tasko/types';
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const addToMultiSelectMock = vi.fn();
const toggleMock = vi.fn();
const setAnchorMock = vi.fn();

vi.mock('../../../api/items', () => ({
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
    anchor: null,
    clear: vi.fn(),
    add: addToMultiSelectMock,
    toggle: toggleMock,
    remove: vi.fn(),
    setAnchor: setAnchorMock,
    selectRange: vi.fn(),
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
import { useMultiSelectStore } from '../../../store/multi-select';
import { KanbanView } from '../kanban-view';

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROJECT_ID = 'proj-mobile' as ProjectId;

function makeItem(id: string, overrides: Partial<Item> = {}): Item {
  return {
    id: id as ItemId,
    schema_version: 1,
    type: 'task',
    project_id: PROJECT_ID,
    parent_id: null,
    title: 'Mobile Task',
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

describe('KanbanView — mobile touch / multi-select smoke test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addToMultiSelectMock.mockReset();
    toggleMock.mockReset();
    setAnchorMock.mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it('card renders and can receive pointerdown event without throwing', () => {
    const items = [makeItem('task-touch-1')];
    renderKanban(items);

    const card = document.querySelector('[data-item-id="task-touch-1"]');
    expect(card).toBeTruthy();

    expect(() => {
      act(() => {
        // biome-ignore lint/style/noNonNullAssertion: asserted above
        fireEvent.pointerDown(card!);
      });
    }).not.toThrow();
  });

  it('card receives click event without throwing (tap-to-open)', () => {
    const items = [makeItem('task-tap')];
    renderKanban(items);

    const card = document.querySelector('[data-item-id="task-tap"]');
    expect(card).toBeTruthy();

    expect(() => {
      act(() => {
        // biome-ignore lint/style/noNonNullAssertion: asserted above
        fireEvent.click(card!);
      });
    }).not.toThrow();
  });

  it('multiselect store is wired into KanbanColumn (store.add is accessible)', () => {
    const items = [makeItem('task-multisel')];
    renderKanban(items);

    // The useMultiSelectStore was called — KanbanColumn subscribes to it
    expect(vi.mocked(useMultiSelectStore)).toHaveBeenCalled();
  });

  it('card renders with data-item-id for multi-select identification', () => {
    const items = [makeItem('task-id-check')];
    renderKanban(items);

    const card = document.querySelector('[data-item-id="task-id-check"]');
    expect(card?.getAttribute('data-item-id')).toBe('task-id-check');
  });

  it('⌘-click on a card triggers toggle on the multi-select store with that card id', () => {
    const items = [makeItem('task-cmd-click')];
    renderKanban(items);

    const card = document.querySelector('[data-item-id="task-cmd-click"]');
    expect(card).toBeTruthy();

    act(() => {
      // biome-ignore lint/style/noNonNullAssertion: asserted above
      fireEvent.click(card!, { metaKey: true });
    });

    expect(toggleMock).toHaveBeenCalledWith('task-cmd-click');
  });
});

// ── Folded from kanban-wired-hooks.test.tsx ──────────────────────────────────

describe('KanbanView — useMultiSelectStore wired (folded from kanban-wired-hooks)', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('useMultiSelectStore is called (column-scoped multi-select wired)', () => {
    renderKanban([makeItem('task-multisel-wired')]);

    expect(vi.mocked(useMultiSelectStore)).toHaveBeenCalled();
  });
});
