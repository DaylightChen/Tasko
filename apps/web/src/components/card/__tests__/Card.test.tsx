/**
 * Tests for Card component (task-06)
 * Covers: renders children, selected/dragging data-state, role=button when clickable.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Card } from '../index';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeTruthy();
  });

  it('has no data-state when neither selected nor dragging', () => {
    const { container } = render(<Card>Content</Card>);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('data-state')).toBeNull();
  });

  it('has data-state="selected" when selected', () => {
    const { container } = render(<Card selected>Content</Card>);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('data-state')).toBe('selected');
  });

  it('has data-state="dragging" when dragging', () => {
    const { container } = render(<Card dragging>Content</Card>);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('data-state')).toBe('dragging');
  });

  it('has data-state with both selected and dragging', () => {
    const { container } = render(
      <Card selected dragging>
        Content
      </Card>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('data-state')).toContain('selected');
    expect(root.getAttribute('data-state')).toContain('dragging');
  });

  it('has role="button" when onClick is provided', () => {
    render(<Card onClick={() => {}}>Clickable</Card>);
    expect(screen.getByRole('button', { name: /Clickable/ })).toBeTruthy();
  });

  it('does not have role="button" when onClick is absent', () => {
    const { container } = render(<Card>Static</Card>);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('role')).toBeNull();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(
      <Card onClick={onClick} aria-label="My card" tabIndex={0}>
        Click me
      </Card>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'My card' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('calls onClick on Enter key', () => {
    const onClick = vi.fn();
    render(
      <Card onClick={onClick} aria-label="Key card" tabIndex={0}>
        Press Enter
      </Card>,
    );
    fireEvent.keyDown(screen.getByRole('button', { name: 'Key card' }), { key: 'Enter' });
    expect(onClick).toHaveBeenCalledOnce();
  });
});
