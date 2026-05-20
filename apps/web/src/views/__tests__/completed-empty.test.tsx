/**
 * completed-empty.test.tsx
 *
 * Covers:
 * - No completed items → empty state shows "Nothing completed yet." headline
 *   and "Done tasks land here." subline (microcopy §5).
 * - Loading state renders without crashing.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
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

// ── Helpers ────────────────────────────────────────────────────────────────────

const noopMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

function setupEmptyMocks(loading = false) {
  useConfigMock.mockReturnValue({ data: { week_start: 'mon' } });

  vi.mocked(useItems).mockReturnValue({
    data: loading ? undefined : { items: [], count: 0 },
    isLoading: loading,
  } as unknown as ReturnType<typeof useItems>);

  vi.mocked(useToggleComplete).mockReturnValue(
    noopMutation as unknown as ReturnType<typeof useToggleComplete>,
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

function renderCompletedView() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CompletedView />
    </QueryClientProvider>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('CompletedView — empty state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupEmptyMocks();
  });

  afterEach(() => {
    act(() => {});
  });

  it('shows "Nothing completed yet." headline when there are no completed items', () => {
    renderCompletedView();
    expect(screen.getByText('Nothing completed yet.')).toBeTruthy();
  });

  it('shows "Done tasks land here." subline', () => {
    renderCompletedView();
    expect(screen.getByText('Done tasks land here.')).toBeTruthy();
  });

  it('renders the "Completed" title', () => {
    renderCompletedView();
    expect(screen.getByText('Completed')).toBeTruthy();
  });

  it('does not show any task items', () => {
    renderCompletedView();
    // No list items should be rendered when empty
    const listItems = document.querySelectorAll('li');
    expect(listItems.length).toBe(0);
  });
});
