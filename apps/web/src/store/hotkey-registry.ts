import { create } from 'zustand';

export type HotkeyMode =
  | 'no-input'
  | 'input'
  | 'modal'
  | 'sheet'
  | 'calendar'
  | 'kanban'
  | 'tree'
  | 'command-palette'
  | 'tag-input'
  | 'date-picker';

interface HotkeyState {
  modeStack: HotkeyMode[];
  currentMode: HotkeyMode;
  push: (m: HotkeyMode) => void;
  pop: () => void;
  reset: () => void;
}

function deriveMode(stack: HotkeyMode[]): HotkeyMode {
  return stack.length > 0 ? (stack[stack.length - 1] as HotkeyMode) : 'no-input';
}

export const useHotkeyStore = create<HotkeyState>((set) => ({
  modeStack: [],
  currentMode: 'no-input',

  push: (m) =>
    set((state) => {
      const next = [...state.modeStack, m];
      return { modeStack: next, currentMode: deriveMode(next) };
    }),

  pop: () =>
    set((state) => {
      const next = state.modeStack.slice(0, -1);
      return { modeStack: next, currentMode: deriveMode(next) };
    }),

  reset: () => set({ modeStack: [], currentMode: 'no-input' }),
}));
