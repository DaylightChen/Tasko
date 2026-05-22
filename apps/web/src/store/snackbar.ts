import { create } from 'zustand';

export type SnackbarVariant = 'success' | 'info' | 'restored' | 'error' | 'depth-cap';

export interface SnackbarItem {
  id: string;
  variant: SnackbarVariant;
  text: string;
  action?: { label: string; onClick: () => void };
  durationMs: number;
}

interface SnackbarState {
  current: SnackbarItem | null;
  queue: SnackbarItem[];
  show: (item: Omit<SnackbarItem, 'id'>) => void;
  dismiss: () => void;
  _advance: () => void;
}

export const useSnackbarStore = create<SnackbarState>((set, get) => ({
  current: null,
  queue: [],
  show: (item) => {
    const id = crypto.randomUUID();
    const full: SnackbarItem = { ...item, id };
    const { current } = get();
    if (!current) {
      set({ current: full });
    } else {
      set((state) => ({ queue: [...state.queue.slice(0, 1), full] }));
    }
  },
  dismiss: () => {
    get()._advance();
  },
  _advance: () => {
    const { queue } = get();
    if (queue.length > 0) {
      const [next, ...rest] = queue;
      set({ current: next ?? null, queue: rest });
    } else {
      set({ current: null });
    }
  },
}));
