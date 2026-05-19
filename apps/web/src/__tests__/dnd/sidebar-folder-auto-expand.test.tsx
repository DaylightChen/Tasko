/**
 * sidebar-folder-auto-expand.test.tsx
 *
 * Verifies that SidebarDndContext fires onAutoExpandFolder after 300ms when
 * a project is hovered over a folder drop target during drag.
 *
 * Strategy: capture DndContext.onDragOver, invoke it with a synthetic event
 * targeting a folder, then fast-forward fake timers to trigger the callback.
 */

import type { DragOverEvent } from '@dnd-kit/core';
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

// ── Capture DndContext callbacks ──────────────────────────────────────────────

let capturedOnDragOver: ((event: DragOverEvent) => void) | null = null;

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>();
  return {
    ...actual,
    DndContext: (props: React.ComponentProps<typeof actual.DndContext>) => {
      capturedOnDragOver = props.onDragOver ?? null;
      return <actual.DndContext {...props} />;
    },
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const noopMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

const FOLDER_F = { id: 'folder-f', name: 'Folder F', sort_order: 1024 };
const PROJECT_A = { id: 'proj-a', name: 'Project A', folder_id: null, sort_order: 1024 };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SidebarDndContext — folder auto-expand on hover', () => {
  beforeEach(() => {
    capturedOnDragOver = null;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('calls onAutoExpandFolder with the hovered folder id after 300ms', async () => {
    const onAutoExpandFolder = vi.fn();

    vi.mocked(usePatchProject).mockReturnValue({
      ...noopMutation,
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof usePatchProject>);

    vi.mocked(usePatchFolder).mockReturnValue({
      ...noopMutation,
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof usePatchFolder>);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <SidebarDndContext
          projects={[PROJECT_A]}
          folders={[FOLDER_F]}
          onAutoExpandFolder={onAutoExpandFolder}
        >
          <div />
        </SidebarDndContext>
      </QueryClientProvider>,
    );

    expect(capturedOnDragOver).not.toBeNull();

    // Simulate hovering project-a over folder-f header
    const overEvent = {
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
      delta: { x: 0, y: 20 },
      activatorEvent: {} as PointerEvent,
      collisions: [],
    } as unknown as DragOverEvent;

    await act(async () => {
      capturedOnDragOver?.(overEvent);
    });

    // Before 300ms: callback not yet fired
    expect(onAutoExpandFolder).not.toHaveBeenCalled();

    // Advance past the 300ms threshold
    await act(async () => {
      vi.advanceTimersByTime(301);
    });

    expect(onAutoExpandFolder).toHaveBeenCalledOnce();
    expect(onAutoExpandFolder).toHaveBeenCalledWith('folder-f');
  });

  it('does NOT call onAutoExpandFolder if hover moves away within 300ms', async () => {
    const onAutoExpandFolder = vi.fn();

    vi.mocked(usePatchProject).mockReturnValue({
      ...noopMutation,
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof usePatchProject>);

    vi.mocked(usePatchFolder).mockReturnValue({
      ...noopMutation,
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof usePatchFolder>);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <SidebarDndContext
          projects={[PROJECT_A]}
          folders={[FOLDER_F]}
          onAutoExpandFolder={onAutoExpandFolder}
        >
          <div />
        </SidebarDndContext>
      </QueryClientProvider>,
    );

    // Start hovering over folder
    const overFolderEvent = {
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
      delta: { x: 0, y: 20 },
      activatorEvent: {} as PointerEvent,
      collisions: [],
    } as unknown as DragOverEvent;

    await act(async () => {
      capturedOnDragOver?.(overFolderEvent);
    });

    // Move away within 300ms — hover over a project instead
    const overProjectEvent = {
      active: {
        id: 'proj-a',
        data: { current: { type: 'project', projectId: 'proj-a' } },
        rect: { current: { initial: null, translated: null } },
      },
      over: {
        id: 'proj-a',
        data: { current: { type: 'project' } },
        rect: { left: 0, right: 200, top: 50, bottom: 90, width: 200, height: 40 },
        disabled: false,
      },
      delta: { x: 0, y: 60 },
      activatorEvent: {} as PointerEvent,
      collisions: [],
    } as unknown as DragOverEvent;

    await act(async () => {
      vi.advanceTimersByTime(150);
      capturedOnDragOver?.(overProjectEvent);
    });

    // Advance well past the original 300ms
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    // Timer was cleared when hover moved away — callback must not have fired
    expect(onAutoExpandFolder).not.toHaveBeenCalled();
  });
});
