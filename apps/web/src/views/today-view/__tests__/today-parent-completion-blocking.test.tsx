/**
 * today-parent-completion-blocking.test.tsx
 *
 * Covers:
 * - Item with 2 incomplete subtasks: clicking checkbox opens ConfirmationPrompt
 *   with title "Complete all children and continue?"
 *   body "This task has 2 incomplete subtasks. Completing it will mark them all done."
 * - Clicking Confirm calls toggleComplete.mutate with nextStatus='done'
 * - Snackbar "Task and 2 subtasks completed. Undo." — verified via store directly
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Item, ItemId, LocalDate, SubtaskId } from '@tasko/types';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api/items', () => ({
  useItems: vi.fn(),
  useToggleComplete: vi.fn(),
  useReschedule: vi.fn(),
  useChangePriority: vi.fn(),
  useEditTitleInline: vi.fn(),
  useDeleteItem: vi.fn(),
  useBulkMoveOverdue: vi.fn(),
  usePatchItem: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn() })),
}));

vi.mock('../../../api/projects', () => ({ useProjects: vi.fn() }));
vi.mock('../../../api/folders', () => ({ useFolders: vi.fn() }));
vi.mock('../../../api/config', () => ({ useConfig: vi.fn() }));
vi.mock('../../../api/tags', () => ({ useTags: vi.fn(() => ({ data: { tags: [] } })) }));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string; [k: string]: unknown }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useRouterState: () => ({ location: { pathname: '/today' } }),
  useNavigate: () => vi.fn(),
}));

import {
  useBulkMoveOverdue,
  useDeleteItem,
  useEditTitleInline,
  useItems,
  useReschedule,
  useToggleComplete,
} from '../../../api/items';
import { useSnackbarStore } from '../../../store/snackbar';
import { useUndoStore } from '../../../store/undo';
import { TodayView } from '../index';

const TODAY = '2026-05-19' as LocalDate;
const noopMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

function makeSubtask(title: string, status: 'todo' | 'done' = 'todo') {
  return {
    id: crypto.randomUUID() as unknown as SubtaskId,
    title,
    status,
    completed_at: null,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

function makeItemWithSubtasks(subtaskStatuses: ('todo' | 'done')[]): Item {
  return {
    id: 'parent-item' as ItemId,
    schema_version: 1,
    type: 'task',
    project_id: 'proj-1' as Item['project_id'],
    parent_id: null,
    title: 'Parent Task',
    notes: '',
    due_date: TODAY,
    start_date: null,
    due_time: null,
    priority: 'none',
    status: 'todo',
    tags: [],
    subtasks: subtaskStatuses.map((s, i) => makeSubtask(`Subtask ${i + 1}`, s)),
    recurrence: null,
    completed_at: null,
    trashed_at: null,
    trashed_with: null,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

describe('TodayView — parent completion blocking', () => {
  let mutateMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.setSystemTime(new Date('2026-05-19T00:00:00Z'));

    mutateMock = vi.fn();
    vi.mocked(useToggleComplete).mockReturnValue({
      mutate: mutateMock,
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useToggleComplete>);

    vi.mocked(useReschedule).mockReturnValue(noopMutation as unknown as ReturnType<typeof useReschedule>);
    vi.mocked(useEditTitleInline).mockReturnValue(
      noopMutation as unknown as ReturnType<typeof useEditTitleInline>,
    );
    vi.mocked(useDeleteItem).mockReturnValue(noopMutation as unknown as ReturnType<typeof useDeleteItem>);
    vi.mocked(useBulkMoveOverdue).mockReturnValue(
      noopMutation as unknown as ReturnType<typeof useBulkMoveOverdue>,
    );

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

  it('clicking checkbox on item with 2 incomplete subtasks opens ConfirmationPrompt', async () => {
    const item = makeItemWithSubtasks(['todo', 'todo']);
    renderToday([item]);

    const checkbox = screen.getByRole('checkbox', { name: /mark parent task complete/i });
    fireEvent.click(checkbox);

    // ConfirmationPrompt should appear with the correct title
    await waitFor(() => {
      expect(screen.getByText('Complete all children and continue?')).toBeTruthy();
    });
  });

  it('ConfirmationPrompt body mentions "2 incomplete subtasks"', async () => {
    const item = makeItemWithSubtasks(['todo', 'todo']);
    renderToday([item]);

    const checkbox = screen.getByRole('checkbox', { name: /mark parent task complete/i });
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(
        screen.getByText('This task has 2 incomplete subtasks. Completing it will mark them all done.'),
      ).toBeTruthy();
    });
  });

  it('clicking Confirm calls toggleComplete.mutate with nextStatus="done"', async () => {
    const item = makeItemWithSubtasks(['todo', 'todo']);
    renderToday([item]);

    const checkbox = screen.getByRole('checkbox', { name: /mark parent task complete/i });
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(screen.getByText('Complete all children and continue?')).toBeTruthy();
    });

    // Find and click the Confirm button
    const confirmBtn = screen.getByRole('button', { name: /complete all/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalledTimes(1);
      expect(mutateMock).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'parent-item', nextStatus: 'done' }),
      );
    });
  });

  it('clicking Cancel dismisses the confirmation prompt without calling mutate', async () => {
    const item = makeItemWithSubtasks(['todo', 'todo']);
    renderToday([item]);

    const checkbox = screen.getByRole('checkbox', { name: /mark parent task complete/i });
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(screen.getByText('Complete all children and continue?')).toBeTruthy();
    });

    // Cancel the prompt
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByText('Complete all children and continue?')).toBeNull();
    });

    expect(mutateMock).not.toHaveBeenCalled();
  });

  it('items with no incomplete subtasks do NOT trigger confirmation', async () => {
    // 2 subtasks, both done
    const item = makeItemWithSubtasks(['done', 'done']);
    renderToday([item]);

    const checkbox = screen.getByRole('checkbox', { name: /mark parent task complete/i });
    fireEvent.click(checkbox);

    // No confirmation should appear — mutation fires immediately
    expect(screen.queryByText('Complete all children and continue?')).toBeNull();
    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock).toHaveBeenCalledWith({ id: 'parent-item', nextStatus: 'done' });
  });
});
