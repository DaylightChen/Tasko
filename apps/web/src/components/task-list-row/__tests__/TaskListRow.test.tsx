/**
 * Tests for TaskListRow component (task-06) — the workhorse row.
 *
 * Covers (per brief step 15):
 * - Default render: priority dot exists with correct data-priority; checkbox at correct state; title rendered; tag chips count rendered.
 * - Priority dot: 4 size variants (6/6/8/10px) rendering correctly per §1.4 color-independence.
 * - Inline edit: title button → onTitleClickInlineEdit; inlineEditMode input → onTitleCommitInlineEdit; Esc cancels.
 * - Date chip: only renders when meaningful (today/tomorrow/overdue/>7 days). Not shown for 3-7 days out.
 * - Multi-day chip: renders with correct day/total when start_date != due_date.
 * - Tag chips: 3 tags → 2 visible + "+1" overflow; click tag chip → onTagClick (not onClick).
 * - Subtask progress chip: shows N/M when subtasks exist.
 * - Hover affordances: isFocused → ⋯ and Open chevron appear.
 * - Keyboard: Space → onToggleCheckbox; Enter → onClick; o → onClick.
 * - ARIA label includes priority / date / tags count.
 * - Overdue: data-state includes "overdue"; date chip rendered.
 * - Role="listitem" (rendered as <li>).
 * - Recurring icon appears when item.recurrence != null.
 */
import type { Item, ItemId, LocalDate, ProjectId, Subtask, SubtaskId, TagId } from '@tasko/types';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock useTags so TagChips doesn't need a QueryClient. Returning empty tags
// means name resolution falls back to the tagId — which is what the
// existing assertions in this file already check ("Filter by tag work").
vi.mock('../../../api/tags', () => ({
  useTags: () => ({ data: { tags: [] } }),
}));

// Same reasoning for api/items — the row uses usePatchSubtask for inline
// subtask toggle. Stub it so tests don't need a QueryClient wrapper.
vi.mock('../../../api/items', () => ({
  usePatchSubtask: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
}));

import { TaskListRow } from '../index';

// ─── Factory ─────────────────────────────────────────────────────────────────

