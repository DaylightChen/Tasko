/**
 * TreeRow component tests (task-09)
 *
 * Covers:
 * - Default render for each item type: Epic, Feature, Task
 * - Checkbox visible only for Task; not shown for Epic/Feature
 * - Rollup chip visible only for Epic/Feature when they have children (rollup.total > 0)
 * - ARIA attributes: role="treeitem", aria-level, aria-expanded, aria-setsize, aria-posinset
 * - Keyboard: ArrowRight → expand (if collapsed + has children), ArrowLeft → collapse,
 *   Enter → onClick, Space → onToggleCheckbox (Tasks only)
 */
import type { Item, ItemId, LocalDate, ProjectId, Subtask, SubtaskId } from '@tasko/types';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock useTagNavigation so TreeRow doesn't need QueryClient or router
vi.mock('../../../hooks/useTagNavigation', () => ({
  useTagNavigation: () => vi.fn(),
}));

// Mock useTags for the same reason; TagChips falls back to tagId when the
// name isn't found, which matches the existing test assertions.
vi.mock('../../../api/tags', () => ({
  useTags: () => ({ data: { tags: [] } }),
}));

// Mock api/items so the row's inline subtask toggle doesn't need a
// QueryClient wrapper for these unit tests.
vi.mock('../../../api/items', () => ({
  usePatchSubtask: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
}));

import { TreeRow } from '../index';

// ─── Factory ─────────────────────────────────────────────────────────────────

const TODAY = '2026-05-19' as LocalDate;
const PROJECT_ID = 'proj-1' as ProjectId;

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-1' as ItemId,
    schema_version: 1,
    type: 'task',
    project_id: PROJECT_ID,
    parent_id: null,
    title: 'Test Row',
    notes: '',
    due_date: TODAY,
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

type TreeRowRenderOptions = {
  type?: 'epic' | 'feature' | 'task';
  level?: 1 | 2 | 3;
  expanded?: boolean;
  hasChildren?: boolean;
  rollup?: { completed: number; total: number };
  posInSet?: number;
  setSize?: number;
  isFocused?: boolean;
  onToggleExpand?: () => void;
  onToggleCheckbox?: () => void;
  onClick?: () => void;
};

