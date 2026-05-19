/**
 * keyboard-help-from-palette.test.tsx
 *
 * Verifies: opening the command palette and selecting "View keyboard shortcuts"
 * triggers useShortcutHelpStore.show().
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../api/projects', () => ({
  useProjects: vi.fn(() => ({ data: { projects: [] } })),
}));
vi.mock('../../api/tags', () => ({
  useTags: vi.fn(() => ({ data: { tags: [] } })),
}));
vi.mock('../../api/config', () => ({
  useConfig: vi.fn(() => ({ data: { theme: 'system' } })),
  useUpdateConfig: vi.fn(() => ({ mutate: vi.fn() })),
}));
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { CommandPalette } from '../../components/command-palette';
import { useHotkeyStore } from '../../store/hotkey-registry';
import { useShortcutHelpStore } from '../../store/shortcut-help';

// ── Helpers ───────────────────────────────────────────────────────────────────

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('Command palette → View keyboard shortcuts', () => {
  beforeEach(() => {
    useHotkeyStore.getState().reset();
    useShortcutHelpStore.setState({ open: false });
    localStorage.clear();
  });

  afterEach(() => {
    useHotkeyStore.getState().reset();
    useShortcutHelpStore.setState({ open: false });
    localStorage.clear();
  });

  it('opens the shortcut help overlay when "View keyboard shortcuts" is selected', async () => {
    const onClose = vi.fn();

    render(
      <Wrapper>
        <CommandPalette
          open={true}
          onClose={onClose}
          navigate={vi.fn()}
          openTaskModal={vi.fn()}
          openProjectModal={vi.fn()}
          openFolderModal={vi.fn()}
          openSettings={vi.fn()}
          currentTheme="system"
          switchTheme={vi.fn()}
        />
      </Wrapper>,
    );

    // Search to ensure the item is visible
    const input = screen.getByPlaceholderText('Type a command…');
    act(() => {
      fireEvent.change(input, { target: { value: 'keyboard shortcuts' } });
    });

    const item = await screen.findByText('View keyboard shortcuts');
    act(() => {
      fireEvent.click(item);
    });

    expect(onClose).toHaveBeenCalled();
    // The action fires after a slight defer
    await waitFor(() => expect(useShortcutHelpStore.getState().open).toBe(true));
  });
});