const NOW = '2026-05-18T10:00:00.000Z';
const TODAY = '2026-05-18' as LocalDate;
const TOMORROW = '2026-05-19' as LocalDate;
const YESTERDAY = '2026-05-17' as LocalDate;
// 10 days from today
const FUTURE_10 = '2026-05-28' as LocalDate;
// 3 days from today (should NOT show date chip)
const FUTURE_3 = '2026-05-21' as LocalDate;

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-1' as ItemId,
    schema_version: 1,
    type: 'task',
    project_id: 'proj-1' as ProjectId,
    parent_id: null,
    title: 'Test task',
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
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('TaskListRow', () => {
  describe('basic rendering', () => {
    it('renders as a <li> element with role="listitem"', () => {
      const { container } = render(<TaskListRow item={makeItem()} todayLocalDate={TODAY} />);
      const li = container.querySelector('li');
      expect(li).toBeTruthy();
      // li has implicit role=listitem
    });

    it('renders the task title', () => {
      render(<TaskListRow item={makeItem({ title: 'Buy milk' })} todayLocalDate={TODAY} />);
      expect(screen.getByText('Buy milk')).toBeTruthy();
    });

    it('renders a checkbox', () => {
      render(<TaskListRow item={makeItem()} todayLocalDate={TODAY} />);
      expect(screen.getByRole('checkbox')).toBeTruthy();
    });

    it('checkbox is checked when item.status is "done"', () => {
      render(<TaskListRow item={makeItem({ status: 'done' })} todayLocalDate={TODAY} />);
      expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
    });

    it('checkbox is unchecked when item.status is "todo"', () => {
      render(<TaskListRow item={makeItem({ status: 'todo' })} todayLocalDate={TODAY} />);
      expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
    });
  });

  describe('priority dot', () => {
    it('renders priority dot button', () => {
      render(<TaskListRow item={makeItem({ priority: 'high' })} todayLocalDate={TODAY} />);
      expect(screen.getByRole('button', { name: 'Priority: high' })).toBeTruthy();
    });

    it('priority dot has data-priority="none" for none priority', () => {
      const { container } = render(
        <TaskListRow item={makeItem({ priority: 'none' })} todayLocalDate={TODAY} />,
      );
      expect(container.querySelector('[data-priority="none"]')).toBeTruthy();
    });

    it('priority dot has data-priority="low" for low priority', () => {
      const { container } = render(
        <TaskListRow item={makeItem({ priority: 'low' })} todayLocalDate={TODAY} />,
      );
      expect(container.querySelector('[data-priority="low"]')).toBeTruthy();
    });

    it('priority dot has data-priority="medium" for medium priority', () => {
      const { container } = render(
        <TaskListRow item={makeItem({ priority: 'medium' })} todayLocalDate={TODAY} />,
      );
      expect(container.querySelector('[data-priority="medium"]')).toBeTruthy();
    });

    it('priority dot has data-priority="high" for high priority', () => {
      const { container } = render(
        <TaskListRow item={makeItem({ priority: 'high' })} todayLocalDate={TODAY} />,
      );
      expect(container.querySelector('[data-priority="high"]')).toBeTruthy();
    });

    it('none priority dot is 6x6px (hollow)', () => {
      const { container } = render(
        <TaskListRow item={makeItem({ priority: 'none' })} todayLocalDate={TODAY} />,
      );
      const dot = container.querySelector('[data-priority="none"]') as HTMLElement;
      expect(dot?.style.width).toBe('6px');
      expect(dot?.style.height).toBe('6px');
      expect(dot?.dataset.hollow).toBeDefined(); // hollow attribute is set
    });

    it('low priority dot is 6x6px (filled)', () => {
      const { container } = render(
        <TaskListRow item={makeItem({ priority: 'low' })} todayLocalDate={TODAY} />,
      );
      const dot = container.querySelector('[data-priority="low"]') as HTMLElement;
      expect(dot?.style.width).toBe('6px');
      expect(dot?.style.height).toBe('6px');
      expect(dot?.dataset.hollow).toBeUndefined(); // filled, no hollow attr
    });

    it('medium priority dot is 8x8px', () => {
      const { container } = render(
        <TaskListRow item={makeItem({ priority: 'medium' })} todayLocalDate={TODAY} />,
      );
      const dot = container.querySelector('[data-priority="medium"]') as HTMLElement;
      expect(dot?.style.width).toBe('8px');
      expect(dot?.style.height).toBe('8px');
    });

    it('high priority dot is 10x10px', () => {
      const { container } = render(
        <TaskListRow item={makeItem({ priority: 'high' })} todayLocalDate={TODAY} />,
      );
      const dot = container.querySelector('[data-priority="high"]') as HTMLElement;
      expect(dot?.style.width).toBe('10px');
      expect(dot?.style.height).toBe('10px');
    });

    it('calls onPriorityClick when priority dot is clicked', () => {
      const onPriorityClick = vi.fn();
      render(
        <TaskListRow
          item={makeItem({ priority: 'high' })}
          todayLocalDate={TODAY}
          onPriorityClick={onPriorityClick}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Priority: high' }));
      expect(onPriorityClick).toHaveBeenCalledOnce();
    });
  });

  describe('inline edit', () => {
    it('renders title as a button when not in edit mode', () => {
      render(<TaskListRow item={makeItem({ title: 'My task' })} todayLocalDate={TODAY} />);
      expect(screen.getByRole('button', { name: 'My task' })).toBeTruthy();
    });

    it('calls onTitleClickInlineEdit when title button is clicked', () => {
      const onTitleClickInlineEdit = vi.fn();
      render(
        <TaskListRow
          item={makeItem({ title: 'My task' })}
          todayLocalDate={TODAY}
          onTitleClickInlineEdit={onTitleClickInlineEdit}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'My task' }));
      expect(onTitleClickInlineEdit).toHaveBeenCalledOnce();
    });

    it('renders inline input when inlineEditMode=true', () => {
      render(
        <TaskListRow
          item={makeItem({ title: 'My task' })}
          todayLocalDate={TODAY}
          inlineEditMode={true}
          onTitleCommitInlineEdit={() => {}}
        />,
      );
      expect(screen.getByRole('textbox', { name: 'Edit task title' })).toBeTruthy();
    });

    it('input has autoFocus when inlineEditMode=true', () => {
      render(
        <TaskListRow
          item={makeItem({ title: 'My task' })}
          todayLocalDate={TODAY}
          inlineEditMode={true}
          onTitleCommitInlineEdit={() => {}}
        />,
      );
      const input = screen.getByRole('textbox', { name: 'Edit task title' });
      // autoFocus sets focus on mount in jsdom
      expect(document.activeElement).toBe(input);
    });

    it('calls onTitleCommitInlineEdit with new value on Enter', () => {
      const onCommit = vi.fn();
      render(
        <TaskListRow
          item={makeItem({ title: 'Old title' })}
          todayLocalDate={TODAY}
          inlineEditMode={true}
          onTitleCommitInlineEdit={onCommit}
        />,
      );
      const input = screen.getByRole('textbox', { name: 'Edit task title' });
      fireEvent.change(input, { target: { value: 'New title' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onCommit).toHaveBeenCalledWith('New title');
    });

    it('calls onTitleCommitInlineEdit with original title on Escape (cancel)', () => {
      const onCommit = vi.fn();
      render(
        <TaskListRow
          item={makeItem({ title: 'Original' })}
          todayLocalDate={TODAY}
          inlineEditMode={true}
          onTitleCommitInlineEdit={onCommit}
        />,
      );
      const input = screen.getByRole('textbox', { name: 'Edit task title' });
      fireEvent.change(input, { target: { value: 'Changed' } });
      fireEvent.keyDown(input, { key: 'Escape' });
      // Cancel reverts to original title
      expect(onCommit).toHaveBeenCalledWith('Original');
    });
  });

  describe('date chip', () => {
    it('shows date chip for today', () => {
      render(<TaskListRow item={makeItem({ due_date: TODAY })} todayLocalDate={TODAY} />);
      expect(screen.getByRole('button', { name: /today/i })).toBeTruthy();
    });

    it('shows date chip for tomorrow with ARIA label "Tuesday, May 19, 2026"', () => {
      render(<TaskListRow item={makeItem({ due_date: TOMORROW })} todayLocalDate={TODAY} />);
      expect(screen.getByRole('button', { name: /Tuesday, May 19, 2026/ })).toBeTruthy();
    });

    it('shows "Tomorrow" text in chip for tomorrow', () => {
      render(<TaskListRow item={makeItem({ due_date: TOMORROW })} todayLocalDate={TODAY} />);
      expect(screen.getByText('Tomorrow')).toBeTruthy();
    });

    it('shows date chip for overdue task', () => {
      render(<TaskListRow item={makeItem({ due_date: YESTERDAY })} todayLocalDate={TODAY} />);
      const dateChip = screen.getByRole('button', { name: /overdue/i });
      expect(dateChip).toBeTruthy();
    });

    it('shows date chip for task > 7 days out', () => {
      render(<TaskListRow item={makeItem({ due_date: FUTURE_10 })} todayLocalDate={TODAY} />);
      // > 7 days shows chip
      expect(screen.getByRole('button', { name: /May 28/ })).toBeTruthy();
    });

    it('does NOT show date chip for task 3 days out (between 2-7 days)', () => {
      render(<TaskListRow item={makeItem({ due_date: FUTURE_3 })} todayLocalDate={TODAY} />);
      // 3 days out → no chip
      expect(screen.queryByRole('button', { name: /May/ })).toBeNull();
    });
  });

  describe('multi-day chip', () => {
    it('renders MultiDayChip when start_date != due_date', () => {
      render(
        <TaskListRow item={makeItem({ start_date: TODAY, due_date: FUTURE_10 })} todayLocalDate={TODAY} />,
      );
      // Day 1 of 11 (from today to 10 days out)
      expect(screen.getByText(/Day \d+ of \d+/)).toBeTruthy();
    });

    it('does NOT render MultiDayChip when start_date is null', () => {
      render(<TaskListRow item={makeItem({ start_date: null })} todayLocalDate={TODAY} />);
      expect(screen.queryByText(/Day \d+ of \d+/)).toBeNull();
    });

    it('does NOT render MultiDayChip when start_date equals due_date', () => {
      render(<TaskListRow item={makeItem({ start_date: TODAY, due_date: TODAY })} todayLocalDate={TODAY} />);
      expect(screen.queryByText(/Day \d+ of \d+/)).toBeNull();
    });

    it('MultiDayChip shows correct day 1 for start_date = today', () => {
      render(
        <TaskListRow item={makeItem({ start_date: TODAY, due_date: FUTURE_10 })} todayLocalDate={TODAY} />,
      );
      // Day 1 since today is the start date
      expect(screen.getByText(/Day 1 of/)).toBeTruthy();
    });
  });

  describe('tag chips', () => {
    it('renders 2 tags directly when exactly 2 tags', () => {
      render(
        <TaskListRow
          item={makeItem({ tags: ['work', 'personal'] as unknown as TagId[] })}
          todayLocalDate={TODAY}
        />,
      );
      expect(screen.getByRole('button', { name: 'Filter by tag work' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Filter by tag personal' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: /more tags/ })).toBeNull();
    });

    it('renders 2 visible + "+1" overflow when 3 tags', () => {
      render(
        <TaskListRow
          item={makeItem({ tags: ['a', 'b', 'c'] as unknown as TagId[] })}
          todayLocalDate={TODAY}
        />,
      );
      // Only "Filter by tag a" and "Filter by tag b" are visible, "c" is hidden behind overflow
      expect(screen.getByRole('button', { name: 'Filter by tag a' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Filter by tag b' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Filter by tag c' })).toBeNull();
      expect(screen.getByRole('button', { name: /1 more tags/ })).toBeTruthy();
    });

    it('calls onTagClick with tagId when tag chip is clicked (not onClick)', () => {
      const onTagClick = vi.fn();
      const onClick = vi.fn();
      render(
        <TaskListRow
          item={makeItem({ tags: ['urgent'] as unknown as TagId[] })}
          todayLocalDate={TODAY}
          onTagClick={onTagClick}
          onClick={onClick}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Filter by tag urgent' }));
      expect(onTagClick).toHaveBeenCalledWith('urgent');
      // Event stop-propagation: onClick should NOT be called
      expect(onClick).not.toHaveBeenCalled();
    });

    it('overflow "+N" click expands all tags', () => {
      render(
        <TaskListRow
          item={makeItem({ tags: ['a', 'b', 'c', 'd'] as unknown as TagId[] })}
          todayLocalDate={TODAY}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /2 more tags/ }));
      // Now all 4 tag chips should be visible
      expect(screen.getByRole('button', { name: 'Filter by tag a' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Filter by tag b' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Filter by tag c' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Filter by tag d' })).toBeTruthy();
    });

    it('renders no tag chips when tags array is empty', () => {
      render(<TaskListRow item={makeItem({ tags: [] })} todayLocalDate={TODAY} />);
      expect(screen.queryByRole('button', { name: /Filter by tag/ })).toBeNull();
    });
  });

  describe('subtask progress chip', () => {
    it('renders subtask chip when subtasks exist', () => {
      const sub1: Subtask = {
        id: 's1' as SubtaskId,
        title: 'Sub 1',
        status: 'done',
        completed_at: null,
        sort_order: 0,
        created_at: NOW,
        updated_at: NOW,
      };
      const sub2: Subtask = {
        id: 's2' as SubtaskId,
        title: 'Sub 2',
        status: 'todo',
        completed_at: null,
        sort_order: 1,
        created_at: NOW,
        updated_at: NOW,
      };
      render(<TaskListRow item={makeItem({ subtasks: [sub1, sub2] })} todayLocalDate={TODAY} />);
      expect(screen.getByText('1/2')).toBeTruthy();
    });

    it('subtask chip has accessible aria-label', () => {
      const sub1: Subtask = {
        id: 's1' as SubtaskId,
        title: 'Sub 1',
        status: 'done',
        completed_at: null,
        sort_order: 0,
        created_at: NOW,
        updated_at: NOW,
      };
      const sub2: Subtask = {
        id: 's2' as SubtaskId,
        title: 'Sub 2',
        status: 'done',
        completed_at: null,
        sort_order: 1,
        created_at: NOW,
        updated_at: NOW,
      };
      render(<TaskListRow item={makeItem({ subtasks: [sub1, sub2] })} todayLocalDate={TODAY} />);
      expect(screen.getByRole('button', { name: '2 of 2 subtasks complete' })).toBeTruthy();
    });

    it('does not render subtask chip when no subtasks', () => {
      render(<TaskListRow item={makeItem({ subtasks: [] })} todayLocalDate={TODAY} />);
      expect(screen.queryByText(/\//)).toBeNull();
    });

    it('calls onSubtaskChipClick when subtask chip is clicked', () => {
      const onSubtaskChipClick = vi.fn();
      const sub: Subtask = {
        id: 's1' as SubtaskId,
        title: 'Sub 1',
        status: 'todo',
        completed_at: null,
        sort_order: 0,
        created_at: NOW,
        updated_at: NOW,
      };
      render(
        <TaskListRow
          item={makeItem({ subtasks: [sub] })}
          todayLocalDate={TODAY}
          onSubtaskChipClick={onSubtaskChipClick}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /subtasks complete/ }));
      expect(onSubtaskChipClick).toHaveBeenCalledOnce();
    });

    it('clicking the subtask chip expands inline subtask rows', () => {
      const sub1: Subtask = {
        id: 's1' as SubtaskId,
        title: 'Sub Alpha',
        status: 'todo',
        completed_at: null,
        sort_order: 0,
        created_at: NOW,
        updated_at: NOW,
      };
      const sub2: Subtask = {
        id: 's2' as SubtaskId,
        title: 'Sub Beta',
        status: 'done',
        completed_at: NOW,
        sort_order: 1,
        created_at: NOW,
        updated_at: NOW,
      };
      render(
        <TaskListRow
          item={makeItem({ id: '01ARZ3NDEKTSV4RRFFQ69G5FXX' as ItemId, subtasks: [sub1, sub2] })}
          todayLocalDate={TODAY}
        />,
      );

      // Collapsed by default — subtask titles not in DOM.
      expect(screen.queryByText('Sub Alpha')).toBeNull();
      expect(screen.queryByText('Sub Beta')).toBeNull();

      // Click chip → both subtask rows appear.
      fireEvent.click(screen.getByRole('button', { name: /subtasks complete/ }));
      expect(screen.getByText('Sub Alpha')).toBeInTheDocument();
      expect(screen.getByText('Sub Beta')).toBeInTheDocument();
    });
  });

  describe('hover affordances', () => {
    // The "More actions" (⋯) button was removed in v1 — no menu was wired by
    // any consumer, so the button was a guaranteed no-op for users. The Open
    // chevron remains as the sole hover affordance.
    // See docs/known-issues.md (Row "More actions" menu deferred to v1.1).
    it('shows the Open chevron when isFocused=true', () => {
      render(<TaskListRow item={makeItem()} todayLocalDate={TODAY} isFocused={true} />);
      expect(screen.getByRole('button', { name: /Open/ })).toBeTruthy();
    });

    it('does not show hover buttons when isFocused=false and not hovered', () => {
      render(<TaskListRow item={makeItem()} todayLocalDate={TODAY} isFocused={false} />);
      expect(screen.queryByRole('button', { name: /Open/ })).toBeNull();
    });

    it('shows hover buttons on mouseenter', () => {
      const { container } = render(<TaskListRow item={makeItem()} todayLocalDate={TODAY} />);
      const li = container.querySelector('li') as HTMLElement;
      fireEvent.mouseEnter(li);
      expect(screen.getByRole('button', { name: /Open/ })).toBeTruthy();
    });

    it('hides hover buttons after mouseleave (after 120ms grace)', async () => {
      vi.useFakeTimers();
      const { container } = render(<TaskListRow item={makeItem()} todayLocalDate={TODAY} />);
      const li = container.querySelector('li') as HTMLElement;
      act(() => {
        fireEvent.mouseEnter(li);
      });
      expect(screen.getByRole('button', { name: /Open/ })).toBeTruthy();
      act(() => {
        fireEvent.mouseLeave(li);
      });
      // Before 120ms grace period: buttons still visible
      act(() => {
        vi.advanceTimersByTime(50);
      });
      expect(screen.getByRole('button', { name: /Open/ })).toBeTruthy();
      // After 120ms: buttons hidden
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(screen.queryByRole('button', { name: /Open/ })).toBeNull();
      vi.useRealTimers();
    });

    it('calls onOpenChevronClick when Open chevron is clicked', () => {
      const onOpenChevronClick = vi.fn();
      render(
        <TaskListRow
          item={makeItem()}
          todayLocalDate={TODAY}
          isFocused={true}
          onOpenChevronClick={onOpenChevronClick}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /Open/ }));
      expect(onOpenChevronClick).toHaveBeenCalledOnce();
    });
  });

  describe('keyboard shortcuts (when isFocused)', () => {
    it('Space triggers onToggleCheckbox', () => {
      const onToggleCheckbox = vi.fn();
      const { container } = render(
        <TaskListRow
          item={makeItem()}
          todayLocalDate={TODAY}
          isFocused={true}
          onToggleCheckbox={onToggleCheckbox}
        />,
      );
      const li = container.querySelector('li') as HTMLElement;
      fireEvent.keyDown(li, { key: ' ' });
      expect(onToggleCheckbox).toHaveBeenCalledOnce();
    });

    it('Enter triggers onClick', () => {
      const onClick = vi.fn();
      const { container } = render(
        <TaskListRow item={makeItem()} todayLocalDate={TODAY} isFocused={true} onClick={onClick} />,
      );
      const li = container.querySelector('li') as HTMLElement;
      fireEvent.keyDown(li, { key: 'Enter' });
      expect(onClick).toHaveBeenCalledOnce();
    });

    it('"o" key triggers onClick', () => {
      const onClick = vi.fn();
      const { container } = render(
        <TaskListRow item={makeItem()} todayLocalDate={TODAY} isFocused={true} onClick={onClick} />,
      );
      const li = container.querySelector('li') as HTMLElement;
      fireEvent.keyDown(li, { key: 'o' });
      expect(onClick).toHaveBeenCalledOnce();
    });

    it('"O" key triggers onClick', () => {
      const onClick = vi.fn();
      const { container } = render(
        <TaskListRow item={makeItem()} todayLocalDate={TODAY} isFocused={true} onClick={onClick} />,
      );
      const li = container.querySelector('li') as HTMLElement;
      fireEvent.keyDown(li, { key: 'O' });
      expect(onClick).toHaveBeenCalledOnce();
    });

    it('Delete triggers onDeleteRequest', () => {
      const onDeleteRequest = vi.fn();
      const { container } = render(
        <TaskListRow
          item={makeItem()}
          todayLocalDate={TODAY}
          isFocused={true}
          onDeleteRequest={onDeleteRequest}
        />,
      );
      const li = container.querySelector('li') as HTMLElement;
      fireEvent.keyDown(li, { key: 'Delete' });
      expect(onDeleteRequest).toHaveBeenCalledOnce();
    });

    it('keyboard shortcuts are ignored when inlineEditMode=true', () => {
      const onClick = vi.fn();
      const { container } = render(
        <TaskListRow
          item={makeItem()}
          todayLocalDate={TODAY}
          isFocused={true}
          inlineEditMode={true}
          onClick={onClick}
        />,
      );
      const li = container.querySelector('li') as HTMLElement;
      fireEvent.keyDown(li, { key: 'Enter' });
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('ARIA label', () => {
    it('aria-label includes task title', () => {
      const { container } = render(
        <TaskListRow item={makeItem({ title: 'Buy groceries' })} todayLocalDate={TODAY} />,
      );
      const li = container.querySelector('li') as HTMLElement;
      expect(li.getAttribute('aria-label')).toContain('Buy groceries');
    });

    it('aria-label includes priority', () => {
      const { container } = render(
        <TaskListRow item={makeItem({ priority: 'high' })} todayLocalDate={TODAY} />,
      );
      const li = container.querySelector('li') as HTMLElement;
      expect(li.getAttribute('aria-label')).toContain('priority high');
    });

    it('aria-label includes tags count when tags exist', () => {
      const { container } = render(
        <TaskListRow item={makeItem({ tags: ['a', 'b'] as unknown as TagId[] })} todayLocalDate={TODAY} />,
      );
      const li = container.querySelector('li') as HTMLElement;
      expect(li.getAttribute('aria-label')).toContain('2 tags');
    });

    it('aria-label includes "recurring" when item has recurrence', () => {
      const { container } = render(
        <TaskListRow
          item={makeItem({
            recurrence: { frequency: 'daily', anchor_mode: 'on_schedule' },
          })}
          todayLocalDate={TODAY}
        />,
      );
      const li = container.querySelector('li') as HTMLElement;
      expect(li.getAttribute('aria-label')).toContain('recurring');
    });

    it('aria-label includes due date for today', () => {
      const { container } = render(
        <TaskListRow item={makeItem({ due_date: TODAY })} todayLocalDate={TODAY} />,
      );
      const li = container.querySelector('li') as HTMLElement;
      expect(li.getAttribute('aria-label')).toContain('due');
    });

    it('aria-label includes project name when showProjectBreadcrumb and project provided', () => {
      const { container } = render(
        <TaskListRow item={makeItem()} todayLocalDate={TODAY} project={{ name: 'Work' }} />,
      );
      const li = container.querySelector('li') as HTMLElement;
      expect(li.getAttribute('aria-label')).toContain('in Work');
    });
  });

  describe('overdue state', () => {
    it('data-state includes "overdue" for overdue task', () => {
      const { container } = render(
        <TaskListRow item={makeItem({ due_date: YESTERDAY })} todayLocalDate={TODAY} />,
      );
      const li = container.querySelector('li') as HTMLElement;
      expect(li.getAttribute('data-state')).toContain('overdue');
    });

    it('data-state does NOT include "overdue" for on-time task', () => {
      const { container } = render(
        <TaskListRow item={makeItem({ due_date: TOMORROW })} todayLocalDate={TODAY} />,
      );
      const li = container.querySelector('li') as HTMLElement;
      const state = li.getAttribute('data-state') ?? '';
      expect(state).not.toContain('overdue');
    });

    it('overdue date chip has data-overdue attribute', () => {
      const { container } = render(
        <TaskListRow item={makeItem({ due_date: YESTERDAY })} todayLocalDate={TODAY} />,
      );
      expect(container.querySelector('[data-overdue]')).toBeTruthy();
    });
  });

  describe('recurring icon', () => {
    it('renders recurring icon when recurrence is set', () => {
      render(
        <TaskListRow
          item={makeItem({
            recurrence: { frequency: 'daily', anchor_mode: 'on_schedule' },
          })}
          todayLocalDate={TODAY}
        />,
      );
      expect(screen.getByTitle('Recurring task')).toBeTruthy();
    });

    it('does not render recurring icon when recurrence is null', () => {
      render(<TaskListRow item={makeItem({ recurrence: null })} todayLocalDate={TODAY} />);
      expect(screen.queryByTitle('Recurring task')).toBeNull();
    });
  });

  describe('multi-day data-state', () => {
    it('data-state includes "multi-day" when item spans multiple days', () => {
      const { container } = render(
        <TaskListRow item={makeItem({ start_date: TODAY, due_date: FUTURE_10 })} todayLocalDate={TODAY} />,
      );
      const li = container.querySelector('li') as HTMLElement;
      expect(li.getAttribute('data-state')).toContain('multi-day');
    });
  });

  describe('selected state', () => {
    it('data-state includes "selected" when isSelected=true', () => {
      const { container } = render(
        <TaskListRow item={makeItem()} todayLocalDate={TODAY} isSelected={true} />,
      );
      const li = container.querySelector('li') as HTMLElement;
      expect(li.getAttribute('data-state')).toContain('selected');
    });

    it('data-state includes "multi-selected" when isMultiSelected=true', () => {
      const { container } = render(
        <TaskListRow item={makeItem()} todayLocalDate={TODAY} isMultiSelected={true} />,
      );
      const li = container.querySelector('li') as HTMLElement;
      expect(li.getAttribute('data-state')).toContain('multi-selected');
    });
  });

  describe('completed state', () => {
    it('data-state includes "completed" when item status is done', () => {
      const { container } = render(
        <TaskListRow item={makeItem({ status: 'done' })} todayLocalDate={TODAY} />,
      );
      const li = container.querySelector('li') as HTMLElement;
      expect(li.getAttribute('data-state')).toContain('completed');
    });
  });

  describe('keyboard handler merge with dragListeners', () => {
    /**
     * Regression guard for the dnd-kit listener-override bug fixed in Task 10 Iteration 2.
     *
     * dnd-kit's useSortable().listeners includes an onKeyDown activator. When spread
     * last via {...dragListeners}, it overrides the row's own handleKeyDown, silently
     * breaking Space / Enter / T / Delete / 1-4 keyboard shortcuts on every draggable row.
     *
     * The fix: mergedKeyDown calls handleKeyDown first, then dragListeners.onKeyDown?.()
     * Both handlers MUST run when a keyDown event fires on the row.
     */
    it('fires both the row onToggleCheckbox AND dragListeners.onKeyDown when Space is pressed on a draggable row', () => {
      const onToggleCheckbox = vi.fn();
      const dndOnKeyDown = vi.fn();

      const { container } = render(
        <TaskListRow
          item={makeItem()}
          todayLocalDate={TODAY}
          isFocused={true}
          onToggleCheckbox={onToggleCheckbox}
          dragListeners={{ onKeyDown: dndOnKeyDown } as React.HTMLAttributes<HTMLLIElement>}
        />,
      );

      const li = container.querySelector('li') as HTMLElement;
      fireEvent.keyDown(li, { key: ' ' });

      // The row's own handler must fire (Space → toggle)
      expect(onToggleCheckbox).toHaveBeenCalledOnce();
      // The dnd-kit listener must ALSO fire (not silenced by the row's handler)
      expect(dndOnKeyDown).toHaveBeenCalledOnce();
    });

    it('fires dnd onKeyDown even when row shortcut key has no callback (no silent drop)', () => {
      // Verifies the merge path runs even when the row prop is absent.
      const dndOnKeyDown = vi.fn();

      const { container } = render(
        <TaskListRow
          item={makeItem()}
          todayLocalDate={TODAY}
          isFocused={true}
          // onToggleCheckbox deliberately omitted
          dragListeners={{ onKeyDown: dndOnKeyDown } as React.HTMLAttributes<HTMLLIElement>}
        />,
      );

      const li = container.querySelector('li') as HTMLElement;
      fireEvent.keyDown(li, { key: ' ' });

      expect(dndOnKeyDown).toHaveBeenCalledOnce();
    });

    it('row keyboard shortcuts still work when dragListeners is undefined (no dnd context)', () => {
      const onToggleCheckbox = vi.fn();

      const { container } = render(
        <TaskListRow
          item={makeItem()}
          todayLocalDate={TODAY}
          isFocused={true}
          onToggleCheckbox={onToggleCheckbox}
          // dragListeners deliberately omitted
        />,
      );

      const li = container.querySelector('li') as HTMLElement;
      fireEvent.keyDown(li, { key: ' ' });

      expect(onToggleCheckbox).toHaveBeenCalledOnce();
    });
  });
});
