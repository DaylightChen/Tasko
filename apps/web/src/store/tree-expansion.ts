import type { ItemId, ProjectId } from '@tasko/types';
import { create } from 'zustand';

/**
 * Per-project per-item expansion map.
 * Default: top-level items (Epics) are expanded; others collapsed.
 * Not persisted (in-memory for v1).
 */
interface TreeExpansionState {
  /** { [projectId]: { [itemId]: boolean } } */
  expanded: Record<string, Record<string, boolean>>;

  isExpanded: (projectId: ProjectId, itemId: ItemId) => boolean;
  setExpanded: (projectId: ProjectId, itemId: ItemId, value: boolean) => void;
  toggle: (projectId: ProjectId, itemId: ItemId) => void;
  /**
   * Initialise defaults for a project. Called once when the tree view
   * mounts with the full item list — expands all top-level items.
   */
  initProject: (projectId: ProjectId, topLevelItemIds: ItemId[]) => void;
}

export const useTreeExpansionStore = create<TreeExpansionState>((set, get) => ({
  expanded: {},

  isExpanded: (projectId, itemId) => {
    return get().expanded[projectId]?.[itemId] ?? false;
  },

  setExpanded: (projectId, itemId, value) => {
    set((state) => ({
      expanded: {
        ...state.expanded,
        [projectId]: {
          ...(state.expanded[projectId] ?? {}),
          [itemId]: value,
        },
      },
    }));
  },

  toggle: (projectId, itemId) => {
    const current = get().isExpanded(projectId, itemId);
    get().setExpanded(projectId, itemId, !current);
  },

  initProject: (projectId, topLevelItemIds) => {
    const current = get().expanded[projectId];
    // Only initialise once (don't clobber user choices on re-render).
    if (current !== undefined) return;

    const defaults: Record<string, boolean> = {};
    for (const id of topLevelItemIds) {
      defaults[id] = true; // top-level items default to expanded
    }
    set((state) => ({
      expanded: {
        ...state.expanded,
        [projectId]: defaults,
      },
    }));
  },
}));
