/**
 * Tests for MultiDayChip component (task-06)
 * Covers: first-day accent, mid-span plain, last-day accent, truncation at 99+, aria-label.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MultiDayChip } from '../index';

describe('MultiDayChip', () => {
  it('renders "Day 1 of 5" text', () => {
    render(<MultiDayChip day={1} total={5} />);
    expect(screen.getByText('Day 1 of 5')).toBeTruthy();
  });

  it('first day (day=1) has data-edge attribute (accent treatment)', () => {
    const { container } = render(<MultiDayChip day={1} total={5} />);
    expect(container.querySelector('[data-edge]')).toBeTruthy();
  });

  it('last day (day=total) has data-edge attribute (accent treatment)', () => {
    const { container } = render(<MultiDayChip day={5} total={5} />);
    expect(container.querySelector('[data-edge]')).toBeTruthy();
  });

  it('middle day has no data-edge attribute (plain styling)', () => {
    const { container } = render(<MultiDayChip day={3} total={5} />);
    expect(container.querySelector('[data-edge]')).toBeNull();
  });

  it('truncates total as "99+" when total >= 99', () => {
    render(<MultiDayChip day={5} total={100} />);
    expect(screen.getByText('Day 5 of 99+')).toBeTruthy();
  });

  it('truncates exactly at 99', () => {
    render(<MultiDayChip day={5} total={99} />);
    expect(screen.getByText('Day 5 of 99+')).toBeTruthy();
  });

  it('does not truncate when total is 98', () => {
    render(<MultiDayChip day={5} total={98} />);
    expect(screen.getByText('Day 5 of 98')).toBeTruthy();
  });

  it('has aria-label "Day 1 of 5" for first day', () => {
    render(<MultiDayChip day={1} total={5} />);
    expect(screen.getByLabelText('Day 1 of 5')).toBeTruthy();
  });

  it('has aria-label with "99 or more" for large total', () => {
    render(<MultiDayChip day={2} total={100} />);
    expect(screen.getByLabelText('Day 2 of 99 or more')).toBeTruthy();
  });
});
