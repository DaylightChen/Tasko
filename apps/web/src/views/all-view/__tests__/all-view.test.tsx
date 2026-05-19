/**
 * all-view.test.tsx
 *
 * Smoke tests for AllView:
 * - Renders "Showing N active items across all projects." subline
 * - Empty state "No active items." + "Add a task or start a project."
 * - Project breadcrumb (Folder · Project) shown on rows via showProjectBreadcrumb
 * - Done/trashed items are filtered out
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Item, ItemId, LocalDate, ProjectId } from '@tasko/types';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api/items', () => ({
  useItems: vi.fn(),
  useToggleComplete: vi.fn(),
  useReschedule: vi.fn(),
  useChangePriority: vi.fn(),
  useEditTitleInline: vi.fn(),
  useDeleteItem: vi.fn(),
  useBulkMoveOverdue: vi.fn(),
  usePatchItem: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn() })),
}));

vi.mock('../../../api/projects', () => ({ useProjects: vi.fn() }));
vi.mock('../../../api/folders', () => ({ useFolders: vi.fn() }));
vi.mock('../../../api/config', () => ({ useConfig: vi.fn() }));
vi.mock('../../../api/tags', () => ({ useTags: vi.fn(() => ({ data: { tags: [] } })) }));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string; [k: string]: unknown }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useRouterState: () => ({ location: { pathname: '/all' } }),
  useNavigate: () => vi.fn(),
}));

import { useFolders } from '../../../api/folders';
import { useDeleteItem, useEditTitleInline, useItems, useToggleComplete } from '../../../api/items';
import { useProjects } from '../../../api/projects';
import { AllView } from '../index';

const TODAY = '2026-05-19' as LocalDate;
const NOW_ISO = '2026-01-01T00:00:00Z';
const noopMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

const WORK_PROJECT_ID = 'proj-work' as ProjectId;
const PERSONAL_PROJECT_ID = 'proj-personal' as ProjectId;
const FOLDER_ID = 'folder-life';

function makeProject(id: string, name: string, opts: { folder_id?: string } = {}) {
  return {
    id: id as ProjectId,
    schema_version: 1,
    name,
    folder_id: opts.folder_id ?? null,
    is_hierarchical: false,
    color: null,
    icon: null,
    sort_order: 0,
    is_inbox: false,
    created_at: NOW_ISO,
    updated_at: NOW_ISO,
  };
}

function makeFolder(id: string, name: string) {
  return {
    id,
    schema_version: 1,
    name,
    sort_order: 0,
    created_at: NOW_ISO,
    updated_at: NOW_ISO,
  };
}

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: crypto.randomUUID() as ItemId,
    schema_version: 1,
    type: 'task',
    project_id: WORK_PROJECT_ID,
    parent_id: null,
    title: 'All Task',
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
    created_at: NOW_ISO,
    updated_at: NOW_ISO,
    ...overrides,
  };
}

describe('AllView', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-05-19T00:00:00Z'));

    vi.mocked(useToggleComplete).mockReturnValue(
      noopMutation as unknown as ReturnType<typeof useToggleComplete>,
    );
    vi.mocked(useEditTitleInline).mockReturnValue(
      noopMutation as unknown as ReturnType<typeof useEditTitleInline>,
    );
    vi.mocked(useDeleteItem).mockReturnValue(noopMutation as unknown as ReturnType<typeof useDeleteItem>);

    vi.mocked(useProjects).mockReturnValue({
      data: {
        projects: [
          makeProject(WORK_PROJECT_ID, 'Work', { folder_id: FOLDER_ID }),
          makeProject(PERSONAL_PROJECT_ID, 'Personal'),
        ],
      },
    } as unknown as ReturnType<typeof useProjects>);

    vi.mocked(useFolders).mockReturnValue({
      data: {
        folders: [makeFolder(FOLDER_ID, 'Life')],
      },
    } as unknown as ReturnType<typeof useFolders>);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    act(() => {});
  });

  function renderAll(items: Item[]) {
    vi.mocked(useItems).mockReturnValue({
      data: { items, count: items.length },
      isLoading: false,
    } as unknown as ReturnType<typeof useItems>);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={queryClient}>
        <AllView />
      </QueryClientProvider>,
    );
  }

  describe('empty state', () => {
    it('shows "No active items." headline', () => {
      renderAll([]);
      expect(screen.getByText('No active items.')).toBeTruthy();
    });

    it('shows "Add a task or start a project." subline', () => {
      renderAll([]);
      expect(screen.getByText('Add a task or start a project.')).toBeTruthy();
    });
  });

  describe('populated state', () => {
    it('renders <h1>All</h1> title', () => {
      renderAll([makeItem()]);
      expect(screen.getByRole('heading', { level: 1, name: /^all$/i })).toBeTruthy();
    });

    it('shows "Showing 3 active items across all projects." subline for 3 items', () => {
      const items = [
        makeItem({ id: 'a1' as ItemId, title: 'Task 1' }),
        makeItem({ id: 'a2' as ItemId, title: 'Task 2' }),
        makeItem({ id: 'a3' as ItemId, title: 'Task 3' }),
      ];
      renderAll(items);

      expect(screen.getByText('Showing 3 active items across all projects.')).toBeTruthy();
    });

    it('shows "Showing 1 active items across all projects." for 1 item', () => {
      renderAll([makeItem({ id: 'a1' as ItemId })]);
      expect(screen.getByText('Showing 1 active items across all projects.')).toBeTruthy();
    });

    it('renders all task rows', () => {
      const items = [
        makeItem({ id: 'a1' as ItemId, title: 'Row A' }),
        makeItem({ id: 'a2' as ItemId, title: 'Row B' }),
      ];
      renderAll(items);

      const rows = screen.getAllByRole('button', { name: /^task:/i });
      expect(rows).toHaveLength(2);
    });

    it('done items are NOT shown', () => {
      const items = [
        makeItem({ id: 'a1' as ItemId, title: 'Active Task' }),
        makeItem({ id: 'a2' as ItemId, title: 'Done Task', status: 'done', completed_at: NOW_ISO }),
      ];
      renderAll(items);

      expect(screen.getByText('Showing 1 active items across all projects.')).toBeTruthy();
      expect(screen.queryByText('Done Task')).toBeNull();
    });

    it('trashed items are NOT shown', () => {
      const items = [
        makeItem({ id: 'a1' as ItemId, title: 'Active Task' }),
        makeItem({ id: 'a2' as ItemId, title: 'Trashed Task', trashed_at: NOW_ISO }),
      ];
      renderAll(items);

      expect(screen.getByText('Showing 1 active items across all projects.')).toBeTruthy();
      expect(screen.queryByText('Trashed Task')).toBeNull();
    });

    it('project breadcrumb is shown in row aria-label when project is found', () => {
      // Item in Work project (in Life folder)
      const item = makeItem({
        id: 'a1' as ItemId,
        title: 'Breadcrumb Task',
        project_id: WORK_PROJECT_ID,
      });
      renderAll([item]);

      // TaskListRow builds aria-label including project name via the `project` prop
      const row = screen.getByRole('button', { name: /^task:/i });
      // The aria-label should include "in Work" (project name)
      expect(row.getAttribute('aria-label')).toContain('in Work');
    });

    it('rows use showProjectBreadcrumb prop (project name appears in aria-label)', () => {
      const item = makeItem({
        id: 'a1' as ItemId,
        title: 'Personal Task',
        project_id: PERSONAL_PROJECT_ID,
      });
      renderAll([item]);

      const row = screen.getByRole('button', { name: /^task:/i });
      expect(row.getAttribute('aria-label')).toContain('in Personal');
    });
  });
});
