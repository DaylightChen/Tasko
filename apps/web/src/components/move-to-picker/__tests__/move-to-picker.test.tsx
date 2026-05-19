/**
 * MoveToPickerModal tests (task-09)
 *
 * Covers:
 * - Renders a list of candidate destinations
 * - Typing filters candidates by label
 * - Selecting a valid candidate calls onMove with correct args
 * - An invalid candidate (self/descendant) is aria-disabled and clicking does nothing
 * - An invalid candidate (would exceed depth cap) is disabled
 */
import type { Item, ItemId, LocalDate, ProjectId } from '@tasko/types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../api/projects', () => ({ useProjects: vi.fn() }));

import { useProjects } from '../../../api/projects';
import { MoveToPickerModal } from '../index';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TODAY = '2026-05-19' as LocalDate;
const PROJ_A = 'proj-a' as ProjectId;
const PROJ_B = 'proj-b' as ProjectId;

function makeItem(
  id: string,
  overrides: {
    type?: Item['type'];
    parent_id?: ItemId | null;
    project_id?: ProjectId;
    title?: string;
    status?: Item['status'];
    trashed_at?: string | null;
  } = {},
): Item {
  return {
    id: id as ItemId,
    schema_version: 1,
    type: overrides.type ?? 'task',
    project_id: overrides.project_id ?? PROJ_A,
    parent_id: overrides.parent_id ?? null,
    title: overrides.title ?? id,
    notes: '',
    due_date: TODAY,
    start_date: null,
    due_time: null,
    priority: 'none',
    status: overrides.status ?? 'todo',
    tags: [],
    subtasks: [],
    recurrence: null,
    completed_at: null,
    trashed_at: (overrides.trashed_at ?? null) as string | null,
    trashed_with: null,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

function buildItemsMap(items: Item[]): Map<ItemId, Item> {
  const map = new Map<ItemId, Item>();
  for (const item of items) map.set(item.id, item);
  return map;
}

function setupProjectsMock() {
  vi.mocked(useProjects).mockReturnValue({
    data: {
      projects: [
        {
          id: PROJ_A,
          name: 'Project A',
          folder_id: null,
          is_hierarchical: true,
          color: null,
          icon: null,
          sort_order: 0,
          created_at: '',
          updated_at: '',
        },
        {
          id: PROJ_B,
          name: 'Project B',
          folder_id: null,
          is_hierarchical: false,
          color: null,
          icon: null,
          sort_order: 1,
          created_at: '',
          updated_at: '',
        },
      ],
    },
    isLoading: false,
  } as unknown as ReturnType<typeof useProjects>);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MoveToPickerModal', () => {
  it('renders the modal title "Move to…"', () => {
    setupProjectsMock();
    const source = makeItem('source-task', { type: 'task' });
    const items = buildItemsMap([source]);

    render(<MoveToPickerModal source={source} items={items} onClose={vi.fn()} onMove={vi.fn()} />);

    expect(screen.getByText('Move to…')).toBeTruthy();
  });

  it('renders project roots as candidates', () => {
    setupProjectsMock();
    const source = makeItem('source-task', { type: 'task' });
    const items = buildItemsMap([source]);

    render(<MoveToPickerModal source={source} items={items} onClose={vi.fn()} onMove={vi.fn()} />);

    expect(screen.getByText('Project A')).toBeTruthy();
    expect(screen.getByText('Project B')).toBeTruthy();
  });

  it('renders Epic and Feature items from the items map as candidates', () => {
    setupProjectsMock();
    const source = makeItem('source-task', { type: 'task', parent_id: 'feat-1' as ItemId });
    const epic = makeItem('epic-1', { type: 'epic', title: 'My Epic' });
    const feat = makeItem('feat-1', { type: 'feature', title: 'My Feature', parent_id: 'epic-1' as ItemId });
    const items = buildItemsMap([source, epic, feat]);

    render(<MoveToPickerModal source={source} items={items} onClose={vi.fn()} onMove={vi.fn()} />);

    expect(screen.getByText('My Epic')).toBeTruthy();
    expect(screen.getByText('My Feature')).toBeTruthy();
  });

  it('filtering by text hides non-matching candidates', async () => {
    setupProjectsMock();
    const source = makeItem('source-task', { type: 'task' });
    const epic = makeItem('epic-1', { type: 'epic', title: 'Marketing Epic' });
    const feat = makeItem('feat-1', {
      type: 'feature',
      title: 'Engineering Feature',
      parent_id: 'epic-1' as ItemId,
    });
    const items = buildItemsMap([source, epic, feat]);

    render(<MoveToPickerModal source={source} items={items} onClose={vi.fn()} onMove={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText(/search projects and items/i);
    fireEvent.change(searchInput, { target: { value: 'marketing' } });

    await waitFor(() => {
      expect(screen.getByText('Marketing Epic')).toBeTruthy();
      expect(screen.queryByText('Engineering Feature')).toBeNull();
    });
  });

  it('selecting a valid candidate calls onMove with new_parent_id and new_project_id', async () => {
    setupProjectsMock();
    const onMove = vi.fn();
    const source = makeItem('source-task', { type: 'task' });
    const epic = makeItem('epic-1', {
      type: 'epic',
      title: 'Target Epic',
      project_id: PROJ_A,
      parent_id: null,
    });
    const items = buildItemsMap([source, epic]);

    render(<MoveToPickerModal source={source} items={items} onClose={vi.fn()} onMove={onMove} />);

    const epicCandidate = screen.getByText('Target Epic');
    fireEvent.click(epicCandidate.closest('li') ?? epicCandidate);

    expect(onMove).toHaveBeenCalledOnce();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const callArgs = onMove.mock.calls[0]?.[0] as { new_parent_id: string; new_project_id: string };
    expect(callArgs).toBeDefined();
    expect(callArgs.new_parent_id).toBe('epic-1');
    expect(callArgs.new_project_id).toBe(PROJ_A);
  });

  it('a descendant candidate is aria-disabled and clicking it does NOT call onMove', async () => {
    setupProjectsMock();
    const onMove = vi.fn();

    // epic → feat (source); try to move epic under feat → cycle
    const epic = makeItem('epic-1', {
      type: 'epic',
      title: 'Parent Epic',
      project_id: PROJ_A,
      parent_id: null,
    });
    const feat = makeItem('feat-1', {
      type: 'feature',
      title: 'Child Feature',
      project_id: PROJ_A,
      parent_id: 'epic-1' as ItemId,
    });
    const items = buildItemsMap([epic, feat]);

    render(<MoveToPickerModal source={epic} items={items} onClose={vi.fn()} onMove={onMove} />);

    // feat is a descendant of epic → should be disabled
    const featCandidate = screen.getByText('Child Feature').closest('li');
    expect(featCandidate).not.toBeNull();
    expect(featCandidate?.getAttribute('aria-disabled')).toBe('true');

    // Click on disabled candidate — use nullish coalescing to avoid non-null assertion
    if (featCandidate) {
      fireEvent.click(featCandidate);
    }
    expect(onMove).not.toHaveBeenCalled();
  });
});
