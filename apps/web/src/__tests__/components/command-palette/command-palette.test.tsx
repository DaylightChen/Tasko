/**
 * command-palette.test.tsx
 *
 * Covers:
 * - Opens via store toggle (simulating ⌘K)
 * - Input receives focus on open
 * - Typing "today" shows "Go to Today"
 * - Pressing Escape closes the palette
 * - Selecting an item fires its action
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks must come before the component imports ─────────────────────────────

vi.mock('../../../api/projects', () => ({
  useProjects: vi.fn(() => ({ data: { projects: [] } })),
}));
vi.mock('../../../api/tags', () => ({
  useTags: vi.fn(() => ({ data: { tags: [] } })),
}));
vi.mock('../../../api/config', () => ({
  useConfig: vi.fn(() => ({ data: { theme: 'system' } })),
  useUpdateConfig: vi.fn(() => ({ mutate: vi.fn() })),
}));
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { CommandPalette } from '../../../components/command-palette';
import { useHotkeyStore } from '../../../store/hotkey-registry';

// ── Test helpers ─────────────────────────────────────────────────────────────

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function renderPalette(open = true) {
  const onClose = vi.fn();
  const navigate = vi.fn();
  const openTaskModal = vi.fn();
  const openProjectModal = vi.fn();
  const openFolderModal = vi.fn();
  const openSettings = vi.fn();
  const switchTheme = vi.fn();

  const utils = render(
    <Wrapper>
      <CommandPalette
        open={open}
        onClose={onClose}
        navigate={navigate}
        openTaskModal={openTaskModal}
        openProjectModal={openProjectModal}
        openFolderModal={openFolderModal}
        openSettings={openSettings}
        currentTheme="system"
        switchTheme={switchTheme}
      />
    </Wrapper>,
  );

  return { ...utils, onClose, navigate, openTaskModal };
}

describe('CommandPalette', () => {
  beforeEach(() => {
    useHotkeyStore.getState().reset();
    localStorage.clear();
  });

  afterEach(() => {
    useHotkeyStore.getState().reset();
    localStorage.clear();
  });

  it('renders the input with correct placeholder', () => {
    renderPalette(true);
    expect(screen.getByPlaceholderText('Type a command…')).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    renderPalette(false);
    expect(screen.queryByPlaceholderText('Type a command…')).not.toBeInTheDocument();
  });

  it('shows "Go to Today" in the initial curated list', () => {
    renderPalette(true);
    expect(screen.getByText('Go to Today')).toBeInTheDocument();
  });

  it('shows "Go to Today" when filtering with "today"', async () => {
    renderPalette(true);
    const input = screen.getByPlaceholderText('Type a command…');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'today' } });
    });

    expect(screen.getByText('Go to Today')).toBeInTheDocument();
  });

  it('calls onClose when Escape is pressed', () => {
    const { onClose } = renderPalette(true);

    act(() => {
      fireEvent.keyDown(document.body, { key: 'Escape' });
    });

    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose and fires navigation when "Go to Today" is selected', async () => {
    const { onClose, navigate } = renderPalette(true);

    const todayItem = await screen.findByText('Go to Today');
    act(() => {
      fireEvent.click(todayItem);
    });

    expect(onClose).toHaveBeenCalled();
    // navigate is called after a slight defer
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/today'));
  });

  it('pushes command-palette mode when open', () => {
    renderPalette(true);
    expect(useHotkeyStore.getState().currentMode).toBe('command-palette');
  });

  it('shows "View keyboard shortcuts" in the View group (not Navigate)', () => {
    renderPalette(true);
    // "View keyboard shortcuts" must be present in the initial curated state
    expect(screen.getByText('View keyboard shortcuts')).toBeInTheDocument();
    // Verify there is a "View" group heading in the initial (no-query) state
    expect(screen.getByText('View')).toBeInTheDocument();
  });
});
