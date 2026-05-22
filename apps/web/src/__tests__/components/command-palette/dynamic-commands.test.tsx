/**
 * dynamic-commands.test.tsx
 *
 * Verifies that dynamic "Go to <Project>" and "Go to #<tag>" commands
 * appear in the palette when projects/tags exist.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Project, Tag } from '@tasko/types';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockProjects: Partial<Project>[] = [
  {
    id: 'proj1' as unknown as Project['id'],
    name: 'Alpha Project',
    is_inbox: false,
    folder_id: null,
    color: null,
    icon: null,
    is_hierarchical: false,
    sort_order: 0,
    schema_version: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'proj2' as unknown as Project['id'],
    name: 'Beta Project',
    is_inbox: false,
    folder_id: null,
    color: null,
    icon: null,
    is_hierarchical: false,
    sort_order: 1,
    schema_version: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

const mockTags: Partial<Tag>[] = [
  {
    id: 'tag1' as unknown as Tag['id'],
    name: 'urgent',
    name_lower: 'urgent',
    color: null,
    schema_version: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

vi.mock('../../../api/projects', () => ({
  useProjects: vi.fn(() => ({ data: { projects: mockProjects } })),
}));
vi.mock('../../../api/tags', () => ({
  useTags: vi.fn(() => ({ data: { tags: mockTags } })),
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

// ── Helpers ───────────────────────────────────────────────────────────────────

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('CommandPalette — dynamic commands', () => {
  beforeEach(() => {
    useHotkeyStore.getState().reset();
    localStorage.clear();
  });

  afterEach(() => {
    useHotkeyStore.getState().reset();
    localStorage.clear();
  });

  it('shows "Go to <Project>" for each project when searching', async () => {
    render(
      <Wrapper>
        <CommandPalette
          open={true}
          onClose={vi.fn()}
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

    const input = screen.getByPlaceholderText('Type a command…');
    act(() => {
      fireEvent.change(input, { target: { value: 'Alpha' } });
    });

    expect(await screen.findByText('Go to Alpha Project')).toBeInTheDocument();
  });

  it('shows "Go to #<tag>" for each tag when searching', async () => {
    render(
      <Wrapper>
        <CommandPalette
          open={true}
          onClose={vi.fn()}
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

    const input = screen.getByPlaceholderText('Type a command…');
    act(() => {
      fireEvent.change(input, { target: { value: 'urgent' } });
    });

    expect(await screen.findByText('Go to #urgent')).toBeInTheDocument();
  });

  it('shows "Go to Beta Project" for second project', async () => {
    render(
      <Wrapper>
        <CommandPalette
          open={true}
          onClose={vi.fn()}
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

    const input = screen.getByPlaceholderText('Type a command…');
    act(() => {
      fireEvent.change(input, { target: { value: 'Beta' } });
    });

    expect(await screen.findByText('Go to Beta Project')).toBeInTheDocument();
  });
});
