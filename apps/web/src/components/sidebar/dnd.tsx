/**
 * Sidebar drag-and-drop wrapper.
 *
 * Wraps the projects+folders section in a DndContext.
 * - Project rows: useSortable (keyed by project id)
 * - Folder headers: useDroppable (keyed by folder id)
 *
 * Drop scenarios:
 *   - Project onto folder header → PATCH project { folder_id, sort_order }
 *   - Project onto top-level → PATCH project { folder_id: null, sort_order }
 *   - Folder reorder → PATCH folder { sort_order }
 */
import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  closestCenter,
} from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { FolderId, ProjectId } from '@tasko/types';
import type React from 'react';
import { guardDndKeyDown } from '../../lib/dnd-keydown';

// Loose types to avoid brand mismatch with zod-parsed API data
type LooseProject = {
  id: string;
  name: string;
  folder_id: string | null;
  sort_order: number;
  color?: string | null | undefined;
};

type LooseFolder = {
  id: string;
  name: string;
  sort_order: number;
};
import { useRef, useState } from 'react';
import { usePatchFolder } from '../../api/folders';
import { usePatchProject } from '../../api/projects';
import { announce } from '../../lib/a11y';
import { useDndSensors } from '../../lib/dnd-sensors';
import { stopAutoScroll, updateAutoScroll } from '../../lib/drag-auto-scroll';
import { computeNewSortOrder, renumberList } from '../../lib/sort-order';
import { useSnackbarStore } from '../../store/snackbar';
import { useUndoStore } from '../../store/undo';
import { DragOverlayContent } from '../drag-visuals';

// ─── Droppable folder zone ────────────────────────────────────────────────────

export function useFolderDroppable(folderId: string) {
  return useDroppable({
    id: `folder:${folderId}`,
    data: { type: 'folder', folderId },
  });
}

// ─── Sortable project row wrapper ─────────────────────────────────────────────

export interface SortableProjectProps {
  projectId: string;
  children: React.ReactNode;
}

export function SortableProject({ projectId, children }: SortableProjectProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: projectId,
    data: { type: 'project', projectId },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform) ?? undefined,
    transition,
  };

  // See lib/dnd-keydown.ts — Enter inside the inline RenameInput would
  // otherwise activate a phantom keyboard drag.
  const { onKeyDown: dndKeyDown, ...otherListeners } = (listeners ?? {}) as {
    onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  } & React.HTMLAttributes<HTMLDivElement>;

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-state={isDragging ? 'drag-source-placeholder' : undefined}
      {...attributes}
      {...otherListeners}
      onKeyDown={guardDndKeyDown(dndKeyDown)}
    >
      {children}
    </div>
  );
}

// ─── Sortable folder row wrapper ──────────────────────────────────────────────

export function SortableFolder({
  folderId,
  children,
}: {
  folderId: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `folder-sortable:${folderId}`,
    data: { type: 'folder-sortable', folderId },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform) ?? undefined,
    transition,
  };

  // See lib/dnd-keydown.ts — Enter inside the inline folder-rename input
  // would otherwise activate a phantom keyboard drag.
  const { onKeyDown: dndKeyDown, ...otherListeners } = (listeners ?? {}) as {
    onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  } & React.HTMLAttributes<HTMLDivElement>;

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-state={isDragging ? 'drag-source-placeholder' : undefined}
      {...attributes}
      {...otherListeners}
      onKeyDown={guardDndKeyDown(dndKeyDown)}
    >
      {children}
    </div>
  );
}

// ─── Top-level drop zone ──────────────────────────────────────────────────────

export function TopLevelDropZone() {
  const { setNodeRef, isOver } = useDroppable({
    id: 'top-level',
    data: { type: 'top-level' },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ minHeight: 8 }}
      data-state={isOver ? 'drop-target' : undefined}
      aria-label="Drop here to remove from folder"
    />
  );
}

// ─── DndContext wrapper ───────────────────────────────────────────────────────

interface SidebarDndContextProps {
  projects: LooseProject[];
  folders: LooseFolder[];
  scrollContainerRef?: React.RefObject<HTMLElement>;
  onAutoExpandFolder?: (folderId: string) => void;
  children: React.ReactNode;
}

