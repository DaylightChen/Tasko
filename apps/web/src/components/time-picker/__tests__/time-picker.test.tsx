/**
 * Tests for TimePicker component (task-07 iteration-2 tester addition)
 * Covers:
 * - Typing an invalid string in the free-text field + blur → shows 'Enter a valid time (HH:MM).'
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TimePicker } from '../index';

describe('TimePicker — free-text validation', () => {
  it("typing 'abc' in the free-text field then blurring shows 'Enter a valid time (HH:MM).' error", () => {
    render(<TimePicker value={null} onChange={vi.fn()} open={true} onClose={vi.fn()} isMobile={false} />);

    const freeTextInput = screen.getByRole('textbox', { name: /enter time/i });

    // Type an invalid value and blur
    fireEvent.change(freeTextInput, { target: { value: 'abc' } });
    fireEvent.blur(freeTextInput);

    // Error message should appear with the updated string from iteration-2 fix
    expect(screen.getByText('Enter a valid time (HH:MM).')).toBeInTheDocument();
  });
});
