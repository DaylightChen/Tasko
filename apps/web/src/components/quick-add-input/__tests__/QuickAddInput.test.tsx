/**
 * Tests for QuickAddInput component (task-06)
 * Covers: placeholder text, onCommit on Enter, Escape clears/blurs, autoFocus prop.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuickAddInput } from '../index';

describe('QuickAddInput', () => {
  it('renders input with placeholder text', () => {
    render(<QuickAddInput placeholder="Add a task..." onCommit={() => {}} />);
    expect(screen.getByPlaceholderText('Add a task...')).toBeTruthy();
  });

  it('uses placeholder as aria-label', () => {
    render(<QuickAddInput placeholder="Add a task to Today" onCommit={() => {}} />);
    expect(screen.getByRole('textbox', { name: 'Add a task to Today' })).toBeTruthy();
  });

  it('calls onCommit with trimmed title on Enter', () => {
    const onCommit = vi.fn();
    render(<QuickAddInput placeholder="Add..." onCommit={onCommit} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '  Buy milk  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith('Buy milk');
  });

  it('does not call onCommit when input is empty on Enter', () => {
    const onCommit = vi.fn();
    render(<QuickAddInput placeholder="Add..." onCommit={onCommit} />);
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('does not call onCommit when input is only whitespace', () => {
    const onCommit = vi.fn();
    render(<QuickAddInput placeholder="Add..." onCommit={onCommit} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('clears the input after committing', () => {
    const onCommit = vi.fn();
    render(<QuickAddInput placeholder="Add..." onCommit={onCommit} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'New task' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input.value).toBe('');
  });

  it('clears input on Escape', () => {
    render(<QuickAddInput placeholder="Add..." onCommit={() => {}} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Draft task' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.value).toBe('');
  });

  // Placeholder text per view — per microcopy §2
  it('accepts custom placeholder matching Today view microcopy', () => {
    render(<QuickAddInput placeholder="Add task to Today..." onCommit={() => {}} />);
    expect(screen.getByPlaceholderText('Add task to Today...')).toBeTruthy();
  });

  it('accepts custom placeholder matching Inbox view microcopy', () => {
    render(<QuickAddInput placeholder="Add to Inbox..." onCommit={() => {}} />);
    expect(screen.getByPlaceholderText('Add to Inbox...')).toBeTruthy();
  });

  it('accepts custom placeholder matching Project view microcopy', () => {
    render(<QuickAddInput placeholder="Add task to Work..." onCommit={() => {}} />);
    expect(screen.getByPlaceholderText('Add task to Work...')).toBeTruthy();
  });
});
