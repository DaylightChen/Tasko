/**
 * Tests for the Sidebar component.
 * Mocks: useProjects, useFolders, useTags, useItems, useQuery (health),
 *        mutation hooks, @tanstack/react-router (Link, useRouterState)
 *
 * Covers:
 * - All 5 smart-list labels present (Today, Tomorrow, Next 7 Days, Inbox, All)
 * - PROJECTS section header as h2
 * - TAGS section header as h2
 * - Bottom navigation links (Calendar, Completed, Trash, Settings)
 * - Footer "Local · <data-dir>" (version removed from sidebar footer; see SyncFooter)
 * - Today count badge (N) and overdue sub-badge ·O when overdue > 0
 * - Inbox nav item prevents context menu
 * - Right-click on a project row opens context menu with expected items
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// --- Mock @tanstack/react-router ---
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

// --- Mock API hooks ---
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

// Mock useQuery for the health endpoint used inside Sidebar
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({
      data: {
        ok: true,
        version: '0.1.0',
        data_dir: '/home/user/.tasko',
        item_count: 0,
        uptime_s: 0,
      },
    }),
  };
});

import { useCreateFolder, useDeleteFolder, useFolders, usePatchFolder } from '../../api/folders';
import { useItems } from '../../api/items';
import { useCreateProject, useDeleteProject, usePatchProject, useProjects } from '../../api/projects';
import { useTags } from '../../api/tags';
import { Sidebar } from './index';

const NOW_ISO = new Date().toISOString();
const TODAY = new Date().toISOString().slice(0, 10);
const YESTERDAY = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

const makeProject = (
  id: string,
  name: string,
  opts: { is_inbox?: boolean; folder_id?: string | null } = {},
) => ({
  id,
  schema_version: 1,
  name,
  folder_id: opts.folder_id ?? null,
  is_hierarchical: false,
  color: null,
  icon: null,
  sort_order: 0,
  is_inbox: opts.is_inbox ?? false,
  created_at: NOW_ISO,
  updated_at: NOW_ISO,
});

const makeTag = (id: string, name: string) => ({
  id,
  schema_version: 1,
  name,
  name_lower: name.toLowerCase(),
  color: null,
  created_at: NOW_ISO,
  updated_at: NOW_ISO,
});

const noopMutation = { mutate: vi.fn(), isPending: false };

function setupDefaultMocks({
  itemsOverride,
}: {
  itemsOverride?: { items: unknown[]; count: number };
} = {}) {
  vi.mocked(useProjects).mockReturnValue({
    data: {
      projects: [
        makeProject('inbox-1', 'Inbox', { is_inbox: true }),
        makeProject('proj-1', 'Work'),
        makeProject('proj-2', 'Personal'),
      ],
    },
  } as ReturnType<typeof useProjects>);

  vi.mocked(useFolders).mockReturnValue({
    data: {
      folders: [
        {
          id: 'folder-1',
          schema_version: 1,
          name: 'Life',
          sort_order: 0,
          created_at: NOW_ISO,
          updated_at: NOW_ISO,
        },
      ],
    },
  } as ReturnType<typeof useFolders>);

  vi.mocked(useTags).mockReturnValue({
    data: { tags: [makeTag('tag-1', 'Work'), makeTag('tag-2', 'Home')] },
  } as ReturnType<typeof useTags>);

  const defaultItems = [
    // 3 overdue
    { id: 'o1', due_date: YESTERDAY, status: 'todo', trashed_at: null },
    { id: 'o2', due_date: YESTERDAY, status: 'todo', trashed_at: null },
    { id: 'o3', due_date: YESTERDAY, status: 'todo', trashed_at: null },
    // 2 due today
    { id: 't1', due_date: TODAY, status: 'todo', trashed_at: null },
    { id: 't2', due_date: TODAY, status: 'todo', trashed_at: null },
  ];

  vi.mocked(useItems).mockReturnValue({
    data: itemsOverride ?? { items: defaultItems, count: 5 },
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

describe('Sidebar', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('smart list labels', () => {
    it('renders all 5 smart list labels', () => {
      setupDefaultMocks();
      renderSidebar();
      expect(screen.getByText('Today')).toBeTruthy();
      expect(screen.getByText('Tomorrow')).toBeTruthy();
      expect(screen.getByText('Next 7 Days')).toBeTruthy();
      // Inbox appears in multiple places
      expect(screen.getAllByText('Inbox').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('All')).toBeTruthy();
    });
  });

  describe('section headers', () => {
    it('renders PROJECTS as an h2 element', () => {
      setupDefaultMocks();
      renderSidebar();
      const headings = screen.getAllByRole('heading', { level: 2 });
      const projectsH2 = headings.find((h) => h.textContent?.includes('PROJECTS'));
      expect(projectsH2).toBeTruthy();
    });

    it('renders TAGS as an h2 element', () => {
      setupDefaultMocks();
      renderSidebar();
      const headings = screen.getAllByRole('heading', { level: 2 });
      const tagsH2 = headings.find((h) => h.textContent === 'TAGS');
      expect(tagsH2).toBeTruthy();
    });
  });

  describe('bottom navigation links', () => {
    it('renders Calendar bottom link', () => {
      setupDefaultMocks();
      renderSidebar();
      // Use getAllByText since Calendar may appear in calendar routes too
      expect(screen.getAllByText('Calendar').length).toBeGreaterThanOrEqual(1);
    });

    it('renders Completed bottom link', () => {
      setupDefaultMocks();
      renderSidebar();
      expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(1);
    });

    it('renders Trash bottom link', () => {
      setupDefaultMocks();
      renderSidebar();
      expect(screen.getAllByText('Trash').length).toBeGreaterThanOrEqual(1);
    });

    it('renders Settings bottom link', () => {
      setupDefaultMocks();
      renderSidebar();
      expect(screen.getAllByText('Settings').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('footer', () => {
    // SyncFooter now shows "Local · <dataDir>" (the version was removed; we
    // don't sync, just surface the local data directory).
    it('renders the local-files caption with the data-dir from the health query', () => {
      setupDefaultMocks();
      renderSidebar();
      expect(screen.getByText('Local · /home/user/.tasko')).toBeTruthy();
    });
  });

  describe('Today badge', () => {
    it('shows aria-label with label, count and overdue info when total > 0 and overdue > 0', () => {
      setupDefaultMocks();
      renderSidebar();
      // SidebarNavItem builds aria-label as "Today, 5 items, 3 overdue"
      const link = screen.getByLabelText('Today, 5 items, 3 overdue');
      expect(link).toBeTruthy();
    });

    it('badge text content includes total count and overdue count', () => {
      setupDefaultMocks();
      renderSidebar();
      const link = screen.getByLabelText('Today, 5 items, 3 overdue');
      expect(link).toBeTruthy();
      // The badge span (aria-hidden) holds "(5)" and the overdue sub-badge "3"
      // We check the visible badge text within the link
      expect(link.textContent).toContain('5');
      expect(link.textContent).toContain('3');
    });

    it('does not render badge when today count is 0', () => {
      setupDefaultMocks({ itemsOverride: { items: [], count: 0 } });
      renderSidebar();
      // No badge elements should exist
      expect(screen.queryByRole('label')).toBeNull();
      // aria-label with "items" should not be present
      expect(document.querySelector('[aria-label*="items"]')).toBeNull();
    });

    it('shows aria-label without overdue when overdue is 0', () => {
      setupDefaultMocks({
        itemsOverride: {
          items: [{ id: 'today-1', due_date: TODAY, status: 'todo', trashed_at: null }],
          count: 1,
        },
      });
      renderSidebar();
      // SidebarNavItem builds aria-label as "Today, 1 items"
      const link = screen.getByLabelText('Today, 1 items');
      expect(link).toBeTruthy();
    });
  });

  describe('right-click context menu on project row', () => {
    it('opens context menu with Rename, Move to folder, Toggle hierarchical, Delete', () => {
      setupDefaultMocks();
      renderSidebar();

      // Find the Work project link and get its parent li
      const workLink = screen.getByText('Work');
      const li = workLink.closest('li');
      expect(li).toBeTruthy();

      if (!li) throw new Error('li not found');
      fireEvent.contextMenu(li);

      expect(screen.getByText('Rename')).toBeTruthy();
      expect(screen.getByText('Move to folder')).toBeTruthy();
      expect(screen.getByText('Toggle hierarchical')).toBeTruthy();
      expect(screen.getByText('Delete')).toBeTruthy();
    });

    it('right-clicking a project NESTED in a folder shows project actions, not folder actions', () => {
      // Regression: the project's contextmenu handler used to bubble up to
      // the folder's handler, which would overwrite the menu with folder
      // actions ("Rename folder", "Delete folder", etc.) instead of project
      // actions ("Rename", "Move to folder", "Toggle hierarchical", "Delete").
      vi.mocked(useProjects).mockReturnValue({
        data: {
          projects: [
            makeProject('inbox-1', 'Inbox', { is_inbox: true }),
            makeProject('proj-nested', 'NestedProj', { folder_id: 'folder-1' }),
          ],
        },
      } as ReturnType<typeof useProjects>);
      vi.mocked(useFolders).mockReturnValue({
        data: {
          folders: [
            {
              id: 'folder-1',
              schema_version: 1,
              name: 'Life',
              sort_order: 0,
              created_at: NOW_ISO,
              updated_at: NOW_ISO,
            },
          ],
        },
      } as ReturnType<typeof useFolders>);
      // Other mocks default
      vi.mocked(useTags).mockReturnValue({
        data: { tags: [] },
      } as unknown as ReturnType<typeof useTags>);
      vi.mocked(useItems).mockReturnValue({
        data: { items: [], count: 0 },
      } as unknown as ReturnType<typeof useItems>);

      renderSidebar();

      const nested = screen.getByText('NestedProj');
      const li = nested.closest('li');
      if (!li) throw new Error('nested project li not found');
      fireEvent.contextMenu(li);

      // Project actions visible
      expect(screen.getByText('Rename')).toBeTruthy();
      expect(screen.getByText('Move to folder')).toBeTruthy();
      expect(screen.getByText('Toggle hierarchical')).toBeTruthy();
      expect(screen.getByText('Delete')).toBeTruthy();

      // Folder-only actions NOT visible
      expect(screen.queryByText('Delete folder')).toBeNull();
      expect(screen.queryByText('Rename folder')).toBeNull();
    });
  });

  describe('Inbox right-click disabled', () => {
    it('does not open a context menu when right-clicking the Inbox smart-list item', () => {
      setupDefaultMocks();
      renderSidebar();

      // Find the smart-list Inbox anchor (href="/inbox" in the smart list section)
      const inboxLinks = screen.getAllByText('Inbox');
      const firstInbox = inboxLinks[0];
      expect(firstInbox).toBeDefined();
      const smartListInbox = firstInbox?.closest('li');
      expect(smartListInbox).toBeTruthy();

      if (!smartListInbox) throw new Error('smartListInbox not found');
      fireEvent.contextMenu(smartListInbox);

      // No context menu role="menu" should appear
      const menus = document.querySelectorAll('[role="menu"]');
      // Only the add-menu and context-menu are possible; neither should be open
      const openMenus = Array.from(menus);
      expect(openMenus.length).toBe(0);
    });
  });

  describe('project list', () => {
    it('renders user project names in sidebar', () => {
      setupDefaultMocks();
      renderSidebar();
      expect(screen.getByText('Work')).toBeTruthy();
      expect(screen.getByText('Personal')).toBeTruthy();
    });

    it('renders folder name in sidebar', () => {
      setupDefaultMocks();
      renderSidebar();
      expect(screen.getByText('Life')).toBeTruthy();
    });
  });

  describe('tags list', () => {
    it('renders tag names with # prefix', () => {
      setupDefaultMocks();
      renderSidebar();
      // Tags with duplicate names (Work tag and Work project) — use getAllByText
      expect(screen.getAllByText('# Work').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('# Home')).toBeTruthy();
    });
  });
});
