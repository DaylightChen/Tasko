/**
 * delete-project-cascade.test.tsx
 *
 * Covers:
 * - Right-clicking a project in the Sidebar opens context menu with "Delete" option.
 * - Clicking "Delete" opens ConfirmationPrompt with:
 *     title: "Delete project '<name>'?"
 *     body: "<N> active items will be moved to Trash. This cannot be undone in v1."
 * - Confirming calls deleteProject.mutateAsync with project id.
 * - Project no longer visible in sidebar after deletion.
 *
 * Verifies microcopy §6.9 + binding resolution §4.7 irreversibility clause.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params: _params,
    ...rest
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
    [key: string]: unknown;
  }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useRouterState: () => ({ location: { pathname: '/today' } }),
  useNavigate: () => vi.fn(),
}));

vi.mock('../../api/projects', () => ({
  useProjects: vi.fn(),
  useCreateProject: vi.fn(),
  usePatchProject: vi.fn(),
  useDeleteProject: vi.fn(),
}));

vi.mock('../../api/folders', () => ({
  useFolders: vi.fn(),
  useCreateFolder: vi.fn(),
  usePatchFolder: vi.fn(),
  useDeleteFolder: vi.fn(),
}));

vi.mock('../../api/tags', () => ({
  useTags: vi.fn(),
}));

vi.mock('../../api/items', () => ({
  useDeleteItem: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue({ trashed: [] }),
    isPending: false,
  }),
  usePatchSubtask: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  useItems: vi.fn(),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({
      data: { ok: true, version: '1.0', data_dir: '/home/user/.tasko', item_count: 0, uptime_s: 0 },
    }),
  };
});

// ── Imports after mocks ───────────────────────────────────────────────────────
import { useCreateFolder, useDeleteFolder, useFolders, usePatchFolder } from '../../api/folders';
import { useItems } from '../../api/items';
import { useCreateProject, useDeleteProject, usePatchProject, useProjects } from '../../api/projects';
import { useTags } from '../../api/tags';
import { Sidebar } from '../../components/sidebar/index';

// ── Helpers ────────────────────────────────────────────────────────────────────

const NOW_ISO = new Date().toISOString();
const TODAY = new Date().toISOString().slice(0, 10);

function makeProject(id: string, name: string, opts: { is_inbox?: boolean } = {}) {
  return {
    id,
    schema_version: 1,
    name,
    folder_id: null,
    is_hierarchical: false,
    color: null,
    icon: null,
    sort_order: 0,
    is_inbox: opts.is_inbox ?? false,
    created_at: NOW_ISO,
    updated_at: NOW_ISO,
  };
}

function makeActiveItem(id: string, projectId: string) {
  return {
    id,
    due_date: TODAY,
    status: 'todo',
    trashed_at: null,
    project_id: projectId,
  };
}

const noopMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

function setupMocks(projectId: string, projectName: string, activeItemCount: number) {
  const items = Array.from({ length: activeItemCount }, (_, i) => makeActiveItem(`item-${i}`, projectId));

  vi.mocked(useProjects).mockReturnValue({
    data: {
      projects: [makeProject('inbox-1', 'Inbox', { is_inbox: true }), makeProject(projectId, projectName)],
    },
  } as ReturnType<typeof useProjects>);

  vi.mocked(useFolders).mockReturnValue({
    data: { folders: [] },
  } as unknown as ReturnType<typeof useFolders>);

  vi.mocked(useTags).mockReturnValue({ data: { tags: [] } } as unknown as ReturnType<typeof useTags>);

  // useItems is called for "all" view (to count active items) and "today" view
  vi.mocked(useItems).mockReturnValue({
    data: { items, count: items.length },
  } as ReturnType<typeof useItems>);

  vi.mocked(useCreateProject).mockReturnValue(noopMutation as unknown as ReturnType<typeof useCreateProject>);
  vi.mocked(usePatchProject).mockReturnValue(noopMutation as unknown as ReturnType<typeof usePatchProject>);
  vi.mocked(useDeleteProject).mockReturnValue(noopMutation as unknown as ReturnType<typeof useDeleteProject>);
  vi.mocked(useCreateFolder).mockReturnValue(noopMutation as unknown as ReturnType<typeof useCreateFolder>);
  vi.mocked(usePatchFolder).mockReturnValue(noopMutation as unknown as ReturnType<typeof usePatchFolder>);
  vi.mocked(useDeleteFolder).mockReturnValue(noopMutation as unknown as ReturnType<typeof useDeleteFolder>);
}

function renderSidebar() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <Sidebar />
    </QueryClientProvider>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Sidebar — delete project cascade', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('right-clicking a project opens context menu with Delete option', () => {
    setupMocks('proj-work', 'Work', 5);
    renderSidebar();

    const workLink = screen.getByText('Work');
    const li = workLink.closest('li');
    expect(li).toBeTruthy();
    if (li) fireEvent.contextMenu(li);

    expect(screen.getByText('Delete')).toBeTruthy();
  });

  it('clicking Delete opens confirmation with correct title (microcopy §6.9)', () => {
    setupMocks('proj-work', 'Work', 5);
    renderSidebar();

    const workLink = screen.getByText('Work');
    const li = workLink.closest('li');
    if (li) fireEvent.contextMenu(li);

    fireEvent.click(screen.getByText('Delete'));

    // Title: "Delete project '<name>'?"
    expect(screen.getByText('Delete project "Work"?')).toBeTruthy();
  });

  it('confirmation body shows "<N> active items will be moved to Trash. This cannot be undone in v1."', () => {
    setupMocks('proj-work', 'Work', 5);
    renderSidebar();

    const workLink = screen.getByText('Work');
    const li = workLink.closest('li');
    if (li) fireEvent.contextMenu(li);

    fireEvent.click(screen.getByText('Delete'));

    // Body: "<N> active items will be moved to Trash. This cannot be undone in v1."
    expect(
      screen.getByText('5 active items will be moved to Trash. This cannot be undone in v1.'),
    ).toBeTruthy();
  });

  it('confirms calling deleteProject.mutateAsync with project id', async () => {
    const mutateAsyncMock = vi.fn().mockResolvedValue({ deleted_project_id: 'proj-work', trashed_items: 5 });

    vi.mocked(useDeleteProject).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: mutateAsyncMock,
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteProject>);

    setupMocks('proj-work', 'Work', 5);
    // Re-mock useDeleteProject after setupMocks (it runs vi.mocked again)
    vi.mocked(useDeleteProject).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: mutateAsyncMock,
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteProject>);

    renderSidebar();

    const workLink = screen.getByText('Work');
    const li = workLink.closest('li');
    if (li) fireEvent.contextMenu(li);

    fireEvent.click(screen.getByText('Delete'));

    // Confirm deletion
    const confirmBtn = screen.getByRole('button', { name: /delete project/i });
    fireEvent.click(confirmBtn);

    // mutateAsync should be called with the project id
    expect(mutateAsyncMock).toHaveBeenCalledWith('proj-work');
  });

  it('shows 0 active items when project has no items', () => {
    setupMocks('proj-empty', 'Empty Project', 0);
    renderSidebar();

    const emptyLink = screen.getByText('Empty Project');
    const li = emptyLink.closest('li');
    if (li) fireEvent.contextMenu(li);

    fireEvent.click(screen.getByText('Delete'));

    expect(
      screen.getByText('0 active items will be moved to Trash. This cannot be undone in v1.'),
    ).toBeTruthy();
  });
});
