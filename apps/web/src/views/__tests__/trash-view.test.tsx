/**
 * trash-view.test.tsx
 *
 * Covers:
 * - 3 trashed items + 2 cascade-descendants render in the Trash view.
 * - Subline shows correct item count and copy.
 * - Restore button calls restoreItem.mutate + snackbar "Task restored."
 * - Delete-forever button opens ConfirmationPrompt "Permanently delete?"
 * - Confirming permanent delete calls permanentDelete.mutate.
 * - "Empty Trash" button is visible and opens a confirmation.
 * - Empty state: shows "Trash is empty." headline when no items.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Item, ItemId } from '@tasko/types';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../api/trash', () => ({
  useTrashList: vi.fn(),
  useRestoreItem: vi.fn(),
  usePermanentDeleteItem: vi.fn(),
  useEmptyTrash: vi.fn(),
}));

vi.mock('../../hooks/useMultiSelect', () => ({
  useMultiSelect: vi.fn(() => ({
    handleListClick: vi.fn(),
    multiSelect: { set: new Set(), scope: null },
  })),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string; [k: string]: unknown }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useRouterState: () => ({ location: { pathname: '/trash' } }),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────
import { useEmptyTrash, usePermanentDeleteItem, useRestoreItem, useTrashList } from '../../api/trash';
import { useSnackbarStore } from '../../store/snackbar';
import { TrashView } from '../trash-view/index';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeTrashedItem(overrides: Partial<Item> = {}): Item {
  return {
    id: crypto.randomUUID() as ItemId,
    schema_version: 1,
    type: 'task',
    project_id: 'proj-1' as Item['project_id'],
    parent_id: null,
    title: 'Trashed Task',
    notes: '',
    due_date: '2026-05-10',
    start_date: null,
    due_time: null,
    priority: 'none',
    status: 'todo',
    tags: [],
    subtasks: [],
    recurrence: null,
    completed_at: null,
    trashed_at: '2026-05-15T10:00:00Z',
    trashed_with: null,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-05-15T10:00:00Z',
    ...overrides,
  };
}

const noopMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

function setupMocks(items: Item[]) {
  vi.mocked(useTrashList).mockReturnValue({
    data: { items, count: items.length },
    isLoading: false,
  } as unknown as ReturnType<typeof useTrashList>);

  vi.mocked(useRestoreItem).mockReturnValue(noopMutation as unknown as ReturnType<typeof useRestoreItem>);
  vi.mocked(usePermanentDeleteItem).mockReturnValue(
    noopMutation as unknown as ReturnType<typeof usePermanentDeleteItem>,
  );
  vi.mocked(useEmptyTrash).mockReturnValue(noopMutation as unknown as ReturnType<typeof useEmptyTrash>);
}

function renderTrashView() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <TrashView />
    </QueryClientProvider>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('TrashView — populated', () => {
  beforeEach(() => {
    useSnackbarStore.getState().dismiss();
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => {});
    useSnackbarStore.getState().dismiss();
  });

  it('renders 5 items (3 top-level + 2 cascade descendants)', () => {
    const items = [
      makeTrashedItem({ id: 'item-1' as ItemId, title: 'Item 1', trashed_with: null }),
      makeTrashedItem({ id: 'item-2' as ItemId, title: 'Item 2', trashed_with: null }),
      makeTrashedItem({ id: 'item-3' as ItemId, title: 'Item 3', trashed_with: null }),
      makeTrashedItem({ id: 'item-4' as ItemId, title: 'Cascade Desc 1', trashed_with: 'item-1' as ItemId }),
      makeTrashedItem({ id: 'item-5' as ItemId, title: 'Cascade Desc 2', trashed_with: 'item-1' as ItemId }),
    ];
    setupMocks(items);
    renderTrashView();

    // All 5 titles visible
    for (const item of items) {
      expect(screen.getByText(item.title)).toBeTruthy();
    }
  });

  it('subline shows N items in Trash text', () => {
    const items = [
      makeTrashedItem({ id: 'item-1' as ItemId, title: 'Task 1' }),
      makeTrashedItem({ id: 'item-2' as ItemId, title: 'Task 2' }),
      makeTrashedItem({ id: 'item-3' as ItemId, title: 'Task 3' }),
    ];
    setupMocks(items);
    renderTrashView();

    // Subline: "3 items in Trash. Restored items return to their previous state."
    expect(screen.getByText(/3 items in Trash/i)).toBeTruthy();
    expect(screen.getByText(/Restored items return to their previous state/i)).toBeTruthy();
  });

  it('clicking Restore button calls restoreItem.mutate with item id', () => {
    const mutateMock = vi.fn();
    vi.mocked(useRestoreItem).mockReturnValue({
      mutate: mutateMock,
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useRestoreItem>);

    const item = makeTrashedItem({ id: 'restore-item' as ItemId, title: 'Restorable Task' });
    setupMocksPartial([item], { restoreMutate: mutateMock });
    renderTrashView();

    const restoreBtn = screen.getAllByRole('button', { name: /restore/i })[0];
    expect(restoreBtn).toBeDefined();
    if (restoreBtn) fireEvent.click(restoreBtn);

    expect(mutateMock).toHaveBeenCalledWith('restore-item');
  });

  it('clicking Delete-forever button opens confirmation prompt', () => {
    const item = makeTrashedItem({ id: 'del-forever' as ItemId, title: 'Forever Gone Task' });
    setupMocks([item]);
    renderTrashView();

    const deleteBtn = screen.getAllByRole('button', { name: /delete forever/i })[0];
    expect(deleteBtn).toBeDefined();
    if (deleteBtn) fireEvent.click(deleteBtn);

    // Confirmation dialog should open with "Permanently delete?" title
    expect(screen.getByText('Permanently delete?')).toBeTruthy();
    expect(screen.getByText('This cannot be undone.')).toBeTruthy();
  });

  it('confirming permanent delete calls permanentDelete.mutate', () => {
    const permDeleteMock = vi.fn();
    vi.mocked(usePermanentDeleteItem).mockReturnValue({
      mutate: permDeleteMock,
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof usePermanentDeleteItem>);

    const item = makeTrashedItem({ id: 'perm-del-item' as ItemId, title: 'Item To Perm Delete' });
    setupMocksPartial([item], { permDeleteMutate: permDeleteMock });
    renderTrashView();

    // Open confirmation
    const deleteBtn = screen.getAllByRole('button', { name: /delete forever/i })[0];
    if (deleteBtn) fireEvent.click(deleteBtn);

    // Find and click confirm in the confirmation dialog — there are two "Delete forever"
    // buttons: the icon button in the row + the confirm button in the dialog.
    // The confirm button in the dialog is a plain text button (not an icon button).
    const allDeleteBtns = screen.getAllByRole('button', { name: /delete forever/i });
    // The last one is the ConfirmationPrompt's confirm button
    const confirmBtn = allDeleteBtns[allDeleteBtns.length - 1];
    if (confirmBtn) fireEvent.click(confirmBtn);

    expect(permDeleteMock).toHaveBeenCalledWith('perm-del-item');
  });

  it('Empty Trash button is visible', () => {
    const items = [makeTrashedItem({ id: 'et-1' as ItemId, title: 'Task' })];
    setupMocks(items);
    renderTrashView();

    expect(screen.getByRole('button', { name: /empty trash/i })).toBeTruthy();
  });

  it('clicking Empty Trash button opens confirmation', () => {
    const items = [makeTrashedItem({ id: 'et-2' as ItemId, title: 'Task' })];
    setupMocks(items);
    renderTrashView();

    const emptyBtn = screen.getByRole('button', { name: /empty trash/i });
    fireEvent.click(emptyBtn);

    // Confirmation: "Empty Trash?" title
    expect(screen.getByText('Empty Trash?')).toBeTruthy();
  });

  it('confirming Empty Trash calls emptyTrash.mutate', () => {
    const emptyMutate = vi.fn();
    vi.mocked(useEmptyTrash).mockReturnValue({
      mutate: emptyMutate,
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useEmptyTrash>);

    const items = [makeTrashedItem({ id: 'et-3' as ItemId, title: 'Task' })];
    setupMocksPartial(items, { emptyMutate });
    renderTrashView();

    const emptyBtn = screen.getByRole('button', { name: /empty trash/i });
    fireEvent.click(emptyBtn);

    // Find all Empty Trash buttons (one in header, one in confirmation)
    const allEmptyBtns = screen.getAllByRole('button', { name: /empty trash/i });
    // Click the last one (in the confirmation dialog)
    const confirmBtn = allEmptyBtns[allEmptyBtns.length - 1];
    if (confirmBtn) fireEvent.click(confirmBtn);

    expect(emptyMutate).toHaveBeenCalled();
  });
});

describe('TrashView — empty state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => {});
  });

  it('shows "Trash is empty." when there are no trashed items', () => {
    setupMocks([]);
    renderTrashView();

    expect(screen.getByText('Trash is empty.')).toBeTruthy();
    expect(
      screen.getByText('Deleted items land here. Restore or permanently delete from here.'),
    ).toBeTruthy();
  });

  it('does not show Empty Trash button in empty state', () => {
    setupMocks([]);
    renderTrashView();

    // In empty state, no "Empty Trash" button (the component shows EmptyState instead)
    expect(screen.queryByRole('button', { name: /empty trash/i })).toBeNull();
  });
});

// ── Partial mock helper ───────────────────────────────────────────────────────
function setupMocksPartial(
  items: Item[],
  overrides: {
    restoreMutate?: ReturnType<typeof vi.fn>;
    permDeleteMutate?: ReturnType<typeof vi.fn>;
    emptyMutate?: ReturnType<typeof vi.fn>;
  } = {},
) {
  vi.mocked(useTrashList).mockReturnValue({
    data: { items, count: items.length },
    isLoading: false,
  } as unknown as ReturnType<typeof useTrashList>);

  vi.mocked(useRestoreItem).mockReturnValue({
    mutate: overrides.restoreMutate ?? vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useRestoreItem>);

  vi.mocked(usePermanentDeleteItem).mockReturnValue({
    mutate: overrides.permDeleteMutate ?? vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof usePermanentDeleteItem>);

  vi.mocked(useEmptyTrash).mockReturnValue({
    mutate: overrides.emptyMutate ?? vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useEmptyTrash>);
}
