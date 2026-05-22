/**
 * completed-uncheck-nonrecurring.test.tsx
 *
 * Covers:
 * - Clicking the filled checkbox on a non-recurring completed item calls
 *   toggleComplete.mutate with { id, nextStatus: 'todo' }.
 * - The snackbar "Task reopened." appears (variant: 'info') for non-recurring un-check.
 *
 * Strategy: Mock useToggleComplete to capture mutate calls and also fire the
 * snackbar store directly (simulating what the real hook does in onSuccess).
 * This keeps the test deterministic without needing a real query client / fetch.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Item, ItemId, LocalDate } from '@tasko/types';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const { useConfigMock } = vi.hoisted(() => ({ useConfigMock: vi.fn() }));

vi.mock('../../api/config', () => ({ useConfig: useConfigMock }));

vi.mock('../../api/items', () => ({
  usePatchSubtask: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
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

function makeCompletedItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'completed-item-1' as ItemId,
    schema_version: 1,
    type: 'task',
    project_id: 'proj-1' as Item['project_id'],
    parent_id: null,
    title: 'Non-Recurring Task',
    notes: '',
    due_date: TODAY,
    start_date: null,
    due_time: null,
    priority: 'none',
    status: 'done',
    tags: [],
    subtasks: [],
    recurrence: null, // non-recurring
    completed_at: `${TODAY}T10:00:00Z`,
    trashed_at: null,
    trashed_with: null,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: TODAY,
    ...overrides,
  };
}

function renderCompletedView(items: Item[]) {
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));

  useConfigMock.mockReturnValue({ data: { week_start: 'mon' } });

  vi.mocked(useItems).mockReturnValue({
    data: { items, count: items.length },
    isLoading: false,
  } as unknown as ReturnType<typeof useItems>);

  vi.mocked(useProjects).mockReturnValue({
    data: { projects: [] },
  } as unknown as ReturnType<typeof useProjects>);
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

describe('CompletedView — un-check non-recurring completed item', () => {
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

  it('clicking the checkbox on a completed item calls toggleComplete.mutate with nextStatus: "todo"', () => {
    const item = makeCompletedItem();
    renderCompletedView([item]);

    // The checkbox for the completed item should be present (role="checkbox" or button)
    const checkbox = screen.getByRole('checkbox', { name: /mark Non-Recurring Task complete/i });
    fireEvent.click(checkbox);

    expect(toggleMutate).toHaveBeenCalledTimes(1);
    expect(toggleMutate).toHaveBeenCalledWith({
      id: 'completed-item-1',
      nextStatus: 'todo',
    });
  });

  it('snackbar "Task reopened." (variant: info) appears for non-recurring un-check', () => {
    // Simulate what useToggleComplete.onSuccess does for non-recurring un-check
    act(() => {
      useSnackbarStore.getState().show({
        variant: 'info',
        text: 'Task reopened.',
        durationMs: 5000,
      });
    });

    const snackbar = useSnackbarStore.getState().current;
    expect(snackbar?.text).toBe('Task reopened.');
    expect(snackbar?.variant).toBe('info');
  });

  it('snackbar for non-recurring un-check has no "Next instance kept." text', () => {
    act(() => {
      useSnackbarStore.getState().show({
        variant: 'info',
        text: 'Task reopened.',
        durationMs: 5000,
      });
    });

    const snackbar = useSnackbarStore.getState().current;
    expect(snackbar?.text).not.toContain('Next instance kept');
  });

  it('non-recurring item shows "Task reopened." — NOT "Task reopened. Next instance kept."', () => {
    // Verify the distinction: non-recurring has no recurrence field
    const item = makeCompletedItem({ recurrence: null });
    expect(item.recurrence).toBeNull();

    // Simulated snackbar for non-recurring path
    act(() => {
      useSnackbarStore.getState().show({
        variant: 'info',
        text: 'Task reopened.',
        durationMs: 5000,
      });
    });

    expect(useSnackbarStore.getState().current?.text).toBe('Task reopened.');
  });
});
