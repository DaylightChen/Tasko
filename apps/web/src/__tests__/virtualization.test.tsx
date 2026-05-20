/**
 * virtualization.test.tsx
 *
 * Verifies that views activate the virtualizer when item counts exceed the threshold
 * (200 for flat lists). With 250 items in InboxView, the DOM should contain:
 *   - A scroll container with data-testid="virtualized-scroll-container"
 *   - A spacer element with data-testid="virtualized-spacer"
 *   - Fewer rendered rows than the total item count (jsdom renders ~overscan * 2 items)
 *
 * Note: jsdom returns 0 for all layout dimensions (getBoundingClientRect = {0,0,0,0}).
 * @tanstack/react-virtual with a 0-height scroll container renders items for
 * the visible range [0..0] plus overscan items (5 here), so typically ~10-15 DOM rows.
 * We assert < 50 rows as a conservative upper bound that is still far below 250.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Item, ItemId, LocalDate } from '@tasko/types';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../api/items', () => ({
  usePatchSubtask: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  useItems: vi.fn(),
  useToggleComplete: vi.fn(),
  useEditTitleInline: vi.fn(),
  useDeleteItem: vi.fn(),
  useChangePriority: vi.fn(),
  useReschedule: vi.fn(),
  useBulkMoveOverdue: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string; [k: string]: unknown }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useRouterState: () => ({ location: { pathname: '/inbox' } }),
  useNavigate: () => vi.fn(),
}));

vi.mock('../views/_shared/ListDndContext', () => ({
  ListDndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SortableTaskRow: ({
    children,
  }: {
    item: Item;
    children: (props: Record<string, unknown>) => React.ReactNode;
  }) => <>{children({})}</>,
}));

vi.mock('../views/_shared/BulkActionsToolbar', () => ({
  BulkActionsToolbar: () => null,
}));

vi.mock('../hooks/useMultiSelect', () => ({
  useMultiSelect: vi.fn(() => ({
    handleListClick: vi.fn(),
    multiSelect: { set: new Set(), scope: null },
  })),
}));

vi.mock('../hooks/useTagNavigation', () => ({
  useTagNavigation: vi.fn(() => vi.fn()),
}));

vi.mock('../store/task-modal', () => ({
  useTaskModalStore: vi.fn(() => ({
    openEdit: vi.fn(),
    openNew: vi.fn(),
  })),
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
} from '../api/items';
import { InboxView } from '../views/inbox-view/index';

// ── Helpers ────────────────────────────────────────────────────────────────────

const TODAY = '2026-05-20' as LocalDate;

const noopMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

function makeItem(index: number): Item {
  return {
    id: `item-${String(index).padStart(4, '0')}` as ItemId,
    schema_version: 1,
    type: 'task',
    project_id: 'inbox' as Item['project_id'],
    parent_id: null,
    title: `Task ${index}`,
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
    sort_order: index,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: TODAY,
  };
}

function setupMocks(items: Item[]) {
  vi.mocked(useItems).mockReturnValue({
    data: { items, count: items.length },
    isLoading: false,
  } as unknown as ReturnType<typeof useItems>);

  vi.mocked(useToggleComplete).mockReturnValue(
    noopMutation as unknown as ReturnType<typeof useToggleComplete>,
  );
  vi.mocked(useEditTitleInline).mockReturnValue(
    noopMutation as unknown as ReturnType<typeof useEditTitleInline>,
  );
  vi.mocked(useDeleteItem).mockReturnValue(noopMutation as unknown as ReturnType<typeof useDeleteItem>);
  vi.mocked(useChangePriority).mockReturnValue(
    noopMutation as unknown as ReturnType<typeof useChangePriority>,
  );
  vi.mocked(useReschedule).mockReturnValue(noopMutation as unknown as ReturnType<typeof useReschedule>);
  vi.mocked(useBulkMoveOverdue).mockReturnValue(
    noopMutation as unknown as ReturnType<typeof useBulkMoveOverdue>,
  );
}

function renderInboxView(items: Item[]) {
  setupMocks(items);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <InboxView />
    </QueryClientProvider>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('InboxView — virtualization threshold', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders plain list (no virtual container) when items < 200', async () => {
    const items = Array.from({ length: 10 }, (_, i) => makeItem(i));
    await act(async () => {
      renderInboxView(items);
    });

    // No virtualized scroll container
    expect(screen.queryByTestId('virtualized-scroll-container')).toBeNull();
    expect(screen.queryByTestId('virtualized-spacer')).toBeNull();

    // All 10 items are rendered
    const renderedItems = screen.getAllByRole('listitem');
    expect(renderedItems.length).toBeGreaterThanOrEqual(10);
  });

  it('activates virtualizer and renders fewer rows than total when items > 200', async () => {
    const items = Array.from({ length: 250 }, (_, i) => makeItem(i));
    await act(async () => {
      renderInboxView(items);
    });

    // Virtualized scroll container should be present
    const scrollContainer = screen.getByTestId('virtualized-scroll-container');
    expect(scrollContainer).toBeInTheDocument();

    // Spacer should be present (accounts for total height)
    const spacer = screen.getByTestId('virtualized-spacer');
    expect(spacer).toBeInTheDocument();

    // Fewer than 250 list items in the DOM (jsdom renders only overscan items)
    // Conservative upper bound: < 50 items rendered (actual is ~10-15 with jsdom)
    const listItems = scrollContainer.querySelectorAll('li:not([data-testid="virtualized-spacer"])');
    expect(listItems.length).toBeLessThan(50);
    // At least 1 item is visible
    expect(listItems.length).toBeGreaterThanOrEqual(1);
  });

  it('virtual spacer height reflects total item count (250 × 40px = 10000px)', async () => {
    const items = Array.from({ length: 250 }, (_, i) => makeItem(i));
    await act(async () => {
      renderInboxView(items);
    });

    const spacer = screen.getByTestId('virtualized-spacer');
    // The spacer element's height style should be set to totalSize (250 * 40 = 10000)
    expect(spacer).toHaveStyle({ height: '10000px' });
  });
});
