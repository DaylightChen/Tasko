/**
 * Integration smoke tests for the Notes field in TaskModal (task-13).
 * Covers:
 * - Opening modal with markdown notes → preview renders formatted output.
 * - Clicking preview → switches to textarea with raw markdown value.
 * - Typing new markdown + blurring → preview re-renders with updated text.
 * - Save → PATCH body includes updated notes.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Item, ItemId, ItemPatch, LocalDate, ProjectId } from '@tasko/types';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

vi.mock('../../../api/items', () => ({
  useDeleteItem: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue({ trashed: [] }),
    isPending: false,
  }),
  useCreateItem: vi.fn(),
  usePatchItem: vi.fn(),
  useItem: vi.fn(),
  useItems: vi.fn(),
  useCreateSubtask: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  usePatchSubtask: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useDeleteSubtask: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

vi.mock('../../../api/tags', () => ({
  useCreateTag: vi.fn(),
  useTags: vi.fn(),
  useTagAutocomplete: vi.fn().mockReturnValue({ data: { tags: [] } }),
}));

vi.mock('../../../api/config', () => ({
  useConfig: vi.fn(),
}));

vi.mock('../../../api/projects', () => ({
  useProjects: vi.fn(),
}));

vi.mock('../../../api/folders', () => ({
  useFolders: vi.fn(),
}));

vi.mock('../../../lib/use-is-mobile', () => ({
  useIsMobile: vi.fn().mockReturnValue(false),
}));

import { useConfig } from '../../../api/config';
import { useFolders } from '../../../api/folders';
import { useCreateItem, useItem, usePatchItem } from '../../../api/items';
import { useProjects } from '../../../api/projects';
import { useCreateTag, useTags } from '../../../api/tags';
import { useTaskModalStore } from '../../../store/task-modal';
import { TaskModal } from '../index';

// ---- Factories ----

function makeProject(id: string, name: string) {
  return {
    id: id as ProjectId,
    schema_version: 1 as const,
    name,
    folder_id: null,
    is_hierarchical: false,
    color: null,
    icon: null,
    sort_order: 0,
    is_inbox: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

const WORK_PROJECT = makeProject('01ARZ3NDEKTSV4RRFFQ69G5FAV', 'Work');

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: '01ARZ3NDEKTSV4RRFFQ69G5FAV' as ItemId,
    schema_version: 1,
    type: 'task',
    project_id: WORK_PROJECT.id,
    parent_id: null,
    title: 'Existing Task',
    notes: '',
    due_date: '2026-06-01' as LocalDate,
    start_date: null,
    due_time: null,
    priority: 'none',
    status: 'todo',
    tags: [],
    subtasks: [],
    recurrence: null,
    completed_at: null,
    trashed_at: null,
    trashed_with: null,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ---- Setup ----

let patchMutateAsync: ReturnType<typeof vi.fn>;

function setupDefaultMocks(item?: Item) {
  vi.mocked(useConfig).mockReturnValue({
    data: { schema_version: 1, theme: 'system', week_start: 'mon', last_modified: '2026-01-01T00:00:00Z' },
  } as unknown as ReturnType<typeof useConfig>);

  vi.mocked(useProjects).mockReturnValue({
    data: { projects: [WORK_PROJECT] },
  } as unknown as ReturnType<typeof useProjects>);

  vi.mocked(useFolders).mockReturnValue({
    data: { folders: [] },
  } as unknown as ReturnType<typeof useFolders>);

  vi.mocked(useTags).mockReturnValue({
    data: { tags: [] },
  } as unknown as ReturnType<typeof useTags>);

  vi.mocked(useItem).mockReturnValue({
    data: item ?? undefined,
    isLoading: false,
  } as unknown as ReturnType<typeof useItem>);

  vi.mocked(useCreateItem).mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue(makeItem()),
    isPending: false,
  } as unknown as ReturnType<typeof useCreateItem>);

  patchMutateAsync = vi.fn().mockResolvedValue(makeItem());
  vi.mocked(usePatchItem).mockReturnValue({
    mutateAsync: patchMutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof usePatchItem>);

  vi.mocked(useCreateTag).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useCreateTag>);
}

function renderTaskModal() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TaskModal />
    </QueryClientProvider>,
  );
}

function openEditModal(id: string) {
  const store = useTaskModalStore.getState();
  act(() => {
    store.openEdit(id as ItemId);
  });
}

// ---- Tests ----

describe('TaskModal — Notes field with markdown (task-13)', () => {
  beforeEach(() => {
    act(() => {
      useTaskModalStore.getState().close();
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    act(() => {
      useTaskModalStore.getState().close();
    });
  });

  it('preview renders <strong> when notes contains **hi**', async () => {
    const item = makeItem({ notes: '**hi**' });
    setupDefaultMocks(item);
    renderTaskModal();
    openEditModal(item.id);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // "More" is auto-expanded when notes is set (per task-modal index.tsx logic)
    await waitFor(() => {
      // The Notes preview region should contain a <strong>hi</strong>
      const previewRegion = screen.getByRole('region', { name: /notes preview/i });
      const strong = previewRegion.querySelector('strong');
      expect(strong).not.toBeNull();
      expect(strong?.textContent).toBe('hi');
    });
  });

  it('clicking the Notes preview switches to textarea with raw markdown', async () => {
    const item = makeItem({ notes: '**hi**' });
    setupDefaultMocks(item);
    renderTaskModal();
    openEditModal(item.id);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /notes preview/i })).toBeInTheDocument();
    });

    const preview = screen.getByRole('region', { name: /notes preview/i });
    await act(async () => {
      fireEvent.click(preview);
    });

    await waitFor(() => {
      const ta = screen.getByRole('textbox', { name: /notes/i }) as HTMLTextAreaElement;
      expect(ta).toBeInTheDocument();
      expect(ta.value).toBe('**hi**');
    });
  });

  it('typing in notes textarea and blurring re-renders preview with new content', async () => {
    const item = makeItem({ notes: '**hi**' });
    setupDefaultMocks(item);

    // We need to intercept onChange so we can test controlled rendering
    // The TaskModal manages its own form state, so we just drive the DOM
    renderTaskModal();
    openEditModal(item.id);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /notes preview/i })).toBeInTheDocument();
    });

    // Enter edit mode
    await act(async () => {
      fireEvent.click(screen.getByRole('region', { name: /notes preview/i }));
    });

    const ta = await waitFor(() => screen.getByRole('textbox', { name: /notes/i }) as HTMLTextAreaElement);

    // Type new content
    await act(async () => {
      fireEvent.change(ta, { target: { value: '**updated**' } });
    });

    // Blur the textarea → should switch back to preview
    await act(async () => {
      fireEvent.blur(ta);
    });

    await waitFor(() => {
      const previewRegion = screen.getByRole('region', { name: /notes preview/i });
      const strong = previewRegion.querySelector('strong');
      expect(strong).not.toBeNull();
      expect(strong?.textContent).toBe('updated');
    });
  });

  it('Save includes updated notes value in PATCH body', async () => {
    const item = makeItem({ notes: '**hi**' });
    setupDefaultMocks(item);
    renderTaskModal();
    openEditModal(item.id);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /notes preview/i })).toBeInTheDocument();
    });

    // Click preview to enter edit mode
    await act(async () => {
      fireEvent.click(screen.getByRole('region', { name: /notes preview/i }));
    });

    const ta = await waitFor(() => screen.getByRole('textbox', { name: /notes/i }) as HTMLTextAreaElement);

    // Update notes
    await act(async () => {
      fireEvent.change(ta, { target: { value: '**updated notes**' } });
    });

    // Click Save
    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => {
      expect(patchMutateAsync).toHaveBeenCalledTimes(1);
    });

    const patchArg = patchMutateAsync.mock.calls[0]?.[0] as { id: ItemId; patch: ItemPatch };
    expect(patchArg).toBeDefined();
    expect(patchArg.patch.notes).toBe('**updated notes**');
  });
});
