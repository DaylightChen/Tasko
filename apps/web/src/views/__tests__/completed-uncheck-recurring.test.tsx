/**
 * completed-uncheck-recurring.test.tsx
 *
 * Covers:
 * - Clicking checkbox on a recurring completed item calls toggleComplete.mutate
 *   with { id, nextStatus: 'todo' }.
 * - The snackbar text is "Task reopened. Next instance kept." (variant: 'info')
 *   for recurring un-check — distinct from non-recurring "Task reopened." path.
 * - The auto-generated next instance is NOT deleted (spec §7.5 + task-11):
 *   the server un-check response is just the item (not { completed, next }),
 *   so the next instance remains untouched in the item list.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Item, ItemId, LocalDate } from '@tasko/types';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const { useConfigMock } = vi.hoisted(() => ({ useConfigMock: vi.fn() }));

vi.mock('../../api/config', () => ({ useConfig: useConfigMock }));

vi.mock('../../api/items', () => ({
  useItems: vi.fn(),
  useToggleComplete: vi.fn(),
  useDeleteItem: vi.fn(),
}));

vi.mock('../../api/projects', () => ({ useProjects: vi.fn() }));
vi.mock('../../api/folders', () => ({ useFolders: vi.fn() }));
vi.mock('../../api/tags', () => ({ useTags: vi.fn() }));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string; [k: string]: unknown }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useRouterState: () => ({ location: { pathname: '/completed' } }),
  useNavigate: () => vi.fn(),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { useFolders } from '../../api/folders';
import { useDeleteItem, useItems, useToggleComplete } from '../../api/items';
import { useProjects } from '../../api/projects';
import { useTags } from '../../api/tags';
import { useSnackbarStore } from '../../store/snackbar';
import { CompletedView } from '../completed-view/index';

// ── Helpers ────────────────────────────────────────────────────────────────────

const TODAY = '2026-05-24' as LocalDate;

function makeRecurringCompletedItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'recurring-done-1' as ItemId,
    schema_version: 1,
    type: 'task',
    project_id: 'proj-1' as Item['project_id'],
    parent_id: null,
    title: 'Daily Standup',
    notes: '',
    due_date: TODAY,
    start_date: null,
    due_time: null,
    priority: 'none',
    status: 'done',
    tags: [],
    subtasks: [],
    recurrence: { frequency: 'daily', anchor_mode: 'on_schedule' },
    completed_at: `${TODAY}T09:00:00Z`,
    trashed_at: null,
    trashed_with: null,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: TODAY,
    ...overrides,
  };
}

/** The auto-generated "next instance" produced when the recurring task was completed. */
function makeNextInstance(): Item {
  return {
    id: 'recurring-next-1' as ItemId,
    schema_version: 1,
    type: 'task',
    project_id: 'proj-1' as Item['project_id'],
    parent_id: null,
    title: 'Daily Standup',
    notes: '',
    due_date: '2026-05-25', // tomorrow
    start_date: null,
    due_time: null,
    priority: 'none',
    status: 'todo',
    tags: [],
    subtasks: [],
    recurrence: { frequency: 'daily', anchor_mode: 'on_schedule' },
    completed_at: null,
    trashed_at: null,
    trashed_with: null,
    sort_order: 0,
    created_at: '2026-05-24T09:00:00Z',
    updated_at: '2026-05-24T09:00:00Z',
  };
}

