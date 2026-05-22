import { create } from 'zustand';

export interface UndoEntry {
  id: string;
  label: string;
  apply: () => void | Promise<void>;
}

interface UndoState {
  current: UndoEntry | null;
  _timerId: ReturnType<typeof setTimeout> | null;
  push: (entry: Omit<UndoEntry, 'id'>) => void;
  pop: () => void;
  clear: () => void;
}

export const useUndoStore = create<UndoState>((set, get) => ({
  current: null,
  _timerId: null,

  push: (entry) => {
    const { _timerId } = get();
    if (_timerId !== null) clearTimeout(_timerId);

    const id = crypto.randomUUID();
    const timerId = setTimeout(() => {
      set({ current: null, _timerId: null });
    }, 5000);

    set({ current: { ...entry, id }, _timerId: timerId });
  },

  pop: () => {
    const { current, _timerId } = get();
    if (!current) return;
    if (_timerId !== null) clearTimeout(_timerId);
    set({ current: null, _timerId: null });
    void current.apply();
  },

  clear: () => {
    const { _timerId } = get();
    if (_timerId !== null) clearTimeout(_timerId);
    set({ current: null, _timerId: null });
  },
}));
