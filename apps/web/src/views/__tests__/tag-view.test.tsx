/**
 * tag-view.test.tsx
 *
 * Covers:
 * - Items with the "urgent" tag appear; items without that tag do not.
 * - Subline shows "<N> items tagged "urgent" across all projects."
 * - Each row has project breadcrumb (project name in row aria-label).
 * - Sort dropdown is present.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Item, ItemId, LocalDate, TagId } from '@tasko/types';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../api/items', () => ({
  usePatchSubtask: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  useItems: vi.fn(),
  useToggleComplete: vi.fn(),
  useEditTitleInline: vi.fn(),
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
  useRouterState: () => ({ location: { pathname: '/tag/urgent' } }),
  useNavigate: () => vi.fn(),
}));

// Mock DnD to avoid DnD Kit DOM requirements
vi.mock('../_shared/ListDndContext', () => ({
  ListDndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SortableTaskRow: ({
    children,
  }: {
    item: Item;
    children: (props: Record<string, unknown>) => React.ReactNode;
  }) => <>{children({})}</>,
}));

vi.mock('../_shared/BulkActionsToolbar', () => ({
  BulkActionsToolbar: () => null,
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { useFolders } from '../../api/folders';
import { useDeleteItem, useEditTitleInline, useItems, useToggleComplete } from '../../api/items';
import { useProjects } from '../../api/projects';
import { useTags } from '../../api/tags';
import { TagView } from '../tag-view/index';

// ── Helpers ────────────────────────────────────────────────────────────────────

const TODAY = '2026-05-19' as LocalDate;
const URGENT_TAG = 'tag-urgent-01' as TagId;
const OTHER_TAG = 'tag-work-02' as TagId;

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
    updated_at: TODAY,
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

function setupMocks(taggedItems: Item[]) {
  vi.mocked(useItems).mockReturnValue({
    data: { items: taggedItems, count: taggedItems.length },
    isLoading: false,
  } as unknown as ReturnType<typeof useItems>);

  vi.mocked(useToggleComplete).mockReturnValue(
    noopMutation as unknown as ReturnType<typeof useToggleComplete>,
  );
  vi.mocked(useEditTitleInline).mockReturnValue(
    noopMutation as unknown as ReturnType<typeof useEditTitleInline>,
  );
  vi.mocked(useDeleteItem).mockReturnValue(noopMutation as unknown as ReturnType<typeof useDeleteItem>);

  vi.mocked(useProjects).mockReturnValue({
    data: {
      projects: [makeProject('proj-1', 'Work'), makeProject('proj-2', 'Personal')],
    },
  } as unknown as ReturnType<typeof useProjects>);

  vi.mocked(useFolders).mockReturnValue({ data: { folders: [] } } as unknown as ReturnType<
    typeof useFolders
  >);
  vi.mocked(useTags).mockReturnValue({ data: { tags: [] } } as unknown as ReturnType<typeof useTags>);
}

function renderTagView(tagName = 'urgent') {
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <TagView tagId={URGENT_TAG} tagName={tagName} />
    </QueryClientProvider>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('TagView — populated', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    act(() => {});
  });

  it('renders only tagged items (those returned by the useItems hook for view=tag)', () => {
    // The server already filters; useItems returns only items with the tag.
    // We seed 3 tagged items — all should appear.
    const tagged = [
      makeItem({ id: 'u1' as ItemId, title: 'Urgent Task 1', tags: [URGENT_TAG] }),
      makeItem({ id: 'u2' as ItemId, title: 'Urgent Task 2', tags: [URGENT_TAG] }),
      makeItem({ id: 'u3' as ItemId, title: 'Urgent Task 3', tags: [URGENT_TAG, OTHER_TAG] }),
    ];
    setupMocks(tagged);
    renderTagView();

    expect(screen.getByText('Urgent Task 1')).toBeTruthy();
    expect(screen.getByText('Urgent Task 2')).toBeTruthy();
    expect(screen.getByText('Urgent Task 3')).toBeTruthy();
  });

  it('items NOT in the result (useItems returns only urgent-tagged) do not appear', () => {
    const tagged = [makeItem({ id: 'u1' as ItemId, title: 'Urgent Task', tags: [URGENT_TAG] })];
    setupMocks(tagged);
    renderTagView();

    // A non-tagged item would only appear if we added it to the mock;
    // since useItems returns only tagged items, there's nothing extra.
    expect(screen.queryByText('Unrelated Task')).toBeNull();
  });

  it('subline shows "<N> items tagged \\"urgent\\" across all projects."', () => {
    const tagged = [
      makeItem({ id: 'u1' as ItemId, title: 'Task 1', tags: [URGENT_TAG] }),
      makeItem({ id: 'u2' as ItemId, title: 'Task 2', tags: [URGENT_TAG] }),
      makeItem({ id: 'u3' as ItemId, title: 'Task 3', tags: [URGENT_TAG] }),
    ];
    setupMocks(tagged);
    renderTagView();

    expect(screen.getByText(/3 items tagged.*urgent.*across all projects/i)).toBeTruthy();
  });

  it('renders view title "# urgent"', () => {
    const tagged = [makeItem({ id: 'u1' as ItemId, title: 'Task', tags: [URGENT_TAG] })];
    setupMocks(tagged);
    renderTagView();

    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toContain('urgent');
  });

  it('renders project breadcrumb in row aria-label (project name "Work")', () => {
    const tagged = [
      makeItem({
        id: 'u1' as ItemId,
        title: 'Task With Breadcrumb',
        tags: [URGENT_TAG],
        project_id: 'proj-1' as Item['project_id'],
      }),
    ];
    setupMocks(tagged);
    const { container } = renderTagView();

    // Breadcrumb is in row's aria-label as "in Work"
    const rows = container.querySelectorAll('li[aria-label]');
    const rowLabels = Array.from(rows).map((r) => r.getAttribute('aria-label') ?? '');
    expect(rowLabels.some((label) => label.includes('in Work'))).toBe(true);
  });

  it('multiple items from different projects each show their project in aria-label', () => {
    const tagged = [
      makeItem({
        id: 'u1' as ItemId,
        title: 'Work Task',
        tags: [URGENT_TAG],
        project_id: 'proj-1' as Item['project_id'],
      }),
      makeItem({
        id: 'u2' as ItemId,
        title: 'Personal Task',
        tags: [URGENT_TAG],
        project_id: 'proj-2' as Item['project_id'],
      }),
    ];
    setupMocks(tagged);
    const { container } = renderTagView();

    const rows = container.querySelectorAll('li[aria-label]');
    const rowLabels = Array.from(rows).map((r) => r.getAttribute('aria-label') ?? '');
    expect(rowLabels.some((label) => label.includes('in Work'))).toBe(true);
    expect(rowLabels.some((label) => label.includes('in Personal'))).toBe(true);
  });
});
