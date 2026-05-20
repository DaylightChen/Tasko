/**
 * sidebar-project-out-of-folder.test.tsx
 *
 * Verifies that dragging a project out of a folder (onto the top-level drop zone)
 * fires usePatchProject.mutate with { folder_id: null }.
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
// Project A is in Folder F
const PROJECT_A = { id: 'proj-a', name: 'Project A', folder_id: 'folder-f', sort_order: 1024 };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SidebarDndContext — drag project out of folder', () => {
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

  it('calls patchProject.mutate with folder_id: null when project dragged onto top-level zone', async () => {
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

    // Simulate: project-a (in folder-f) dragged onto 'top-level' drop zone
    const event = {
      active: {
        id: 'proj-a',
        data: {
          current: { type: 'project', projectId: 'proj-a' },
        },
        rect: { current: { initial: null, translated: null } },
      },
      over: {
        id: 'top-level',
        data: {
          current: { type: 'top-level' },
        },
        rect: { left: 0, right: 200, top: 100, bottom: 110, width: 200, height: 10 },
        disabled: false,
      },
      delta: { x: 0, y: -50 },
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
        patch: expect.objectContaining({ folder_id: null }),
      }),
    );
  });

  it('does NOT call patchProject.mutate when project is already at top level (folder_id is null)', async () => {
    const patchProjectMutate = vi.fn();
    vi.mocked(usePatchProject).mockReturnValue({
      ...noopMutation,
      mutate: patchProjectMutate,
    } as unknown as ReturnType<typeof usePatchProject>);

    vi.mocked(usePatchFolder).mockReturnValue({
      ...noopMutation,
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof usePatchFolder>);

    // Project already has folder_id: null
    const alreadyTopLevel = { id: 'proj-top', name: 'Top Project', folder_id: null, sort_order: 2048 };

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <SidebarDndContext projects={[alreadyTopLevel]} folders={[FOLDER_F]}>
          <div />
        </SidebarDndContext>
      </QueryClientProvider>,
    );

    const event = {
      active: {
        id: 'proj-top',
        data: { current: { type: 'project', projectId: 'proj-top' } },
        rect: { current: { initial: null, translated: null } },
      },
      over: {
        id: 'top-level',
        data: { current: { type: 'top-level' } },
        rect: { left: 0, right: 200, top: 100, bottom: 110, width: 200, height: 10 },
        disabled: false,
      },
      delta: { x: 0, y: 0 },
      activatorEvent: {} as PointerEvent,
      collisions: [],
    } as unknown as DragEndEvent;

    await act(async () => {
      capturedOnDragEnd?.(event);
    });

    // No mutation: project was already at top level
    expect(patchProjectMutate).not.toHaveBeenCalled();
  });

  it('shows snackbar text "Project moved out of <folder name>." with Undo action', async () => {
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
        id: 'top-level',
        data: { current: { type: 'top-level' } },
        rect: { left: 0, right: 200, top: 100, bottom: 110, width: 200, height: 10 },
        disabled: false,
      },
      delta: { x: 0, y: -50 },
      activatorEvent: {} as PointerEvent,
      collisions: [],
    } as unknown as DragEndEvent;

    await act(async () => {
      capturedOnDragEnd?.(event);
    });

    // Snackbar must use the real folder name, not a generic string
    const snackbar = useSnackbarStore.getState().current;
    expect(snackbar).not.toBeNull();
    expect(snackbar?.text).toBe(`Project moved out of ${FOLDER_F.name}.`);
    expect(snackbar?.action?.label).toBe('Undo');

    // Undo entry must have been pushed
    expect(useUndoStore.getState().current).not.toBeNull();
  });
});
