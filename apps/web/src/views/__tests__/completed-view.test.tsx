/**
 * completed-view.test.tsx
 *
 * Covers:
 * - Items completed at various times appear under correct time-group headers.
 * - Group headers: Today / Yesterday / Earlier this week / Last week / Earlier this month / Earlier.
 * - Items have project breadcrumbs visible.
 * - Sort dropdown defaults to "Recently completed".
 * - Switching sort to "Title (A–Z)" re-orders items.
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
import { CompletedView } from '../completed-view/index';

// ── Constants ──────────────────────────────────────────────────────────────────

// Use Sunday 2026-05-24 so each bucket can have a distinct representative date:
// - today: 2026-05-24
// - yesterday: 2026-05-23
// - earlier_this_week: 2026-05-20 (Wed, same week starting Mon May 18)
// - last_week: 2026-05-13 (Wed of prior week)
// - earlier_this_month: 2026-05-01 (same month, not in this/last week)
// - earlier: 2026-03-01 (prior month)
const TODAY_STR = '2026-05-24' as LocalDate;

// ── Helpers ────────────────────────────────────────────────────────────────────

const noopMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: crypto.randomUUID() as ItemId,
    schema_version: 1,
    type: 'task',
    project_id: 'proj-1' as Item['project_id'],
    parent_id: null,
    title: 'Completed Task',
    notes: '',
    due_date: TODAY_STR,
    start_date: null,
    due_time: null,
    priority: 'none',
    status: 'done',
    tags: [],
    subtasks: [],
    recurrence: null,
    completed_at: `${TODAY_STR}T10:00:00Z`,
    trashed_at: null,
    trashed_with: null,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: TODAY_STR,
    ...overrides,
  };
}

function makeProject(id: string, name: string) {
  return {
    id,
    schema_version: 1,
    name,
    folder_id: null,
    is_hierarchical: false,
    color: null,
    icon: null,
    sort_order: 0,
    is_inbox: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

function setupMocks(items: Item[]) {
  useConfigMock.mockReturnValue({ data: { week_start: 'mon' } });

  vi.mocked(useItems).mockReturnValue({
    data: { items, count: items.length },
    isLoading: false,
  } as unknown as ReturnType<typeof useItems>);

  vi.mocked(useToggleComplete).mockReturnValue(
    noopMutation as unknown as ReturnType<typeof useToggleComplete>,
  );
  vi.mocked(useDeleteItem).mockReturnValue(noopMutation as unknown as ReturnType<typeof useDeleteItem>);

  vi.mocked(useProjects).mockReturnValue({
    data: { projects: [makeProject('proj-1', 'Work')] },
  } as unknown as ReturnType<typeof useProjects>);

  vi.mocked(useFolders).mockReturnValue({ data: { folders: [] } } as unknown as ReturnType<
    typeof useFolders
  >);
  vi.mocked(useTags).mockReturnValue({ data: { tags: [] } } as unknown as ReturnType<typeof useTags>);
}

function renderCompletedView() {
  // Freeze time to TODAY_STR so todayLocal() returns the expected date
  vi.setSystemTime(new Date(`${TODAY_STR}T12:00:00Z`));

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CompletedView />
    </QueryClientProvider>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('CompletedView — time-group headers and item placement', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    act(() => {});
  });

  it('renders "Today" group header for item completed today', () => {
    const item = makeItem({
      id: 'today-item' as ItemId,
      title: 'Done Today',
      completed_at: `${TODAY_STR}T08:30:00Z`,
    });
    setupMocks([item]);
    renderCompletedView();
    // Use getAllByText to handle multiple 'Today' occurrences (header + date chip)
    expect(screen.getAllByText('Today').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Done Today')).toBeTruthy();
  });

  it('renders "Yesterday" group header for item completed yesterday', () => {
    const item = makeItem({
      id: 'yest-item' as ItemId,
      title: 'Done Yesterday',
      completed_at: '2026-05-23T15:00:00Z',
    });
    setupMocks([item]);
    renderCompletedView();
    expect(screen.getByText('Yesterday')).toBeTruthy();
    expect(screen.getByText('Done Yesterday')).toBeTruthy();
  });

  it('renders "Earlier this week" group header for item completed earlier this week', () => {
    const item = makeItem({
      id: 'etw-item' as ItemId,
      title: 'Done Earlier This Week',
      completed_at: '2026-05-20T10:00:00Z', // Wednesday
    });
    setupMocks([item]);
    renderCompletedView();
    expect(screen.getByText('Earlier this week')).toBeTruthy();
    expect(screen.getByText('Done Earlier This Week')).toBeTruthy();
  });

  it('renders "Last week" group header for item completed last week', () => {
    const item = makeItem({
      id: 'lw-item' as ItemId,
      title: 'Done Last Week',
      completed_at: '2026-05-13T10:00:00Z',
    });
    setupMocks([item]);
    renderCompletedView();
    expect(screen.getByText('Last week')).toBeTruthy();
    expect(screen.getByText('Done Last Week')).toBeTruthy();
  });

  it('renders "Earlier this month" group header for item completed earlier this month', () => {
    const item = makeItem({
      id: 'etm-item' as ItemId,
      title: 'Done Earlier This Month',
      completed_at: '2026-05-01T10:00:00Z',
    });
    setupMocks([item]);
    renderCompletedView();
    expect(screen.getByText('Earlier this month')).toBeTruthy();
    expect(screen.getByText('Done Earlier This Month')).toBeTruthy();
  });

  it('renders "Earlier" group header for item completed long ago', () => {
    const item = makeItem({
      id: 'early-item' as ItemId,
      title: 'Done Long Ago',
      completed_at: '2026-03-01T10:00:00Z',
    });
    setupMocks([item]);
    renderCompletedView();
    expect(screen.getByText('Earlier')).toBeTruthy();
    expect(screen.getByText('Done Long Ago')).toBeTruthy();
  });

  it('items from multiple buckets appear under correct headers', () => {
    const items = [
      makeItem({ id: 'a' as ItemId, title: 'Today Item', completed_at: `${TODAY_STR}T10:00:00Z` }),
      makeItem({ id: 'b' as ItemId, title: 'Yesterday Item', completed_at: '2026-05-23T10:00:00Z' }),
      makeItem({ id: 'c' as ItemId, title: 'Earlier This Week Item', completed_at: '2026-05-20T10:00:00Z' }),
    ];
    setupMocks(items);
    renderCompletedView();

    expect(screen.getAllByText('Today').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Yesterday')).toBeTruthy();
    expect(screen.getByText('Earlier this week')).toBeTruthy();

    expect(screen.getByText('Today Item')).toBeTruthy();
    expect(screen.getByText('Yesterday Item')).toBeTruthy();
    expect(screen.getByText('Earlier This Week Item')).toBeTruthy();
  });

  it('shows sort dropdown defaulting to "Recently completed"', () => {
    const item = makeItem({ completed_at: `${TODAY_STR}T10:00:00Z` });
    setupMocks([item]);
    renderCompletedView();

    const select = screen.getByRole('combobox', { name: /sort order/i });
    expect((select as HTMLSelectElement).value).toBe('completed_desc');
    // The visible label must match microcopy §9 exactly
    const selectedOption = Array.from((select as HTMLSelectElement).options).find((o) => o.selected);
    expect(selectedOption?.text).toBe('Recently completed');
  });

  it('sort dropdown has "Title (A–Z)" option', () => {
    const item = makeItem({ completed_at: `${TODAY_STR}T10:00:00Z` });
    setupMocks([item]);
    renderCompletedView();

    expect(screen.getByRole('option', { name: /title/i })).toBeTruthy();
  });

  it('switching sort to "Title (A–Z)" orders items alphabetically', () => {
    const items = [
      makeItem({ id: 'z' as ItemId, title: 'Zebra', completed_at: `${TODAY_STR}T10:00:00Z` }),
      makeItem({ id: 'a' as ItemId, title: 'Apple', completed_at: `${TODAY_STR}T09:00:00Z` }),
      makeItem({ id: 'm' as ItemId, title: 'Mango', completed_at: `${TODAY_STR}T08:00:00Z` }),
    ];
    setupMocks(items);
    const { container } = renderCompletedView();

    const select = screen.getByRole('combobox', { name: /sort order/i });
    fireEvent.change(select, { target: { value: 'title_asc' } });

    // All items should still be visible
    expect(screen.getByText('Zebra')).toBeTruthy();
    expect(screen.getByText('Apple')).toBeTruthy();
    expect(screen.getByText('Mango')).toBeTruthy();

    // Assert DOM order is alphabetical: Apple → Mango → Zebra
    const taskTitles = Array.from(container.querySelectorAll('li[aria-label]')).map(
      (el) => el.getAttribute('aria-label') ?? '',
    );
    const appleIdx = taskTitles.findIndex((l) => l.includes('Apple'));
    const mangoIdx = taskTitles.findIndex((l) => l.includes('Mango'));
    const zebraIdx = taskTitles.findIndex((l) => l.includes('Zebra'));
    expect(appleIdx).toBeLessThan(mangoIdx);
    expect(mangoIdx).toBeLessThan(zebraIdx);
  });

  it('renders project breadcrumb for items (project name in row aria-label)', () => {
    const item = makeItem({
      id: 'b-item' as ItemId,
      title: 'Task With Breadcrumb',
      project_id: 'proj-1' as Item['project_id'],
      completed_at: `${TODAY_STR}T10:00:00Z`,
    });
    setupMocks([item]);
    const { container } = renderCompletedView();

    // The project name "Work" should appear in the row's aria-label as "in Work"
    const rows = container.querySelectorAll('li[aria-label]');
    const rowLabels = Array.from(rows).map((r) => r.getAttribute('aria-label') ?? '');
    expect(rowLabels.some((label) => label.includes('in Work'))).toBe(true);
  });
});