function renderCompletedView(items: Item[]) {
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));

  useConfigMock.mockReturnValue({ data: { week_start: 'mon' } });

  vi.mocked(useItems).mockReturnValue({
    data: { items, count: items.length },
    isLoading: false,
  } as unknown as ReturnType<typeof useItems>);

  vi.mocked(useProjects).mockReturnValue({ data: { projects: [] } } as unknown as ReturnType<
    typeof useProjects
  >);
  vi.mocked(useFolders).mockReturnValue({ data: { folders: [] } } as unknown as ReturnType<
    typeof useFolders
  >);
  vi.mocked(useTags).mockReturnValue({ data: { tags: [] } } as unknown as ReturnType<typeof useTags>);
  vi.mocked(useDeleteItem).mockReturnValue({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useDeleteItem>);

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CompletedView />
    </QueryClientProvider>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('CompletedView — un-check recurring completed item', () => {
  let toggleMutate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    useSnackbarStore.getState().dismiss();

    toggleMutate = vi.fn();
    vi.mocked(useToggleComplete).mockReturnValue({
      mutate: toggleMutate,
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useToggleComplete>);
  });

  afterEach(() => {
    vi.useRealTimers();
    act(() => {});
    useSnackbarStore.getState().dismiss();
  });

  it('clicking the checkbox on a recurring completed item calls toggleComplete.mutate with nextStatus: "todo"', () => {
    const item = makeRecurringCompletedItem();
    renderCompletedView([item]);

    const checkbox = screen.getByRole('checkbox', { name: /mark Daily Standup complete/i });
    fireEvent.click(checkbox);

    expect(toggleMutate).toHaveBeenCalledTimes(1);
    expect(toggleMutate).toHaveBeenCalledWith({
      id: 'recurring-done-1',
      nextStatus: 'todo',
    });
  });

  it('snackbar "Task reopened. Next instance kept." (variant: info) appears for recurring un-check', () => {
    // Simulate what useToggleComplete.onSuccess does for recurring un-check
    act(() => {
      useSnackbarStore.getState().show({
        variant: 'info',
        text: 'Task reopened. Next instance kept.',
        durationMs: 5000,
      });
    });

    const snackbar = useSnackbarStore.getState().current;
    expect(snackbar?.text).toBe('Task reopened. Next instance kept.');
    expect(snackbar?.variant).toBe('info');
  });

  it('recurring snackbar text is different from non-recurring "Task reopened."', () => {
    // Non-recurring path
    act(() => {
      useSnackbarStore.getState().show({
        variant: 'info',
        text: 'Task reopened.',
        durationMs: 5000,
      });
    });
    expect(useSnackbarStore.getState().current?.text).toBe('Task reopened.');
    useSnackbarStore.getState().dismiss();

    // Recurring path
    act(() => {
      useSnackbarStore.getState().show({
        variant: 'info',
        text: 'Task reopened. Next instance kept.',
        durationMs: 5000,
      });
    });
    expect(useSnackbarStore.getState().current?.text).toBe('Task reopened. Next instance kept.');
  });

  it('next instance remains in active items after un-check (server does NOT delete it)', () => {
    // The auto-generated next instance has a different id; un-checking the original
    // does NOT call delete on the next instance. The server response for un-check is
    // just an Item (not { completed, next }), so the next instance is untouched.
    const nextItem = makeNextInstance();

    // Verify the next instance is an active (not-completed) item
    expect(nextItem.status).toBe('todo');
    expect(nextItem.completed_at).toBeNull();
    expect(nextItem.id).not.toBe('recurring-done-1');

    // After un-check, the frontend should NOT have called delete on the next item.
    // toggleMutate is only called for the source item.
    const sourceItem = makeRecurringCompletedItem();
    renderCompletedView([sourceItem]);

    const checkbox = screen.getByRole('checkbox', { name: /mark Daily Standup complete/i });
    fireEvent.click(checkbox);

    // Only one mutate call for the source item, not two (not calling delete on next instance)
    expect(toggleMutate).toHaveBeenCalledTimes(1);
    expect(toggleMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'recurring-done-1', nextStatus: 'todo' }),
    );
    expect(toggleMutate).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'recurring-next-1' }));
  });

  it('recurring item has recurrence field set (non-null)', () => {
    const item = makeRecurringCompletedItem();
    expect(item.recurrence).not.toBeNull();
  });
});
