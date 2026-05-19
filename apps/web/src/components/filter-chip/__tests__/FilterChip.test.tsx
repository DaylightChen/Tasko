/**
 * Tests for FilterChip component (task-06)
 * Covers: label rendering, remove button, Delete/Backspace keyboard shortcut, tone variants.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FilterChip } from '../index';

describe('FilterChip', () => {
  it('renders "Facet: Value" label', () => {
    render(<FilterChip facet="Tag" value="urgent" onRemove={() => {}} />);
    expect(screen.getByText('Tag: urgent')).toBeTruthy();
  });

  it('remove button has accessible label "Remove filter: Tag: urgent"', () => {
    render(<FilterChip facet="Tag" value="urgent" onRemove={() => {}} />);
    expect(screen.getByRole('button', { name: 'Remove filter: Tag: urgent' })).toBeTruthy();
  });

  it('calls onRemove when remove button is clicked', () => {
    const onRemove = vi.fn();
    render(<FilterChip facet="Priority" value="high" onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: /Remove filter/ }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it('calls onRemove on Delete key when remove button is focused', () => {
    const onRemove = vi.fn();
    render(<FilterChip facet="Priority" value="high" onRemove={onRemove} />);
    const btn = screen.getByRole('button', { name: /Remove filter/ });
    fireEvent.keyDown(btn, { key: 'Delete' });
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it('calls onRemove on Backspace key when remove button is focused', () => {
    const onRemove = vi.fn();
    render(<FilterChip facet="Status" value="overdue" onRemove={onRemove} />);
    const btn = screen.getByRole('button', { name: /Remove filter/ });
    fireEvent.keyDown(btn, { key: 'Backspace' });
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it('applies data-tone="neutral" by default', () => {
    const { container } = render(<FilterChip facet="F" value="v" onRemove={() => {}} />);
    expect(container.querySelector('[data-tone="neutral"]')).toBeTruthy();
  });

  it('applies data-tone="accent" when specified', () => {
    const { container } = render(<FilterChip facet="F" value="v" onRemove={() => {}} tone="accent" />);
    expect(container.querySelector('[data-tone="accent"]')).toBeTruthy();
  });
});
