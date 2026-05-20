import type { Subtask, SubtaskId } from '@tasko/types';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SubtaskInlineRow } from '../index';

function makeSubtask(overrides: Partial<Subtask> = {}): Subtask {
  return {
    id: '01HXYZSUBTASK0000000000001' as SubtaskId,
    title: 'A subtask',
    status: 'todo',
    completed_at: null,
    sort_order: 1024,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('SubtaskInlineRow', () => {
  it('renders the title', () => {
    render(<SubtaskInlineRow subtask={makeSubtask({ title: 'Buy milk' })} onToggle={() => {}} onOpenParent={() => {}} />);
    expect(screen.getByText('Buy milk')).toBeInTheDocument();
  });

  it('checkbox unchecked when status=todo', () => {
    render(<SubtaskInlineRow subtask={makeSubtask({ status: 'todo' })} onToggle={() => {}} onOpenParent={() => {}} />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
  });

  it('checkbox checked when status=done', () => {
    render(<SubtaskInlineRow subtask={makeSubtask({ status: 'done' })} onToggle={() => {}} onOpenParent={() => {}} />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  it('clicking the checkbox calls onToggle with the new state', () => {
    const onToggle = vi.fn();
    render(<SubtaskInlineRow subtask={makeSubtask({ status: 'todo' })} onToggle={onToggle} onOpenParent={() => {}} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('clicking the title row calls onOpenParent (not onToggle)', () => {
    const onToggle = vi.fn();
    const onOpenParent = vi.fn();
    render(<SubtaskInlineRow subtask={makeSubtask({ title: 'Click me' })} onToggle={onToggle} onOpenParent={onOpenParent} />);
    fireEvent.click(screen.getByRole('button', { name: /click me/i }));
    expect(onOpenParent).toHaveBeenCalledTimes(1);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('checkbox click does NOT bubble to onOpenParent', () => {
    const onToggle = vi.fn();
    const onOpenParent = vi.fn();
    render(<SubtaskInlineRow subtask={makeSubtask()} onToggle={onToggle} onOpenParent={onOpenParent} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalled();
    expect(onOpenParent).not.toHaveBeenCalled();
  });
});