function renderRow(opts: TreeRowRenderOptions = {}) {
  const item = makeItem({ type: opts.type ?? 'task' });
  const onToggleExpand = opts.onToggleExpand ?? vi.fn();
  return render(
    <TreeRow
      item={item}
      level={opts.level ?? 1}
      expanded={opts.expanded ?? false}
      posInSet={opts.posInSet ?? 1}
      setSize={opts.setSize ?? 1}
      hasChildren={opts.hasChildren ?? false}
      {...(opts.rollup !== undefined ? { rollup: opts.rollup } : {})}
      isFocused={opts.isFocused ?? false}
      todayLocalDate={TODAY}
      onToggleExpand={onToggleExpand}
      {...(opts.onToggleCheckbox !== undefined ? { onToggleCheckbox: opts.onToggleCheckbox } : {})}
      {...(opts.onClick !== undefined ? { onClick: opts.onClick } : {})}
    />,
  );
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('TreeRow — default rendering', () => {
  it('renders an Epic row with its title', () => {
    const item = makeItem({ type: 'epic', title: 'My Epic' });
    render(
      <TreeRow
        item={item}
        level={1}
        expanded={false}
        posInSet={1}
        setSize={1}
        hasChildren={false}
        todayLocalDate={TODAY}
        onToggleExpand={vi.fn()}
      />,
    );
    expect(screen.getByText('My Epic')).toBeTruthy();
  });

  it('renders a Feature row with its title', () => {
    const item = makeItem({ type: 'feature', title: 'My Feature' });
    render(
      <TreeRow
        item={item}
        level={2}
        expanded={false}
        posInSet={1}
        setSize={2}
        hasChildren={false}
        todayLocalDate={TODAY}
        onToggleExpand={vi.fn()}
      />,
    );
    expect(screen.getByText('My Feature')).toBeTruthy();
  });

  it('renders a Task row with its title', () => {
    const item = makeItem({ type: 'task', title: 'My Task' });
    render(
      <TreeRow
        item={item}
        level={3}
        expanded={false}
        posInSet={1}
        setSize={3}
        hasChildren={false}
        todayLocalDate={TODAY}
        onToggleExpand={vi.fn()}
      />,
    );
    expect(screen.getByText('My Task')).toBeTruthy();
  });
});

describe('TreeRow — checkbox visibility', () => {
  it('shows a checkbox for a Task item', () => {
    renderRow({ type: 'task' });
    const checkbox = screen.queryByRole('checkbox');
    expect(checkbox).not.toBeNull();
  });

  it('does NOT show a checkbox for an Epic', () => {
    renderRow({ type: 'epic' });
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('does NOT show a checkbox for a Feature', () => {
    renderRow({ type: 'feature' });
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});

describe('TreeRow — rollup chip visibility', () => {
  it('shows rollup chip for an Epic when rollup.total > 0', () => {
    renderRow({ type: 'epic', rollup: { completed: 2, total: 5 } });
    expect(screen.getByLabelText(/2 of 5 children complete/i)).toBeTruthy();
  });

  it('shows rollup chip for a Feature when rollup.total > 0', () => {
    renderRow({ type: 'feature', rollup: { completed: 1, total: 3 } });
    expect(screen.getByLabelText(/1 of 3 children complete/i)).toBeTruthy();
  });

  it('does NOT show rollup chip when rollup.total === 0', () => {
    renderRow({ type: 'epic', rollup: { completed: 0, total: 0 } });
    expect(screen.queryByLabelText(/children complete/i)).toBeNull();
  });

  it('does NOT show rollup chip when rollup prop is not provided', () => {
    renderRow({ type: 'epic' });
    expect(screen.queryByLabelText(/children complete/i)).toBeNull();
  });

  it('does NOT show rollup chip for a Task even if rollup is provided', () => {
    // Task rows don't show rollup regardless
    renderRow({ type: 'task', rollup: { completed: 2, total: 4 } });
    expect(screen.queryByLabelText(/children complete/i)).toBeNull();
  });
});

describe('TreeRow — ARIA attributes', () => {
  it('has role="treeitem"', () => {
    renderRow({ type: 'task' });
    expect(screen.getByRole('treeitem')).toBeTruthy();
  });

  it('sets aria-level correctly', () => {
    renderRow({ type: 'feature', level: 2 });
    const row = screen.getByRole('treeitem');
    expect(row.getAttribute('aria-level')).toBe('2');
  });

  it('sets aria-setsize and aria-posinset', () => {
    renderRow({ type: 'epic', level: 1, posInSet: 3, setSize: 5 });
    const row = screen.getByRole('treeitem');
    expect(row.getAttribute('aria-setsize')).toBe('5');
    expect(row.getAttribute('aria-posinset')).toBe('3');
  });

  it('sets aria-expanded="false" when collapsed and has children', () => {
    renderRow({ type: 'epic', hasChildren: true, expanded: false });
    const row = screen.getByRole('treeitem');
    expect(row.getAttribute('aria-expanded')).toBe('false');
  });

  it('sets aria-expanded="true" when expanded and has children', () => {
    renderRow({ type: 'epic', hasChildren: true, expanded: true });
    const row = screen.getByRole('treeitem');
    expect(row.getAttribute('aria-expanded')).toBe('true');
  });

  it('does NOT set aria-expanded when item has no children', () => {
    renderRow({ type: 'epic', hasChildren: false, expanded: false });
    const row = screen.getByRole('treeitem');
    // aria-expanded should be undefined/null for leaf nodes
    expect(row.getAttribute('aria-expanded')).toBeNull();
  });
});

describe('TreeRow — keyboard interactions', () => {
  it('ArrowRight expands a collapsed row that has children', () => {
    const onToggleExpand = vi.fn();
    const item = makeItem({ type: 'epic' });
    render(
      <TreeRow
        item={item}
        level={1}
        expanded={false}
        posInSet={1}
        setSize={1}
        hasChildren={true}
        todayLocalDate={TODAY}
        onToggleExpand={onToggleExpand}
      />,
    );
    const row = screen.getByRole('treeitem');
    fireEvent.keyDown(row, { key: 'ArrowRight' });
    expect(onToggleExpand).toHaveBeenCalledOnce();
  });

  it('ArrowRight does nothing on a collapsed row with no children', () => {
    const onToggleExpand = vi.fn();
    const item = makeItem({ type: 'task' });
    render(
      <TreeRow
        item={item}
        level={1}
        expanded={false}
        posInSet={1}
        setSize={1}
        hasChildren={false}
        todayLocalDate={TODAY}
        onToggleExpand={onToggleExpand}
      />,
    );
    const row = screen.getByRole('treeitem');
    fireEvent.keyDown(row, { key: 'ArrowRight' });
    expect(onToggleExpand).not.toHaveBeenCalled();
  });

  it('ArrowLeft collapses an expanded row', () => {
    const onToggleExpand = vi.fn();
    const item = makeItem({ type: 'epic' });
    render(
      <TreeRow
        item={item}
        level={1}
        expanded={true}
        posInSet={1}
        setSize={1}
        hasChildren={true}
        todayLocalDate={TODAY}
        onToggleExpand={onToggleExpand}
      />,
    );
    const row = screen.getByRole('treeitem');
    fireEvent.keyDown(row, { key: 'ArrowLeft' });
    expect(onToggleExpand).toHaveBeenCalledOnce();
  });

  it('Enter key calls onClick', () => {
    const onClick = vi.fn();
    const item = makeItem({ type: 'task' });
    render(
      <TreeRow
        item={item}
        level={1}
        expanded={false}
        posInSet={1}
        setSize={1}
        hasChildren={false}
        todayLocalDate={TODAY}
        onToggleExpand={vi.fn()}
        onClick={onClick}
      />,
    );
    const row = screen.getByRole('treeitem');
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('"o" key calls onClick', () => {
    const onClick = vi.fn();
    const item = makeItem({ type: 'task' });
    render(
      <TreeRow
        item={item}
        level={1}
        expanded={false}
        posInSet={1}
        setSize={1}
        hasChildren={false}
        todayLocalDate={TODAY}
        onToggleExpand={vi.fn()}
        onClick={onClick}
      />,
    );
    const row = screen.getByRole('treeitem');
    fireEvent.keyDown(row, { key: 'o' });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('Space key calls onToggleCheckbox for a Task', () => {
    const onToggleCheckbox = vi.fn();
    const item = makeItem({ type: 'task' });
    render(
      <TreeRow
        item={item}
        level={1}
        expanded={false}
        posInSet={1}
        setSize={1}
        hasChildren={false}
        todayLocalDate={TODAY}
        onToggleExpand={vi.fn()}
        onToggleCheckbox={onToggleCheckbox}
      />,
    );
    const row = screen.getByRole('treeitem');
    act(() => {
      fireEvent.keyDown(row, { key: ' ' });
    });
    expect(onToggleCheckbox).toHaveBeenCalledOnce();
  });

  it('Space key does NOT call onToggleCheckbox for an Epic', () => {
    const onToggleCheckbox = vi.fn();
    const item = makeItem({ type: 'epic' });
    render(
      <TreeRow
        item={item}
        level={1}
        expanded={false}
        posInSet={1}
        setSize={1}
        hasChildren={false}
        todayLocalDate={TODAY}
        onToggleExpand={vi.fn()}
        onToggleCheckbox={onToggleCheckbox}
      />,
    );
    const row = screen.getByRole('treeitem');
    fireEvent.keyDown(row, { key: ' ' });
    expect(onToggleCheckbox).not.toHaveBeenCalled();
  });
});

describe('TreeRow — inline subtasks', () => {
  function makeSub(id: string, title: string, status: 'todo' | 'done' = 'todo'): Subtask {
    return {
      id: id as SubtaskId,
      title,
      status,
      completed_at: status === 'done' ? '2026-01-01T00:00:00Z' : null,
      sort_order: 0,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
  }

  it('task row with subtasks shows the X/N chip', () => {
    const item = makeItem({
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAA' as ItemId,
      type: 'task',
      subtasks: [makeSub('s1', 'A'), makeSub('s2', 'B', 'done')],
    });
    render(
      <TreeRow
        item={item}
        level={1}
        expanded={false}
        posInSet={1}
        setSize={1}
        hasChildren={false}
        todayLocalDate={TODAY}
        onToggleExpand={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /1 of 2 subtasks complete/i })).toBeInTheDocument();
  });

  it('clicking the chip expands inline subtask rows', () => {
    const item = makeItem({
      id: '01ARZ3NDEKTSV4RRFFQ69G5FBB' as ItemId,
      type: 'task',
      subtasks: [makeSub('s1', 'Sub Alpha'), makeSub('s2', 'Sub Beta')],
    });
    render(
      <TreeRow
        item={item}
        level={1}
        expanded={false}
        posInSet={1}
        setSize={1}
        hasChildren={false}
        todayLocalDate={TODAY}
        onToggleExpand={vi.fn()}
      />,
    );
    // Collapsed: subtask titles not in DOM.
    expect(screen.queryByText('Sub Alpha')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /subtasks complete/i }));
    expect(screen.getByText('Sub Alpha')).toBeInTheDocument();
    expect(screen.getByText('Sub Beta')).toBeInTheDocument();
  });

  it('task with subtasks shows the chevron (>) and clicking it expands subtasks', () => {
    const item = makeItem({
      id: '01ARZ3NDEKTSV4RRFFQ69G5FBD' as ItemId,
      type: 'task',
      subtasks: [makeSub('s1', 'Sub Inline 1'), makeSub('s2', 'Sub Inline 2')],
    });
    render(
      <TreeRow
        item={item}
        level={1}
        expanded={false}
        posInSet={1}
        setSize={1}
        // hasChildren is false — tasks have no parent_id children
        hasChildren={false}
        todayLocalDate={TODAY}
        onToggleExpand={vi.fn()}
      />,
    );

    // Chevron is visible (its parent is a button labelled Expand / Collapse).
    const chevron = screen.getByRole('button', { name: /expand/i });
    expect(chevron).toBeInTheDocument();
    // Subtasks not yet rendered.
    expect(screen.queryByText('Sub Inline 1')).toBeNull();

    fireEvent.click(chevron);
    expect(screen.getByText('Sub Inline 1')).toBeInTheDocument();
    expect(screen.getByText('Sub Inline 2')).toBeInTheDocument();
  });

  it('ArrowRight on a task with collapsed subtasks expands them', () => {
    const item = makeItem({
      id: '01ARZ3NDEKTSV4RRFFQ69G5FBE' as ItemId,
      type: 'task',
      subtasks: [makeSub('s1', 'Sub Kbd')],
    });
    render(
      <TreeRow
        item={item}
        level={1}
        expanded={false}
        posInSet={1}
        setSize={1}
        hasChildren={false}
        isFocused={true}
        todayLocalDate={TODAY}
        onToggleExpand={vi.fn()}
      />,
    );
    expect(screen.queryByText('Sub Kbd')).toBeNull();
    const row = screen.getByRole('treeitem');
    fireEvent.keyDown(row, { key: 'ArrowRight' });
    expect(screen.getByText('Sub Kbd')).toBeInTheDocument();
  });

  it('non-task rows (Epic/Feature) do NOT show the subtask chip', () => {
    const item = makeItem({
      id: '01ARZ3NDEKTSV4RRFFQ69G5FCC' as ItemId,
      type: 'feature',
      subtasks: [makeSub('s1', 'A')],
    });
    render(
      <TreeRow
        item={item}
        level={2}
        expanded={false}
        posInSet={1}
        setSize={1}
        hasChildren={false}
        todayLocalDate={TODAY}
        onToggleExpand={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /subtasks complete/i })).toBeNull();
  });
});
