import type { ItemId } from '@tasko/types';
import { create } from 'zustand';

export type MultiSelectScope = 'list' | 'tree' | 'kanban-column' | 'trash' | null;

interface MultiSelectState {
  set: Set<ItemId>;
  scope: MultiSelectScope;
  anchor: ItemId | null;

  add: (id: ItemId, scope: MultiSelectScope) => void;
  toggle: (id: ItemId) => void;
  remove: (id: ItemId) => void;
  clear: () => void;
  setAnchor: (id: ItemId) => void;
  /**
   * Range-select from anchor to the given id using visibleIds to determine order.
   * If no anchor is set, simply selects the given id.
   */
  selectRange: (toId: ItemId, visibleIds: ItemId[]) => void;
}

export const useMultiSelectStore = create<MultiSelectState>((set, get) => ({
  set: new Set<ItemId>(),
  scope: null,
  anchor: null,

  add: (id, scope) => {
    set((state) => {
      const next = new Set(state.set);
      next.add(id);
      return { set: next, scope, anchor: id };
    });
  },

  toggle: (id) => {
    set((state) => {
      const next = new Set(state.set);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { set: next };
    });
  },

  remove: (id) => {
    set((state) => {
      const next = new Set(state.set);
      next.delete(id);
      return { set: next };
    });
  },

  clear: () => {
    set({ set: new Set<ItemId>(), scope: null, anchor: null });
  },

  setAnchor: (id) => {
    set({ anchor: id });
  },

  selectRange: (toId, visibleIds) => {
    const { anchor } = get();
    if (!anchor) {
      set((state) => {
        const next = new Set(state.set);
        next.add(toId);
        return { set: next, anchor: toId };
      });
      return;
    }

    const fromIdx = visibleIds.indexOf(anchor);
    const toIdx = visibleIds.indexOf(toId);
    if (fromIdx === -1 || toIdx === -1) {
      set((state) => {
        const next = new Set(state.set);
        next.add(toId);
        return { set: next };
      });
      return;
    }

    const start = Math.min(fromIdx, toIdx);
    const end = Math.max(fromIdx, toIdx);
    const rangeIds = visibleIds.slice(start, end + 1);

    set((state) => {
      const next = new Set(state.set);
      for (const id of rangeIds) {
        next.add(id);
      }
      return { set: next };
    });
  },
}));
