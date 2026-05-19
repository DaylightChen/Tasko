import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CommandPaletteHost } from './app/command-palette-host';
import { ErrorBoundary } from './app/error-boundary';
import { HotkeyProvider } from './app/hotkey-provider';
import { SSEConnector } from './app/sse-connector';
import { ThemeBootstrap } from './app/theme-bootstrap';
import { SnackbarHost } from './components/snackbar/host';
import { routeTree } from './routeTree.gen';
import './styles/tokens.css';
import './styles/base.css';
import './styles/theme.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: (n) => n < 3,
    },
    mutations: {
      retry: 0,
    },
  },
});

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeBootstrap>
          <HotkeyProvider>
            <SSEConnector />
            <SnackbarHost />
            <CommandPaletteHost />
            <RouterProvider router={router} />
          </HotkeyProvider>
        </ThemeBootstrap>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
