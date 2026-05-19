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
 * - Footer "Tasko v1.0 · Local files in <data-dir>"
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
        version: '1.0',
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
    it('renders "Tasko v1.0" in footer', () => {
      setupDefaultMocks();
      renderSidebar();
      expect(screen.getAllByText('Tasko v1.0').length).toBeGreaterThanOrEqual(1);
    });

    it('renders data_dir from health query in footer', () => {
      setupDefaultMocks();
      renderSidebar();
      // The footer renders two separate <span> elements: "Tasko v1.0" and " · Local files in <dir>"
      // Use a function matcher to find the data_dir text
      const dataDir = screen.getByText((content) => content.includes('Local files in /home/user/.tasko'));
      expect(dataDir).toBeTruthy();
    });
  });

  describe('Today badge', () => {
    it('shows aria-label with count and overdue info when total > 0 and overdue > 0', () => {
      setupDefaultMocks();
      renderSidebar();
      // The badge has aria-label="5 items, 3 overdue"
      const badges = screen.getAllByLabelText('5 items, 3 overdue');
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });

    it('badge text content includes total count', () => {
      setupDefaultMocks();
      renderSidebar();
      const badges = screen.getAllByLabelText('5 items, 3 overdue');
      expect(badges.length).toBeGreaterThanOrEqual(1);
      // Text content includes (5) and ·3
      const firstBadge = badges[0];
      expect(firstBadge).toBeDefined();
      expect(firstBadge?.textContent).toContain('5');
      expect(firstBadge?.textContent).toContain('3');
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
      const badges = screen.getAllByLabelText('1 items');
      expect(badges.length).toBeGreaterThanOrEqual(1);
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
