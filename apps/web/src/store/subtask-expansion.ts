import type { ItemId } from '@tasko/types';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const LS_KEY = 'tasko.subtaskExpanded';

interface SubtaskExpansionState {
  expanded: Record<string, boolean>;
  isExpanded: (itemId: ItemId) => boolean;
  toggle: (itemId: ItemId) => void;
}

export const useSubtaskExpansionStore = create<SubtaskExpansionState>()(
  persist(
    (set, get) => ({
      expanded: {},

      isExpanded: (itemId) => get().expanded[itemId] === true,

      toggle: (itemId) => {
        set((state) => {
          const next = { ...state.expanded };
          if (next[itemId]) {
            delete next[itemId];
          } else {
            next[itemId] = true;
          }
          return { expanded: next };
        });
      },
    }),
    {
      name: LS_KEY,
      partialize: (state) => ({ expanded: state.expanded }),
    },
  ),
);
