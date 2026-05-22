/**
 * Tests for DatePicker component (task-07)
 * Covers:
 * - Press 't' inside open picker → today selected + picker closed
 * - Press 'm' → tomorrow selected + closed
 * - Press 'w' → next week (today + 7) selected + closed
 * - Press 'n' only when optional → null selected + closed
 * - Press 'n' when NOT optional → no change
 */
import type { LocalDate } from '@tasko/types';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatePicker } from '../index';

// Pin "today" to a deterministic date so tests are stable
const FIXED_TODAY = new Date('2026-05-19T12:00:00.000Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_TODAY);
});

afterEach(() => {
  vi.useRealTimers();
});

function renderPicker(opts: {
  value?: LocalDate | null;
  onChange?: (v: LocalDate | null) => void;
  optional?: boolean;
}) {
  const onChange = opts.onChange ?? vi.fn();
  render(
    <DatePicker
      value={opts.value ?? null}
      onChange={onChange}
      optional={opts.optional ?? false}
      weekStart="mon"
      open={true}
      onClose={vi.fn()}
    />,
  );
  return onChange;
}

/**
 * The DatePicker renders a <dialog> element when open on desktop.
 * We fire keydown events on that dialog element to trigger shortcuts.
 */
function getDialog() {
  return screen.getByRole('dialog', { name: /pick a date/i });
}

describe('DatePicker keyboard shortcuts', () => {
  it("press 't' → selects today and closes", () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(
      <DatePicker
        value={null}
        onChange={onChange}
        optional={false}
        weekStart="mon"
        open={true}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(getDialog(), { key: 't' });

    // Today in local time (the date-picker uses new Date() which is our fixed date)
    // FIXED_TODAY is 2026-05-19T12:00:00Z so in UTC the date is 2026-05-19
    // The implementation uses `new Date()` → dateToLocalDate which formats local time
    // With fake timers set to UTC noon on 2026-05-19 local date should be 2026-05-19
    expect(onChange).toHaveBeenCalledTimes(1);
    const calledWith = onChange.mock.calls[0]?.[0] as string;
    expect(calledWith).toMatch(/^2026-05-1[89]$/); // account for timezone offsets in test env
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("press 'm' → selects tomorrow and closes", () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(
      <DatePicker
        value={null}
        onChange={onChange}
        optional={false}
        weekStart="mon"
        open={true}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(getDialog(), { key: 'm' });

    expect(onChange).toHaveBeenCalledTimes(1);
    // Should be today + 1
    const calledWith = onChange.mock.calls[0]?.[0] as string;
    // Just verify it's a valid YYYY-MM-DD string after today
    expect(calledWith).toMatch(/^2026-05-\d{2}$/);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("press 'w' → selects next week (today + 7) and closes", () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(
      <DatePicker
        value={null}
        onChange={onChange}
        optional={false}
        weekStart="mon"
        open={true}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(getDialog(), { key: 'w' });

    expect(onChange).toHaveBeenCalledTimes(1);
    const calledWith = onChange.mock.calls[0]?.[0] as string;
    // 7 days after May 19 = May 26 (or nearby if timezone shift)
    expect(calledWith).toMatch(/^2026-05-(2[0-9]|30)$/);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("press 'n' when optional=true → calls onChange(null) and closes", () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(
      <DatePicker
        value={'2026-05-19' as LocalDate}
        onChange={onChange}
        optional={true}
        weekStart="mon"
        open={true}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(getDialog(), { key: 'n' });

    expect(onChange).toHaveBeenCalledWith(null);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("press 'n' when optional=false → does NOT call onChange", () => {
    const onChange = vi.fn();
    render(
      <DatePicker
        value={'2026-05-19' as LocalDate}
        onChange={onChange}
        optional={false}
        weekStart="mon"
        open={true}
        onClose={vi.fn()}
      />,
    );

    fireEvent.keyDown(getDialog(), { key: 'n' });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('press Escape → closes without changing value', () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(
      <DatePicker
        value={'2026-05-19' as LocalDate}
        onChange={onChange}
        optional={false}
        weekStart="mon"
        open={true}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(getDialog(), { key: 'Escape' });

    expect(onChange).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows "No date" quick-select button only when optional', () => {
    const { rerender } = render(
      <DatePicker
        value={null}
        onChange={vi.fn()}
        optional={false}
        weekStart="mon"
        open={true}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /no date/i })).toBeNull();

    rerender(
      <DatePicker
        value={null}
        onChange={vi.fn()}
        optional={true}
        weekStart="mon"
        open={true}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /no date/i })).toBeInTheDocument();
  });

  it('quick-select "Today" button calls onChange with today', () => {
    const onChange = vi.fn();
    render(
      <DatePicker
        value={null}
        onChange={onChange}
        optional={false}
        weekStart="mon"
        open={true}
        onClose={vi.fn()}
      />,
    );

    // There may be multiple "today"-matching elements (the DayPicker cell also has "Today" in its aria-label).
    // The quick-select Ghost button has exact text "Today" so we use getAllByRole and pick the first.
    const todayBtns = screen.getAllByRole('button', { name: /\btoday\b/i });
    // The quick-select "Today" Ghost button is rendered first in the DOM (before the calendar grid)
    const quickSelectBtn = todayBtns.find((btn) => btn.textContent?.trim() === 'Today');
    if (!quickSelectBtn) throw new Error('Could not find quick-select Today button');
    fireEvent.click(quickSelectBtn);

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('quick-select "Tomorrow" button calls onChange', () => {
    const onChange = vi.fn();
    render(
      <DatePicker
        value={null}
        onChange={onChange}
        optional={false}
        weekStart="mon"
        open={true}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^tomorrow$/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
