/**
 * Tests for SubtaskCheckbox component (task-06)
 * Covers: renders as small checkbox (size sm), only todo/done, no indeterminate.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SubtaskCheckbox } from '../index';

describe('SubtaskCheckbox', () => {
  it('renders a checkbox', () => {
    render(<SubtaskCheckbox checked={false} onChange={() => {}} aria-label="Complete subtask" />);
    expect(screen.getByRole('checkbox', { name: 'Complete subtask' })).toBeTruthy();
  });

  it('applies sm size (data-size="sm")', () => {
    const { container } = render(<SubtaskCheckbox checked={false} onChange={() => {}} aria-label="Small" />);
    expect(container.querySelector('[data-size="sm"]')).toBeTruthy();
  });

  it('does not apply data-state="indeterminate" (no indeterminate prop)', () => {
    const { container } = render(
      <SubtaskCheckbox checked={false} onChange={() => {}} aria-label="No indeterminate" />,
    );
    expect(container.querySelector('[data-state="indeterminate"]')).toBeNull();
  });

  it('renders as checked when checked=true', () => {
    render(<SubtaskCheckbox checked={true} onChange={() => {}} aria-label="Done" />);
    expect((screen.getByRole('checkbox', { name: 'Done' }) as HTMLInputElement).checked).toBe(true);
  });
});
