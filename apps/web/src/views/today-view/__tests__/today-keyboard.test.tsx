/**
 * today-keyboard.test.tsx
 *
 * Covers keyboard interactions on focused row:
 * - Tab focuses the row; Space toggles checkbox
 * - 1/2/3/4 keys call onPriorityClick
 * - Enter opens the task modal (via taskModalStore.openEdit)
 * - T key reschedules to today (no-op if already today — reschedule still called with same date)
 *
 * Note: TaskListRow handles keys internally via its own onKeyDown. The view connects
 * callback props (onToggleCheckbox, onPriorityClick, onScheduleTodayKeyboard, onClick).
 * We test these via fireEvent.keyDown on the rendered list item elements.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Item, ItemId, LocalDate } from '@tasko/types';
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
}));

vi.mock('../../../api/projects', () => ({ useProjects: vi.fn() }));
vi.mock('../../../api/folders', () => ({ useFolders: vi.fn() }));
vi.mock('../../../api/config', () => ({ useConfig: vi.fn() }));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string; [k: string]: unknown }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useRouterState: () => ({ location: { pathname: '/today' } }),
}));

import {
  useBulkMoveOverdue,
  useChangePriority,
  useDeleteItem,
  useEditTitleInline,
  useItems,
  useReschedule,
  useToggleComplete,
} from '../../../api/items';
import { useTaskModalStore } from '../../../store/task-modal';
import { TodayView } from '../index';

const TODAY = '2026-05-19' as LocalDate;

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-kb' as ItemId,
    schema_version: 1,
    type: 'task',
    project_id: 'proj-1' as Item['project_id'],
    parent_id: null,
    title: 'Keyboard Task',
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

describe('TodayView — keyboard shortcuts on focused row', () => {
  let toggleMutateMock: ReturnType<typeof vi.fn>;
  let rescheduleMutateMock: ReturnType<typeof vi.fn>;
  let changePriorityMutateMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.setSystemTime(new Date('2026-05-19T00:00:00Z'));

    toggleMutateMock = vi.fn();
    rescheduleMutateMock = vi.fn();
    changePriorityMutateMock = vi.fn();

    vi.mocked(useToggleComplete).mockReturnValue({
      mutate: toggleMutateMock,
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useToggleComplete>);

    vi.mocked(useReschedule).mockReturnValue({
      mutate: rescheduleMutateMock,
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useReschedule>);

    vi.mocked(useChangePriority).mockReturnValue({
      mutate: changePriorityMutateMock,
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useChangePriority>);

    vi.mocked(useEditTitleInline).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useEditTitleInline>);

    vi.mocked(useDeleteItem).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteItem>);

    vi.mocked(useBulkMoveOverdue).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useBulkMoveOverdue>);

    // Reset task modal store
    act(() => {
      useTaskModalStore.getState().close();
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    act(() => {
      useTaskModalStore.getState().close();
    });
    act(() => {});
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

  it('Space key on focused row calls toggleComplete.mutate', async () => {
    const item = makeItem();
    renderToday([item]);

    const row = screen.getByRole('listitem');
    // Focus the row (simulate Tab focus)
    act(() => {
      row.focus();
    });
    fireEvent.keyDown(row, { key: ' ' });

    expect(toggleMutateMock).toHaveBeenCalledTimes(1);
    expect(toggleMutateMock).toHaveBeenCalledWith({ id: 'item-kb', nextStatus: 'done' });
  });

  it('Enter key on focused row calls taskModal.openEdit', async () => {
    const item = makeItem();
    renderToday([item]);

    const row = screen.getByRole('listitem');
    act(() => {
      row.focus();
    });
    fireEvent.keyDown(row, { key: 'Enter' });

    await waitFor(() => {
      const modalState = useTaskModalStore.getState();
      expect(modalState.mode).toBe('edit');
      expect(modalState.editingItemId).toBe('item-kb');
    });
  });

  it('T key on focused row calls reschedule.mutate with today date', async () => {
    const item = makeItem();
    renderToday([item]);

    const row = screen.getByRole('listitem');
    act(() => {
      row.focus();
    });
    fireEvent.keyDown(row, { key: 't' });

    expect(rescheduleMutateMock).toHaveBeenCalledTimes(1);
    expect(rescheduleMutateMock).toHaveBeenCalledWith({ id: 'item-kb', newDate: TODAY });
  });

  it('key 1 on focused row calls changePriority.mutate with priority=none', () => {
    const item = makeItem();
    renderToday([item]);

    const row = screen.getByRole('listitem');
    act(() => {
      row.focus();
    });

    fireEvent.keyDown(row, { key: '1' });

    expect(changePriorityMutateMock).toHaveBeenCalledTimes(1);
    expect(changePriorityMutateMock).toHaveBeenCalledWith({ id: 'item-kb', priority: 'none' });
  });

  it('key 2 on focused row calls changePriority.mutate with priority=low', () => {
    const item = makeItem();
    renderToday([item]);

    const row = screen.getByRole('listitem');
    act(() => {
      row.focus();
    });

    fireEvent.keyDown(row, { key: '2' });

    expect(changePriorityMutateMock).toHaveBeenCalledTimes(1);
    expect(changePriorityMutateMock).toHaveBeenCalledWith({ id: 'item-kb', priority: 'low' });
  });

  it('key 3 on focused row calls changePriority.mutate with priority=medium', () => {
    const item = makeItem();
    renderToday([item]);

    const row = screen.getByRole('listitem');
    act(() => {
      row.focus();
    });

    fireEvent.keyDown(row, { key: '3' });

    expect(changePriorityMutateMock).toHaveBeenCalledTimes(1);
    expect(changePriorityMutateMock).toHaveBeenCalledWith({ id: 'item-kb', priority: 'medium' });
  });

  it('key 4 on focused row calls changePriority.mutate with priority=high', () => {
    const item = makeItem();
    renderToday([item]);

    const row = screen.getByRole('listitem');
    act(() => {
      row.focus();
    });

    fireEvent.keyDown(row, { key: '4' });

    expect(changePriorityMutateMock).toHaveBeenCalledTimes(1);
    expect(changePriorityMutateMock).toHaveBeenCalledWith({ id: 'item-kb', priority: 'high' });
  });
});
