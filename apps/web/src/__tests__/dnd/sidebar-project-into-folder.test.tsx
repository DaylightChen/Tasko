/**
 * sidebar-project-into-folder.test.tsx
 *
 * Verifies that dragging a project onto a folder fires usePatchProject.mutate
 * with { folder_id: F.id } (and a sort_order).
 *
 * Strategy: capture DndContext.onDragEnd via vi.mock('@dnd-kit/core') and
 * invoke it directly with a synthetic DragEndEvent.
 */

import type { DragEndEvent } from '@dnd-kit/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../api/projects', () => ({
  useProjects: vi.fn(),
  useProject: vi.fn(),
  usePatchProject: vi.fn(),
  useCreateProject: vi.fn(),
  useDeleteProject: vi.fn(),
}));

vi.mock('../../api/folders', () => ({
  useFolders: vi.fn(),
  usePatchFolder: vi.fn(),
  useCreateFolder: vi.fn(),
  useDeleteFolder: vi.fn(),
}));

vi.mock('../../api/items', () => ({
  usePatchSubtask: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  useItems: vi.fn(),
}));

vi.mock('../../api/tags', () => ({
  useTags: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string; [k: string]: unknown }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useRouterState: () => ({ location: { pathname: '/today' } }),
  useNavigate: () => vi.fn(),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { usePatchFolder } from '../../api/folders';
import { usePatchProject } from '../../api/projects';
import { SidebarDndContext } from '../../components/sidebar/dnd';
import { useSnackbarStore } from '../../store/snackbar';
import { useUndoStore } from '../../store/undo';

// ── Capture DndContext callbacks ──────────────────────────────────────────────

let capturedOnDragEnd: ((event: DragEndEvent) => void) | null = null;

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>();
  return {
    ...actual,
    DndContext: (props: React.ComponentProps<typeof actual.DndContext>) => {
      capturedOnDragEnd = props.onDragEnd ?? null;
      return <actual.DndContext {...props} />;
    },
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const noopMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

const FOLDER_F = { id: 'folder-f', name: 'Folder F', sort_order: 1024 };
const PROJECT_A = { id: 'proj-a', name: 'Project A', folder_id: null, sort_order: 1024 };
const PROJECT_B = { id: 'proj-b', name: 'Project B', folder_id: 'folder-f', sort_order: 2048 };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SidebarDndContext — drag project into folder', () => {
  beforeEach(() => {
    capturedOnDragEnd = null;
    useSnackbarStore.setState({ current: null, queue: [] });
    useUndoStore.getState().clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    useSnackbarStore.setState({ current: null, queue: [] });
    useUndoStore.getState().clear();
  });

  it('calls patchProject.mutate with folder_id when project dragged onto folder header', async () => {
    const patchProjectMutate = vi.fn();
    vi.mocked(usePatchProject).mockReturnValue({
      ...noopMutation,
      mutate: patchProjectMutate,
    } as unknown as ReturnType<typeof usePatchProject>);

    vi.mocked(usePatchFolder).mockReturnValue({
      ...noopMutation,
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof usePatchFolder>);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <SidebarDndContext projects={[PROJECT_A]} folders={[FOLDER_F]}>
          <div />
        </SidebarDndContext>
      </QueryClientProvider>,
    );

    expect(capturedOnDragEnd).not.toBeNull();

    // Simulate: project-a dragged onto folder-f header
    const event = {
      active: {
        id: 'proj-a',
        data: {
          current: { type: 'project', projectId: 'proj-a' },
        },
        rect: { current: { initial: null, translated: null } },
      },
      over: {
        id: 'folder:folder-f',
        data: {
          current: { type: 'folder', folderId: 'folder-f' },
        },
        rect: { left: 0, right: 200, top: 0, bottom: 40, width: 200, height: 40 },
        disabled: false,
      },
      delta: { x: 0, y: 50 },
      activatorEvent: {} as PointerEvent,
      collisions: [],
    } as unknown as DragEndEvent;

    await act(async () => {
      capturedOnDragEnd?.(event);
    });

    expect(patchProjectMutate).toHaveBeenCalledOnce();
    expect(patchProjectMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'proj-a',
        patch: expect.objectContaining({ folder_id: 'folder-f' }),
      }),
    );
  });

  it('pushes undo entry and shows snackbar with Undo action when project dragged into folder', async () => {
    const patchProjectMutate = vi.fn();
    vi.mocked(usePatchProject).mockReturnValue({
      ...noopMutation,
      mutate: patchProjectMutate,
    } as unknown as ReturnType<typeof usePatchProject>);

    vi.mocked(usePatchFolder).mockReturnValue({
      ...noopMutation,
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof usePatchFolder>);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <SidebarDndContext projects={[PROJECT_A]} folders={[FOLDER_F]}>
          <div />
        </SidebarDndContext>
      </QueryClientProvider>,
    );

    const event = {
      active: {
        id: 'proj-a',
        data: { current: { type: 'project', projectId: 'proj-a' } },
        rect: { current: { initial: null, translated: null } },
      },
      over: {
        id: 'folder:folder-f',
        data: { current: { type: 'folder', folderId: 'folder-f' } },
        rect: { left: 0, right: 200, top: 0, bottom: 40, width: 200, height: 40 },
        disabled: false,
      },
      delta: { x: 0, y: 50 },
      activatorEvent: {} as PointerEvent,
      collisions: [],
    } as unknown as DragEndEvent;

    await act(async () => {
      capturedOnDragEnd?.(event);
    });

    // Undo store must have an entry
    const undoEntry = useUndoStore.getState().current;
    expect(undoEntry).not.toBeNull();

    // Snackbar must have an Undo action
    const snackbar = useSnackbarStore.getState().current;
    expect(snackbar).not.toBeNull();
    expect(snackbar?.action?.label).toBe('Undo');
    expect(snackbar?.text).toBe(`Project moved to ${FOLDER_F.name}.`);
  });

  it('calling undo pop after drag-into-folder re-patches project to original folder_id and sort_order', async () => {
    const patchProjectMutate = vi.fn();
    vi.mocked(usePatchProject).mockReturnValue({
      ...noopMutation,
      mutate: patchProjectMutate,
    } as unknown as ReturnType<typeof usePatchProject>);

    vi.mocked(usePatchFolder).mockReturnValue({
      ...noopMutation,
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof usePatchFolder>);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <SidebarDndContext projects={[PROJECT_A]} folders={[FOLDER_F]}>
          <div />
        </SidebarDndContext>
      </QueryClientProvider>,
    );

    const event = {
      active: {
        id: 'proj-a',
        data: { current: { type: 'project', projectId: 'proj-a' } },
        rect: { current: { initial: null, translated: null } },
      },
      over: {
        id: 'folder:folder-f',
        data: { current: { type: 'folder', folderId: 'folder-f' } },
        rect: { left: 0, right: 200, top: 0, bottom: 40, width: 200, height: 40 },
        disabled: false,
      },
      delta: { x: 0, y: 50 },
      activatorEvent: {} as PointerEvent,
      collisions: [],
    } as unknown as DragEndEvent;

    await act(async () => {
      capturedOnDragEnd?.(event);
    });

    // patchProject was called once for the move itself
    expect(patchProjectMutate).toHaveBeenCalledOnce();

    // Invoke undo — this should trigger the undo apply function which calls patchProject again
    await act(async () => {
      useUndoStore.getState().pop();
    });

    // patchProject must have been called a second time with the original folder_id/sort_order
    expect(patchProjectMutate).toHaveBeenCalledTimes(2);
    expect(patchProjectMutate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        id: 'proj-a',
        patch: expect.objectContaining({
          folder_id: PROJECT_A.folder_id, // null — original value
          sort_order: PROJECT_A.sort_order,
        }),
      }),
    );

    // Undo entry cleared after pop
    expect(useUndoStore.getState().current).toBeNull();
  });

  it('does NOT call patchProject.mutate when dropped with no over target', async () => {
    const patchProjectMutate = vi.fn();
    vi.mocked(usePatchProject).mockReturnValue({
      ...noopMutation,
      mutate: patchProjectMutate,
    } as unknown as ReturnType<typeof usePatchProject>);

    vi.mocked(usePatchFolder).mockReturnValue({
      ...noopMutation,
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof usePatchFolder>);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <SidebarDndContext projects={[PROJECT_A]} folders={[FOLDER_F]}>
          <div />
        </SidebarDndContext>
      </QueryClientProvider>,
    );

    const event = {
      active: {
        id: 'proj-a',
        data: { current: { type: 'project', projectId: 'proj-a' } },
        rect: { current: { initial: null, translated: null } },
      },
      over: null,
      delta: { x: 0, y: 0 },
      activatorEvent: {} as PointerEvent,
      collisions: [],
    } as unknown as DragEndEvent;

    await act(async () => {
      capturedOnDragEnd?.(event);
    });

    expect(patchProjectMutate).not.toHaveBeenCalled();
  });
});