export function SidebarDndContext({
  projects,
  folders,
  scrollContainerRef,
  onAutoExpandFolder,
  children,
}: SidebarDndContextProps) {
  const sensors = useDndSensors();
  const patchProject = usePatchProject();
  const patchFolder = usePatchFolder();
  const snackbar = useSnackbarStore();

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'project' | 'folder-sortable' | null>(null);
  const autoExpandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build sorted lists
  const sortedFolders = [...folders].sort((a, b) => a.sort_order - b.sort_order);
  const sortedProjectIds = [...projects].sort((a, b) => a.sort_order - b.sort_order).map((p) => p.id);
  const sortedFolderSortableIds = sortedFolders.map((f) => `folder-sortable:${f.id}`);

  const allSortableIds = [...sortedFolderSortableIds, ...sortedProjectIds];

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    const data = event.active.data.current as { type: string } | undefined;
    const type = data?.type === 'folder-sortable' ? 'folder-sortable' : 'project';
    setActiveDragId(id);
    setActiveType(type);

    const item =
      type === 'project'
        ? projects.find((p) => p.id === id)
        : folders.find((f) => `folder-sortable:${f.id}` === id);
    const name = item?.name ?? id;
    announce(`Dragging "${name}". Drop on a project, folder, or feature.`);
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (!event.over) return;
    const overId = event.over.id as string;
    const overData = event.over.data.current as { type: string; folderId?: string } | undefined;

    // Auto-expand folder on hover
    if (overData?.type === 'folder' && overData.folderId) {
      const hoverFolderId = overData.folderId;
      if (!autoExpandTimerRef.current) {
        autoExpandTimerRef.current = setTimeout(() => {
          autoExpandTimerRef.current = null;
          onAutoExpandFolder?.(hoverFolderId);
        }, 300);
      }
    } else {
      if (autoExpandTimerRef.current) {
        clearTimeout(autoExpandTimerRef.current);
        autoExpandTimerRef.current = null;
      }
    }

    if (event.delta) {
      const clientY = (event.activatorEvent as PointerEvent)?.clientY ?? 0;
      if (scrollContainerRef?.current) {
        updateAutoScroll(scrollContainerRef.current, clientY);
      }
    }

    const name = overId.startsWith('folder:')
      ? (folders.find((f) => `folder:${f.id}` === overId)?.name ?? overId)
      : (projects.find((p) => p.id === overId)?.name ?? overId);
    announce(`Drop on ${name}.`);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    stopAutoScroll();
    setActiveDragId(null);
    setActiveType(null);

    if (autoExpandTimerRef.current) {
      clearTimeout(autoExpandTimerRef.current);
      autoExpandTimerRef.current = null;
    }

    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const activeData = active.data.current as
      | { type: string; projectId?: string; folderId?: string }
      | undefined;
    const overData = over.data.current as { type: string; folderId?: string } | undefined;

    // Dropping a project onto a folder header → move into folder
    if (activeData?.type === 'project' && overData?.type === 'folder') {
      const folderId = overData.folderId as FolderId;
      const project = projects.find((p) => p.id === activeId);
      const folder = folders.find((f) => f.id === folderId);
      if (!project || !folder) return;

      const prior = { folder_id: project.folder_id, sort_order: project.sort_order };

      const folderProjects = projects
        .filter((p) => p.folder_id === folderId)
        .sort((a, b) => a.sort_order - b.sort_order);
      const maxOrder =
        folderProjects.length > 0
          ? (folderProjects[folderProjects.length - 1]?.sort_order ?? 0) + 1024
          : 1024;

      patchProject.mutate({
        id: project.id as ProjectId,
        patch: { folder_id: folderId, sort_order: maxOrder },
      });

      const projectId = project.id as ProjectId;
      useUndoStore.getState().push({
        label: 'Project move',
        apply: () =>
          patchProject.mutate({
            id: projectId,
            patch: { folder_id: prior.folder_id as FolderId | null, sort_order: prior.sort_order },
          }),
      });

      const folderName = folder.name;
      snackbar.show({
        variant: 'success',
        text: `Project moved to ${folderName}.`,
        durationMs: 5000,
        action: { label: 'Undo', onClick: () => useUndoStore.getState().pop() },
      });
      announce(`Dropped onto ${folderName}.`);
      return;
    }

    // Dropping a project onto top-level → remove from folder
    if (activeData?.type === 'project' && overId === 'top-level') {
      const project = projects.find((p) => p.id === activeId);
      if (!project) return;
      if (project.folder_id === null) return;

      const prior = { folder_id: project.folder_id, sort_order: project.sort_order };
      const sourceFolderName = folders.find((f) => f.id === prior.folder_id)?.name ?? 'folder';

      const topLevelProjects = projects
        .filter((p) => p.folder_id === null)
        .sort((a, b) => a.sort_order - b.sort_order);
      const maxOrder =
        topLevelProjects.length > 0
          ? (topLevelProjects[topLevelProjects.length - 1]?.sort_order ?? 0) + 1024
          : 1024;

      patchProject.mutate({
        id: project.id as ProjectId,
        patch: { folder_id: null, sort_order: maxOrder },
      });

      const projectId = project.id as ProjectId;
      useUndoStore.getState().push({
        label: 'Project move',
        apply: () =>
          patchProject.mutate({
            id: projectId,
            patch: { folder_id: prior.folder_id as FolderId, sort_order: prior.sort_order },
          }),
      });

      snackbar.show({
        variant: 'success',
        text: `Project moved out of ${sourceFolderName}.`,
        durationMs: 5000,
        action: { label: 'Undo', onClick: () => useUndoStore.getState().pop() },
      });
      announce('Dropped onto top level.');
      return;
    }

    // Project reorder within same context
    if (activeData?.type === 'project' && overData?.type === 'project') {
      const project = projects.find((p) => p.id === activeId);
      const overProject = projects.find((p) => p.id === overId);
      if (!project || !overProject || activeId === overId) return;

      // Reorder among same folder_id group
      const sameGroup = projects
        .filter((p) => p.folder_id === project.folder_id)
        .sort((a, b) => a.sort_order - b.sort_order);
      const sortedOrders = sameGroup.filter((p) => p.id !== activeId).map((p) => p.sort_order);
      const overIndex = sameGroup.findIndex((p) => p.id === overId);
      const adjustedIndex = sameGroup[overIndex - 1]?.id === activeId ? overIndex - 1 : overIndex;

      const { value, needsRenumber } = computeNewSortOrder(sortedOrders, adjustedIndex);

      patchProject.mutate({ id: project.id as ProjectId, patch: { sort_order: value } });

      if (needsRenumber) {
        const newOrders = renumberList(sameGroup.length);
        const reordered = [...sameGroup.filter((p) => p.id !== activeId)];
        reordered.splice(adjustedIndex, 0, project);
        reordered.forEach((p, i) => {
          if (p.id !== activeId) {
            patchProject.mutate({
              id: p.id as ProjectId,
              patch: { sort_order: newOrders[i] ?? (i + 1) * 1024 },
            });
          }
        });
      }

      announce(`Dropped onto ${overProject.name}.`);
      return;
    }

    // Folder reorder
    if (activeData?.type === 'folder-sortable' && overData?.type === 'folder-sortable') {
      const activeFolderId = activeId.replace('folder-sortable:', '');
      const overFolderId = overId.replace('folder-sortable:', '');
      const folder = folders.find((f) => f.id === activeFolderId);
      const overFolder = folders.find((f) => f.id === overFolderId);
      if (!folder || !overFolder || activeFolderId === overFolderId) return;

      const sortedFolderList = [...folders].sort((a, b) => a.sort_order - b.sort_order);
      const sortedOrders = sortedFolderList.filter((f) => f.id !== activeFolderId).map((f) => f.sort_order);
      const overIndex = sortedFolderList.findIndex((f) => f.id === overFolderId);

      const { value, needsRenumber } = computeNewSortOrder(sortedOrders, overIndex);

      patchFolder.mutate({ id: folder.id as FolderId, patch: { sort_order: value } });

      if (needsRenumber) {
        const newOrders = renumberList(sortedFolderList.length);
        const reordered = [...sortedFolderList.filter((f) => f.id !== activeFolderId)];
        reordered.splice(overIndex, 0, folder);
        reordered.forEach((f, i) => {
          if (f.id !== activeFolderId) {
            patchFolder.mutate({
              id: f.id as FolderId,
              patch: { sort_order: newOrders[i] ?? (i + 1) * 1024 },
            });
          }
        });
      }

      announce(`Dropped onto ${overFolder.name}.`);
      return;
    }
  };

  const handleDragCancel = () => {
    stopAutoScroll();
    setActiveDragId(null);
    setActiveType(null);
    if (autoExpandTimerRef.current) {
      clearTimeout(autoExpandTimerRef.current);
      autoExpandTimerRef.current = null;
    }
    announce('Drag cancelled.');
  };

  const activeProject = activeDragId ? projects.find((p) => p.id === activeDragId) : null;
  const activeFolder = activeDragId ? folders.find((f) => `folder-sortable:${f.id}` === activeDragId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={allSortableIds} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>

      <DragOverlay>
        {activeProject ? (
          <DragOverlayContent>
            <div style={{ padding: '4px 8px', fontSize: 'var(--text-body-size, 14px)' }}>
              {activeProject.name}
            </div>
          </DragOverlayContent>
        ) : activeFolder ? (
          <DragOverlayContent>
            <div style={{ padding: '4px 8px', fontSize: 'var(--text-body-size, 14px)', fontWeight: 600 }}>
              {activeFolder.name}
            </div>
          </DragOverlayContent>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
