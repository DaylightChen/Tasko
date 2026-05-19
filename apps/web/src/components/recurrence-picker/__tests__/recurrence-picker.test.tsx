/**
 * Tests for RecurrencePicker component (task-07)
 * Covers:
 * - Default state: frequency = "Never", no anchor section shown
 * - Switching to "Weekly on…" → weekday checkbox group appears
 * - Switching to "Monthly on day N" → day-of-month number input appears
 * - Anchor radio defaults to "on_schedule" when a recurrence is set
 * - Switching back to "Never" → clears the rule (calls onChange(null))
 */
import type { RecurrenceRule } from '@tasko/types';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { RecurrencePicker } from '../index';

// Controlled wrapper so we can test state transitions
function ControlledRecurrencePicker({
  initial = null,
  onChange: onChangeProp,
}: {
  initial?: RecurrenceRule | null;
  onChange?: (v: RecurrenceRule | null) => void;
}) {
  const [value, setValue] = useState<RecurrenceRule | null>(initial);
  const handleChange = (v: RecurrenceRule | null) => {
    setValue(v);
    onChangeProp?.(v);
  };
  return <RecurrencePicker value={value} onChange={handleChange} />;
}

describe('RecurrencePicker — frequency switching', () => {
  it('renders "Never" as default when value is null', () => {
    render(<RecurrencePicker value={null} onChange={vi.fn()} />);
    // The Dropdown trigger should show "Never"
    expect(screen.getByText('Never')).toBeInTheDocument();
  });

  it('does not render anchor section when frequency is Never (value=null)', () => {
    render(<RecurrencePicker value={null} onChange={vi.fn()} />);
    expect(screen.queryByRole('radiogroup', { name: /anchor/i })).toBeNull();
  });

  it('switching to Weekly → weekday checkbox group appears', () => {
    render(<ControlledRecurrencePicker initial={null} />);

    // Open the frequency dropdown and select "Weekly on…"
    const trigger = screen.getByRole('combobox', { name: /repeat/i });
    fireEvent.click(trigger);

    const weeklyOption = screen.getByRole('option', { name: /weekly/i });
    fireEvent.click(weeklyOption);

    // Weekday checkboxes should appear (Mon, Tue, etc.)
    expect(screen.getByRole('group', { name: /weekdays/i })).toBeInTheDocument();
    // At least Mon checkbox
    expect(screen.getByRole('checkbox', { name: /mon/i })).toBeInTheDocument();
  });

  it('switching to Monthly → day-of-month number input appears', () => {
    render(<ControlledRecurrencePicker initial={null} />);

    const trigger = screen.getByRole('combobox', { name: /repeat/i });
    fireEvent.click(trigger);

    const monthlyOption = screen.getByRole('option', { name: /monthly/i });
    fireEvent.click(monthlyOption);

    // Day of month number input
    const dayInput = screen.getByLabelText(/day of month/i);
    expect(dayInput).toBeInTheDocument();
    expect(dayInput).toHaveAttribute('type', 'number');
  });

  it('anchor radio defaults to "On schedule" when frequency is set', () => {
    render(
      <RecurrencePicker value={{ frequency: 'daily', anchor_mode: 'on_schedule' }} onChange={vi.fn()} />,
    );

    const onScheduleRadio = screen.getByRole('radio', { name: /on schedule/i }) as HTMLInputElement;
    expect(onScheduleRadio.checked).toBe(true);

    const afterCompletionRadio = screen.getByRole('radio', {
      name: /after completion/i,
    }) as HTMLInputElement;
    expect(afterCompletionRadio.checked).toBe(false);
  });

  it('switching to Never calls onChange(null)', () => {
    const onChange = vi.fn();
    render(
      <RecurrencePicker value={{ frequency: 'daily', anchor_mode: 'on_schedule' }} onChange={onChange} />,
    );

    const trigger = screen.getByRole('combobox', { name: /repeat/i });
    fireEvent.click(trigger);
    const neverOption = screen.getByRole('option', { name: /never/i });
    fireEvent.click(neverOption);

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('switching Never → Weekly → Monthly: correct fields at each step', () => {
    render(<ControlledRecurrencePicker initial={null} />);

    // Step 1: Never → Weekly
    const trigger = screen.getByRole('combobox', { name: /repeat/i });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('option', { name: /weekly/i }));

    expect(screen.getByRole('group', { name: /weekdays/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/day of month/i)).toBeNull();

    // Step 2: Weekly → Monthly
    fireEvent.click(screen.getByRole('combobox', { name: /repeat/i }));
    fireEvent.click(screen.getByRole('option', { name: /monthly/i }));

    expect(screen.queryByRole('group', { name: /weekdays/i })).toBeNull();
    expect(screen.getByLabelText(/day of month/i)).toBeInTheDocument();
  });

  it('anchor section appears for weekly frequency and defaults to on_schedule', () => {
    render(
      <RecurrencePicker
        value={{ frequency: 'weekly', weekdays: ['mon'], anchor_mode: 'on_schedule' }}
        onChange={vi.fn()}
      />,
    );

    const radioGroup = screen.getByRole('radiogroup', { name: /anchor/i });
    expect(radioGroup).toBeInTheDocument();

    const onSchedule = screen.getByRole('radio', { name: /on schedule/i }) as HTMLInputElement;
    expect(onSchedule.checked).toBe(true);
  });
});
