import { create } from 'zustand';

interface FocusedRowState {
  focusedId: string | null;
  setFocusedId: (id: string | null) => void;
  clear: () => void;
}

export const useFocusedRowStore = create<FocusedRowState>((set) => ({
  focusedId: null,
  setFocusedId: (id) => set({ focusedId: id }),
  clear: () => set({ focusedId: null }),
}));
