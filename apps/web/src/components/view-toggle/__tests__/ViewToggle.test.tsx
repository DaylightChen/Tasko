import { fireEvent, render, screen } from '@testing-library/react';
/**
 * Tests for ViewToggle component (task-06)
 * Covers: role="tablist", role="tab" children, aria-selected, single-selected,
 *         Arrow key navigation, onChange fires.
 */
import { GitBranch, LayoutGrid, List } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { ViewToggle } from '../index';

const OPTIONS = [
  { value: 'list', icon: List, label: 'List view' },
  { value: 'tree', icon: GitBranch, label: 'Tree view' },
  { value: 'kanban', icon: LayoutGrid, label: 'Kanban view' },
];

describe('ViewToggle', () => {
  it('renders container with role="tablist"', () => {
    render(<ViewToggle options={OPTIONS} value="list" onChange={() => {}} />);
    expect(screen.getByRole('tablist')).toBeTruthy();
  });

  it('renders each option with role="tab"', () => {
    render(<ViewToggle options={OPTIONS} value="list" onChange={() => {}} />);
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('selected tab has aria-selected="true"', () => {
    render(<ViewToggle options={OPTIONS} value="tree" onChange={() => {}} />);
    const treeTab = screen.getByRole('tab', { name: 'Tree view' });
    expect(treeTab).toHaveAttribute('aria-selected', 'true');
  });

  it('non-selected tabs have aria-selected="false"', () => {
    render(<ViewToggle options={OPTIONS} value="list" onChange={() => {}} />);
    const treeTab = screen.getByRole('tab', { name: 'Tree view' });
    expect(treeTab).toHaveAttribute('aria-selected', 'false');
  });

  it('only one tab is selected at a time', () => {
    render(<ViewToggle options={OPTIONS} value="list" onChange={() => {}} />);
    const selectedTabs = screen.getAllByRole('tab').filter((t) => t.getAttribute('aria-selected') === 'true');
    expect(selectedTabs).toHaveLength(1);
  });

  it('calls onChange with correct value when tab is clicked', () => {
    const onChange = vi.fn();
    render(<ViewToggle options={OPTIONS} value="list" onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Kanban view' }));
    expect(onChange).toHaveBeenCalledWith('kanban');
  });

  it('ArrowRight selects next option', () => {
    const onChange = vi.fn();
    render(<ViewToggle options={OPTIONS} value="list" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('tree');
  });

  it('ArrowLeft selects previous option (wraps around)', () => {
    const onChange = vi.fn();
    render(<ViewToggle options={OPTIONS} value="list" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowLeft' });
    // Wraps from list (index 0) to kanban (index 2)
    expect(onChange).toHaveBeenCalledWith('kanban');
  });

  it('ArrowRight wraps from last to first', () => {
    const onChange = vi.fn();
    render(<ViewToggle options={OPTIONS} value="kanban" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('list');
  });

  it('selected tab has tabIndex=0, others have tabIndex=-1', () => {
    render(<ViewToggle options={OPTIONS} value="tree" onChange={() => {}} />);
    const treeTab = screen.getByRole('tab', { name: 'Tree view' });
    expect(treeTab).toHaveAttribute('tabindex', '0');
    const listTab = screen.getByRole('tab', { name: 'List view' });
    expect(listTab).toHaveAttribute('tabindex', '-1');
  });
});
