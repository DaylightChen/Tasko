/**
 * Tests for ProjectRow component (task-06)
 * Covers: renders project name, color dot, isInbox flag, count badge, aria-label, selection.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProjectRow } from '../index';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    ...rest
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
    [key: string]: unknown;
  }) => {
    const href = params ? to.replace('$id', params.id ?? '') : to;
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
}));

describe('ProjectRow', () => {
  it('renders project name', () => {
    render(<ProjectRow id="p1" name="Work" selected={false} />);
    expect(screen.getByText('Work')).toBeTruthy();
  });

  it('renders color dot when color is provided', () => {
    const { container } = render(<ProjectRow id="p1" name="Work" selected={false} color="#ff0000" />);
    const dot = container.querySelector('[style*="background"]');
    expect(dot).toBeTruthy();
  });

  it('renders empty dot placeholder when color is null', () => {
    const { container } = render(<ProjectRow id="p1" name="Work" selected={false} color={null} />);
    // colorDotEmpty is rendered
    const emptyDot = container.querySelector('[aria-hidden="true"]');
    expect(emptyDot).toBeTruthy();
  });

  it('has aria-current="page" when selected', () => {
    render(<ProjectRow id="p1" name="Work" selected={true} />);
    expect(screen.getByRole('link')).toHaveAttribute('aria-current', 'page');
  });

  it('does not have aria-current when not selected', () => {
    render(<ProjectRow id="p1" name="Work" selected={false} />);
    expect(screen.getByRole('link')).not.toHaveAttribute('aria-current');
  });

  it('applies data-inbox attribute when isInbox is true', () => {
    const { container } = render(<ProjectRow id="inbox-1" name="Inbox" selected={false} isInbox />);
    expect(container.querySelector('[data-inbox]')).toBeTruthy();
  });

  it('renders count badge when count > 0', () => {
    render(<ProjectRow id="p1" name="Work" selected={false} count={7} />);
    expect(screen.getByText(/\(7\)/)).toBeTruthy();
  });

  it('includes count in aria-label', () => {
    render(<ProjectRow id="p1" name="Work" selected={false} count={7} />);
    expect(screen.getByRole('link')).toHaveAttribute('aria-label', 'Work, 7 items');
  });

  it('links to /project/$id with the project id', () => {
    render(<ProjectRow id="proj-abc" name="Work" selected={false} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/project/proj-abc');
  });
});
