import { create } from 'zustand';

interface QuickAddRefState {
  ref: HTMLInputElement | null;
  setRef: (ref: HTMLInputElement | null) => void;
}

export const useQuickAddRefStore = create<QuickAddRefState>((set) => ({
  ref: null,
  setRef: (ref) => set({ ref }),
}));
