import type { Theme } from '@tasko/types';
import { create } from 'zustand';

type ResolvedTheme = 'light' | 'dark';

interface ThemeState {
  preference: Theme;
  resolved: ResolvedTheme;
  setPreference: (p: Theme) => void;
  setResolvedFromMedia: (matches: boolean) => void;
}

function computeResolved(preference: Theme): ResolvedTheme {
  if (preference === 'system') {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return preference;
}

export const useThemeStore = create<ThemeState>((set) => ({
  preference: 'system',
  resolved: 'light',
  setPreference: (p) => {
    const resolved = computeResolved(p);
    set({ preference: p, resolved });
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = resolved;
    }
  },
  setResolvedFromMedia: (matches) => {
    const resolved: ResolvedTheme = matches ? 'dark' : 'light';
    set({ resolved });
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = resolved;
    }
  },
}));
