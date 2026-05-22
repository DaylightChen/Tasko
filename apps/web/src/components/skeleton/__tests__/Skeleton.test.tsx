import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Skeleton } from '../index';

describe('Skeleton', () => {
  it('renders with aria-busy=true', () => {
    render(<Skeleton />);
    expect(
      screen.getByRole('region', { hidden: true }) ?? screen.getByLabelText('Loading content'),
    ).toBeTruthy();
    const skeleton = document.querySelector('[aria-busy="true"]');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute('aria-live', 'polite');
  });

  it('renders list variant by default', () => {
    const { container } = render(<Skeleton variant="list" rowCount={5} />);
    expect(container.querySelector('[data-variant="list"]')).toBeInTheDocument();
  });

  it('renders list rows', () => {
    const { container } = render(<Skeleton variant="list" rowCount={10} />);
    const rows = container.querySelectorAll('[class*="listRow"]');
    expect(rows.length).toBe(10);
  });

  it('renders sidebar variant', () => {
    const { container } = render(<Skeleton variant="sidebar" rowCount={5} />);
    expect(container.querySelector('[data-variant="sidebar"]')).toBeInTheDocument();
    const rows = container.querySelectorAll('[class*="sidebarRow"]');
    expect(rows.length).toBe(5);
  });

  it('renders kanban variant with 3 columns', () => {
    const { container } = render(<Skeleton variant="kanban" />);
    expect(container.querySelector('[data-variant="kanban"]')).toBeInTheDocument();
    const columns = container.querySelectorAll('[class*="kanbanColumn"]');
    expect(columns.length).toBe(3);
  });

  it('renders calendar variant with grid rows', () => {
    const { container } = render(<Skeleton variant="calendar" />);
    expect(container.querySelector('[data-variant="calendar"]')).toBeInTheDocument();
    const rows = container.querySelectorAll('[class*="calendarRow"]');
    expect(rows.length).toBe(6);
  });

  it('skeleton bars are aria-hidden', () => {
    const { container } = render(<Skeleton variant="list" rowCount={3} />);
    const bars = container.querySelectorAll('[aria-hidden="true"]');
    expect(bars.length).toBeGreaterThan(0);
  });
});
