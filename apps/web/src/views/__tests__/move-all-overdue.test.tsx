/**
 * move-all-overdue.test.tsx
 *
 * Covers:
 * - 3 overdue items → click "Move all overdue to today" button → confirmation opens.
 * - Confirmation title: "Move <N> overdue items to today?" (microcopy §6.6).
 * - Confirmation body: "Their due dates will be set to today."
 * - Confirm → bulkMoveOverdue.mutate() is called.
 * - Undo: within 5s, undo action in snackbar can be invoked.
 *
 * Strategy: follow the same pattern as today-complete-undo.test.tsx —
 * mock all hooks, render TodayView, interact with the confirmation.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Item, ItemId, LocalDate } from '@tasko/types';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock('../../api/items', () => ({
  usePatchSubtask: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  useItems: vi.fn(),
  useToggleComplete: vi.fn(),
  useReschedule: vi.fn(),
  useChangePriority: vi.fn(),
  useEditTitleInline: vi.fn(),
  useDeleteItem: vi.fn(),
  useBulkMoveOverdue: vi.fn(),
  usePatchItem: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn() })),
}));

vi.mock('../../api/projects', () => ({ useProjects: vi.fn() }));
vi.mock('../../api/folders', () => ({ useFolders: vi.fn() }));
vi.mock('../../api/config', () => ({ useConfig: vi.fn() }));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string; [k: string]: unknown }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useRouterState: () => ({ location: { pathname: '/today' } }),
  useNavigate: () => vi.fn(),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────
import {
  useBulkMoveOverdue,
  useChangePriority,
  useDeleteItem,
  useEditTitleInline,
  useItems,
  useReschedule,
  useToggleComplete,
} from '../../api/items';
import { useSnackbarStore } from '../../store/snackbar';
import { useUndoStore } from '../../store/undo';
import { TodayView } from '../today-view/index';

const TODAY = '2026-05-19' as LocalDate;
const YESTERDAY = '2026-05-18' as LocalDate;
const THREE_DAYS_AGO = '2026-05-16' as LocalDate;
const FOUR_DAYS_AGO = '2026-05-15' as LocalDate;

const noopMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: crypto.randomUUID() as ItemId,
    schema_version: 1,
    type: 'task',
    project_id: 'proj-1' as Item['project_id'],
    parent_id: null,
    title: 'Task',
    notes: '',
    due_date: TODAY,
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

function renderToday(items: Item[]) {
  vi.mocked(useItems).mockImplementation((filters) => {
    if (filters.view === 'all') {
      return { data: { items, count: items.length }, isLoading: false } as unknown as ReturnType<
        typeof useItems
      >;
    }
    return { data: { items, count: items.length }, isLoading: false } as unknown as ReturnType<
      typeof useItems
    >;
  });

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <TodayView />
    </QueryClientProvider>,
  );
}

describe('TodayView — Move all overdue to today', () => {
  let bulkMutate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.setSystemTime(new Date('2026-05-19T00:00:00Z'));

    bulkMutate = vi.fn();
    vi.mocked(useBulkMoveOverdue).mockReturnValue({
      mutate: bulkMutate,
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useBulkMoveOverdue>);

    vi.mocked(useToggleComplete).mockReturnValue(
      noopMutation as unknown as ReturnType<typeof useToggleComplete>,
    );
    vi.mocked(useReschedule).mockReturnValue(noopMutation as unknown as ReturnType<typeof useReschedule>);
    vi.mocked(useChangePriority).mockReturnValue(
      noopMutation as unknown as ReturnType<typeof useChangePriority>,
    );
    vi.mocked(useEditTitleInline).mockReturnValue(
      noopMutation as unknown as ReturnType<typeof useEditTitleInline>,
    );
    vi.mocked(useDeleteItem).mockReturnValue(noopMutation as unknown as ReturnType<typeof useDeleteItem>);

    useSnackbarStore.getState().dismiss();
    useUndoStore.getState().clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    act(() => {});
    useSnackbarStore.getState().dismiss();
    useUndoStore.getState().clear();
  });

  it('clicking "Move all overdue to today" opens confirmation (microcopy §6.6)', () => {
    const overdue = [
      makeItem({ id: 'o1' as ItemId, title: 'Overdue 1', due_date: YESTERDAY }),
      makeItem({ id: 'o2' as ItemId, title: 'Overdue 2', due_date: THREE_DAYS_AGO }),
      makeItem({ id: 'o3' as ItemId, title: 'Overdue 3', due_date: FOUR_DAYS_AGO }),
    ];
    renderToday(overdue);

    const moveBtn = screen.getByRole('button', { name: /move all overdue to today/i });
    fireEvent.click(moveBtn);

    // Confirmation title per microcopy §6.6
    expect(screen.getByText(/move 3 overdue items to today\?/i)).toBeTruthy();
    // Confirmation body per microcopy §6.6
    expect(screen.getByText('Their due dates will be set to today.')).toBeTruthy();
  });

  it('confirming the dialog calls bulkMoveOverdue.mutate()', () => {
    const overdue = [
      makeItem({ id: 'o1' as ItemId, title: 'Overdue 1', due_date: YESTERDAY }),
      makeItem({ id: 'o2' as ItemId, title: 'Overdue 2', due_date: THREE_DAYS_AGO }),
      makeItem({ id: 'o3' as ItemId, title: 'Overdue 3', due_date: FOUR_DAYS_AGO }),
    ];
    renderToday(overdue);

    // Open confirmation
    fireEvent.click(screen.getByRole('button', { name: /move all overdue to today/i }));

    // Click "Move all" confirm button — exact match to avoid colliding with the
    // "Move all overdue to today" trigger button still in the DOM.
    const confirmBtn = screen.getByRole('button', { name: /^move all$/i });
    fireEvent.click(confirmBtn);

    expect(bulkMutate).toHaveBeenCalledTimes(1);
  });

  it('cancelling the dialog does NOT call bulkMoveOverdue.mutate()', () => {
    const overdue = [makeItem({ id: 'o1' as ItemId, title: 'Overdue', due_date: YESTERDAY })];
    renderToday(overdue);

    fireEvent.click(screen.getByRole('button', { name: /move all overdue to today/i }));

    // Cancel
    const cancelBtn = screen.getByRole('button', { name: /^cancel$/i });
    act(() => {
      fireEvent.click(cancelBtn);
    });

    expect(bulkMutate).not.toHaveBeenCalled();
  });

  it('undo within 5s calls the undo apply function', () => {
    vi.useRealTimers();
    vi.useFakeTimers();

    const undoApplyMock = vi.fn();
    act(() => {
      useUndoStore.getState().push({ label: 'Bulk overdue moved to today', apply: undoApplyMock });
      useSnackbarStore.getState().show({
        variant: 'success',
        text: '3 items moved to today.',
        durationMs: 5000,
        action: { label: 'Undo', onClick: () => useUndoStore.getState().pop() },
      });
    });

    const snackbar = useSnackbarStore.getState().current;
    expect(snackbar?.text).toBe('3 items moved to today.');
    expect(snackbar?.action?.label).toBe('Undo');

    // Click Undo (within 5s)
    act(() => {
      snackbar?.action?.onClick();
    });

    expect(undoApplyMock).toHaveBeenCalledTimes(1);
    expect(useUndoStore.getState().current).toBeNull();
  });

  it('undo entry expires after 5 seconds', () => {
    vi.useRealTimers();
    vi.useFakeTimers();

    const undoApplyMock = vi.fn();
    act(() => {
      useUndoStore.getState().push({ label: 'Bulk overdue moved', apply: undoApplyMock });
    });

    expect(useUndoStore.getState().current).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(5001);
    });

    expect(useUndoStore.getState().current).toBeNull();
    expect(undoApplyMock).not.toHaveBeenCalled();
  });
});
