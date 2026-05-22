/**
 * Tests for Checkbox component (task-06)
 * Covers: checked/unchecked/indeterminate states, size variants, disabled, onChange, ARIA.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Checkbox } from '../index';

describe('Checkbox', () => {
  it('renders an unchecked checkbox', () => {
    render(<Checkbox checked={false} onChange={() => {}} aria-label="Complete task" />);
    const input = screen.getByRole('checkbox', { name: 'Complete task' });
    expect(input).toBeTruthy();
    expect((input as HTMLInputElement).checked).toBe(false);
  });

  it('renders a checked checkbox', () => {
    render(<Checkbox checked={true} onChange={() => {}} aria-label="Complete task" />);
    const input = screen.getByRole('checkbox', { name: 'Complete task' });
    expect((input as HTMLInputElement).checked).toBe(true);
  });

  it('renders indeterminate state with aria-checked="mixed"', () => {
    render(<Checkbox checked={false} indeterminate onChange={() => {}} aria-label="Select all" />);
    const input = screen.getByRole('checkbox', { name: 'Select all' });
    expect(input).toHaveAttribute('aria-checked', 'mixed');
    // indeterminate → not checked
    expect((input as HTMLInputElement).checked).toBe(false);
  });

  it('calls onChange with true when toggling unchecked', () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange} aria-label="Toggle" />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Toggle' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does not call onChange when disabled', () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange} aria-label="Disabled" disabled />);
    const input = screen.getByRole('checkbox', { name: 'Disabled' });
    expect(input).toBeDisabled();
    fireEvent.click(input);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('applies data-size="sm" for small size', () => {
    const { container } = render(
      <Checkbox checked={false} onChange={() => {}} aria-label="Small" size="sm" />,
    );
    const label = container.querySelector('[data-size="sm"]');
    expect(label).toBeTruthy();
  });

  it('applies data-size="md" for medium size (default)', () => {
    const { container } = render(<Checkbox checked={false} onChange={() => {}} aria-label="Medium" />);
    const label = container.querySelector('[data-size="md"]');
    expect(label).toBeTruthy();
  });

  it('reflects data-state="checked" when checked', () => {
    const { container } = render(<Checkbox checked={true} onChange={() => {}} aria-label="Checked" />);
    expect(container.querySelector('[data-state="checked"]')).toBeTruthy();
  });

  it('reflects data-state="unchecked" when unchecked', () => {
    const { container } = render(<Checkbox checked={false} onChange={() => {}} aria-label="Unchecked" />);
    expect(container.querySelector('[data-state="unchecked"]')).toBeTruthy();
  });

  it('reflects data-state="indeterminate" when indeterminate', () => {
    const { container } = render(
      <Checkbox checked={false} indeterminate onChange={() => {}} aria-label="Indeterminate" />,
    );
    expect(container.querySelector('[data-state="indeterminate"]')).toBeTruthy();
  });

  it('sets aria-checked to true when checked', () => {
    render(<Checkbox checked={true} onChange={() => {}} aria-label="Checked" />);
    expect(screen.getByRole('checkbox', { name: 'Checked' })).toHaveAttribute('aria-checked', 'true');
  });
});
