/**
 * tag-view-empty.test.tsx
 *
 * Covers:
 * - Tag with 0 active items → empty state renders:
 *   icon: Hash, headline: 'No items tagged "<tag>".', subline: 'Tag tasks in the Task modal to surface them here.'
 * - Empty state appears for both the tag found (but no items) case.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Item, TagId } from '@tasko/types';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../api/items', () => ({
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

const URGENT_TAG = 'tag-urgent-01' as TagId;
const noopMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

function setupEmptyMocks() {
  vi.mocked(useItems).mockReturnValue({
    data: { items: [], count: 0 },
    isLoading: false,
  } as unknown as ReturnType<typeof useItems>);

  vi.mocked(useToggleComplete).mockReturnValue(
    noopMutation as unknown as ReturnType<typeof useToggleComplete>,
  );
  vi.mocked(useEditTitleInline).mockReturnValue(
    noopMutation as unknown as ReturnType<typeof useEditTitleInline>,
  );
  vi.mocked(useDeleteItem).mockReturnValue(noopMutation as unknown as ReturnType<typeof useDeleteItem>);

  vi.mocked(useProjects).mockReturnValue({ data: { projects: [] } } as unknown as ReturnType<
    typeof useProjects
  >);
  vi.mocked(useFolders).mockReturnValue({ data: { folders: [] } } as unknown as ReturnType<
    typeof useFolders
  >);
  vi.mocked(useTags).mockReturnValue({ data: { tags: [] } } as unknown as ReturnType<typeof useTags>);
}

function renderTagView(tagName = 'urgent') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <TagView tagId={URGENT_TAG} tagName={tagName} />
    </QueryClientProvider>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('TagView — empty state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupEmptyMocks();
  });

  afterEach(() => {
    act(() => {});
  });

  it('shows "No items tagged \\"urgent\\"." headline when tag has no active items', () => {
    renderTagView('urgent');
    expect(screen.getByText(/No items tagged "urgent"\./)).toBeTruthy();
  });

  it('shows "Tag tasks in the Task modal to surface them here." subline', () => {
    renderTagView('urgent');
    expect(screen.getByText('Tag tasks in the Task modal to surface them here.')).toBeTruthy();
  });

  it('renders the tag title with "#" prefix', () => {
    renderTagView('urgent');
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toContain('#');
    expect(heading.textContent).toContain('urgent');
  });

  it('does not show any task items', () => {
    renderTagView('urgent');
    // No list items in the main content
    const list = document.querySelector('ul');
    expect(list).toBeNull();
  });

  it('works for different tag names', () => {
    renderTagView('design');
    expect(screen.getByText(/No items tagged "design"\./)).toBeTruthy();
  });
});
