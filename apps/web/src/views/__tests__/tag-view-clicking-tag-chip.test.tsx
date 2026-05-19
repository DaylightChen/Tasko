/**
 * tag-view-clicking-tag-chip.test.tsx
 *
 * Covers:
 * - From the Today view, clicking a tag chip on a row navigates to
 *   /tag/${tag.name_lower} via the useTagNavigation hook.
 * - The useNavigate mock captures the navigation call.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Item, ItemId, LocalDate, TagId } from '@tasko/types';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const navigateMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string; [k: string]: unknown }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useRouterState: () => ({ location: { pathname: '/today' } }),
  useNavigate: () => navigateMock,
}));

vi.mock('../../api/items', () => ({
  useItems: vi.fn(),
  useToggleComplete: vi.fn(),
  useReschedule: vi.fn(),
  useChangePriority: vi.fn(),
  useEditTitleInline: vi.fn(),
  useDeleteItem: vi.fn(),
  useBulkMoveOverdue: vi.fn(),
  usePatchItem: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn() })),
}));

vi.mock('../../api/projects', () => ({ useProjects: vi.fn() }));
vi.mock('../../api/folders', () => ({ useFolders: vi.fn() }));
vi.mock('../../api/config', () => ({ useConfig: vi.fn() }));
vi.mock('../../api/tags', () => ({ useTags: vi.fn() }));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { useFolders } from '../../api/folders';
import {
  useBulkMoveOverdue,
  useChangePriority,
  useDeleteItem,
  useEditTitleInline,
  useItems,
  useReschedule,
  useToggleComplete,
} from '../../api/items';
import { useProjects } from '../../api/projects';
import { useTags } from '../../api/tags';
import { TodayView } from '../today-view/index';

// ── Helpers ────────────────────────────────────────────────────────────────────

const TODAY = '2026-05-19' as LocalDate;
const URGENT_TAG_ID = 'tag-urgent-01' as TagId;

const noopMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'tagged-task-1' as ItemId,
    schema_version: 1,
    type: 'task',
    project_id: 'proj-1' as Item['project_id'],
    parent_id: null,
    title: 'Tagged Task',
    notes: '',
    due_date: TODAY,
    start_date: null,
    due_time: null,
    priority: 'none',
    status: 'todo',
    tags: [URGENT_TAG_ID],
    subtasks: [],
    recurrence: null,
    completed_at: null,
    trashed_at: null,
    trashed_with: null,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: TODAY,
    ...overrides,
  };
}

function setupMocks(items: Item[]) {
  vi.mocked(useItems).mockReturnValue({
    data: { items, count: items.length },
    isLoading: false,
  } as unknown as ReturnType<typeof useItems>);

  vi.mocked(useToggleComplete).mockReturnValue(
    noopMutation as unknown as ReturnType<typeof useToggleComplete>,
  );
  vi.mocked(useReschedule).mockReturnValue(noopMutation as unknown as ReturnType<typeof useReschedule>);
  vi.mocked(useChangePriority).mockReturnValue(
    noopMutation as unknown as ReturnType<typeof useChangePriority>,
  );
  vi.mocked(useEditTitleInline).mockReturnValue(
    noopMutation as unknown as ReturnType<typeof useEditTitleInline>,
  );
  vi.mocked(useDeleteItem).mockReturnValue(noopMutation as unknown as ReturnType<typeof useDeleteItem>);
  vi.mocked(useBulkMoveOverdue).mockReturnValue(
    noopMutation as unknown as ReturnType<typeof useBulkMoveOverdue>,
  );

  vi.mocked(useProjects).mockReturnValue({ data: { projects: [] } } as unknown as ReturnType<
    typeof useProjects
  >);
  vi.mocked(useFolders).mockReturnValue({ data: { folders: [] } } as unknown as ReturnType<
    typeof useFolders
  >);

  // Provide the tag so useTagNavigation can resolve tagId → name_lower
  vi.mocked(useTags).mockReturnValue({
    data: {
      tags: [
        {
          id: URGENT_TAG_ID,
          name: 'Urgent',
          name_lower: 'urgent',
          color: null,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ],
    },
  } as unknown as ReturnType<typeof useTags>);
}

function renderTodayView(items: Item[]) {
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
  setupMocks(items);

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <TodayView />
    </QueryClientProvider>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Tag chip navigation — from TodayView', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    navigateMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    act(() => {});
  });

  it('clicking a tag chip calls useNavigate to /tag/${name_lower}', () => {
    const item = makeItem();
    renderTodayView([item]);

    // Tag chips are always present in the DOM (not hover-only). Use getByRole so
    // a future regression where the chip disappears causes a clear test failure.
    const tagChip = screen.getByRole('button', { name: /filter by tag/i });

    fireEvent.click(tagChip);

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/tag/$name',
      params: { name: 'urgent' },
    });
  });

  it('useTagNavigation resolves tagId to tag.name_lower for navigation', () => {
    // Verify the hook logic: given a tagId, it should look up the tag and navigate
    // to /tag/$name with params.name = tag.name_lower.
    const item = makeItem({ tags: [URGENT_TAG_ID] });
    renderTodayView([item]);

    // Tag chips are always in the DOM — use getAllByRole so a missing chip fails loudly.
    const [firstTagButton] = screen.getAllByRole('button', { name: /filter by tag/i });
    expect(firstTagButton).toBeDefined();
    if (firstTagButton) {
      fireEvent.click(firstTagButton);
    }
    expect(navigateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/tag/$name',
        params: { name: 'urgent' },
      }),
    );
  });

  it('tag chip navigation uses name_lower (not raw id or uppercase)', () => {
    // name_lower is 'urgent'; tag.name is 'Urgent' (uppercase)
    const item = makeItem({ tags: [URGENT_TAG_ID] });
    renderTodayView([item]);

    // Tag chips are always in the DOM — assert they exist and click.
    const [firstTagButton] = screen.getAllByRole('button', { name: /filter by tag/i });
    expect(firstTagButton).toBeDefined();
    if (firstTagButton) {
      fireEvent.click(firstTagButton);
    }

    // Should navigate to lowercase 'urgent', not 'Urgent'
    expect(navigateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        params: { name: 'urgent' },
      }),
    );
    expect(navigateMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        params: { name: 'Urgent' },
      }),
    );
  });
});
