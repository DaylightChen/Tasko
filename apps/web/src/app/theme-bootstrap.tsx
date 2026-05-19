import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useConfig } from '../api/config';
import { useThemeStore } from '../store/theme';

interface Props {
  children: ReactNode;
}

export function ThemeBootstrap({ children }: Props) {
  const { preference } = useThemeStore();
  const { data: config } = useConfig();

  // Sync preference from server config on first load
  useEffect(() => {
    if (config?.theme && config.theme !== preference) {
      useThemeStore.getState().setPreference(config.theme);
    }
  }, [config?.theme, preference]);

  // Watch prefers-color-scheme if preference is 'system'
  useEffect(() => {
    if (preference !== 'system') {
      // Apply non-system preference immediately
      useThemeStore.getState().setPreference(preference);
      return;
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      useThemeStore.getState().setResolvedFromMedia(mq.matches);
    };
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [preference]);

  return <>{children}</>;
}
