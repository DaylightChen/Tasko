/**
 * Tests for SidebarNavItem component (task-06)
 * Covers: label, count badge, overdue sub-badge, aria-current, aria-label with counts.
 */
import { render, screen } from '@testing-library/react';
import { Sun } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { SidebarNavItem } from '../index';

// Mock TanStack Router Link
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string; [key: string]: unknown }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

describe('SidebarNavItem', () => {
  it('renders the label text', () => {
    render(<SidebarNavItem to="/today" label="Today" selected={false} />);
    expect(screen.getByText('Today')).toBeTruthy();
  });

  it('renders an anchor with the correct href', () => {
    render(<SidebarNavItem to="/today" label="Today" selected={false} />);
    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('href', '/today');
  });

  it('has aria-current="page" when selected', () => {
    render(<SidebarNavItem to="/today" label="Today" selected={true} />);
    expect(screen.getByRole('link')).toHaveAttribute('aria-current', 'page');
  });

  it('does not have aria-current when not selected', () => {
    render(<SidebarNavItem to="/today" label="Today" selected={false} />);
    expect(screen.getByRole('link')).not.toHaveAttribute('aria-current');
  });

  it('does not render count badge when count is undefined', () => {
    const { container } = render(<SidebarNavItem to="/today" label="Today" selected={false} />);
    // No badge span
    expect(container.querySelector('[class*="badge"]')).toBeNull();
  });

  it('renders count badge "5" when count=5', () => {
    const { container } = render(<SidebarNavItem to="/today" label="Today" count={5} selected={false} />);
    const badge = container.querySelector('[class*="badge"]') as HTMLElement | null;
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toContain('5');
  });

  it('does not render badge when count=0', () => {
    const { container } = render(<SidebarNavItem to="/today" label="Today" count={0} selected={false} />);
    expect(container.querySelector('[class*="badge"]')).toBeNull();
  });

  it('renders overdue sub-badge when overdueCount > 0', () => {
    render(<SidebarNavItem to="/today" label="Today" count={5} overdueCount={3} selected={false} />);
    // The overdue number "3" appears in the badge
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('includes count and overdue in aria-label', () => {
    render(<SidebarNavItem to="/today" label="Today" count={5} overdueCount={3} selected={false} />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('aria-label')).toContain('Today');
    expect(link.getAttribute('aria-label')).toContain('5 items');
    expect(link.getAttribute('aria-label')).toContain('3 overdue');
  });

  it('includes count but not overdue in aria-label when overdueCount=0', () => {
    render(<SidebarNavItem to="/today" label="Today" count={3} overdueCount={0} selected={false} />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('aria-label')).toContain('3 items');
    expect(link.getAttribute('aria-label') ?? '').not.toContain('overdue');
  });

  it('renders icon when provided', () => {
    const { container } = render(<SidebarNavItem to="/today" icon={Sun} label="Today" selected={false} />);
    // Lucide SVG is rendered inside an aria-hidden span
    const iconSpan = container.querySelector('[aria-hidden="true"]');
    expect(iconSpan).toBeTruthy();
  });

  it('applies data-disabled when disabled', () => {
    const { container } = render(<SidebarNavItem to="/today" label="Today" selected={false} disabled />);
    expect(container.querySelector('[data-disabled]')).toBeTruthy();
  });
});
