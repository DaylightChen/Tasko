import { render, screen } from '@testing-library/react';
import { Settings } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { IconButton } from '../index';

describe('IconButton', () => {
  it('renders with required aria-label', () => {
    render(<IconButton icon={Settings} aria-label="Settings" />);
    const btn = screen.getByRole('button', { name: 'Settings' });
    expect(btn).toBeInTheDocument();
  });

  it('applies default transparent variant', () => {
    render(<IconButton icon={Settings} aria-label="Settings" />);
    expect(screen.getByRole('button')).toHaveAttribute('data-variant', 'transparent');
  });

  it('applies subtle variant', () => {
    render(<IconButton icon={Settings} aria-label="Settings" variant="subtle" />);
    expect(screen.getByRole('button')).toHaveAttribute('data-variant', 'subtle');
  });

  it('applies sm size', () => {
    render(<IconButton icon={Settings} aria-label="Settings" size="sm" />);
    expect(screen.getByRole('button')).toHaveAttribute('data-size', 'sm');
  });

  it('applies md size by default', () => {
    render(<IconButton icon={Settings} aria-label="Settings" />);
    expect(screen.getByRole('button')).toHaveAttribute('data-size', 'md');
  });

  it('applies lg size', () => {
    render(<IconButton icon={Settings} aria-label="Settings" size="lg" />);
    expect(screen.getByRole('button')).toHaveAttribute('data-size', 'lg');
  });

  it('shows selected state', () => {
    render(<IconButton icon={Settings} aria-label="Settings" selected />);
    expect(screen.getByRole('button')).toHaveAttribute('data-selected', '');
  });

  it('is disabled when disabled prop is set', () => {
    render(<IconButton icon={Settings} aria-label="Settings" disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true');
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<IconButton icon={Settings} aria-label="Settings" onClick={onClick} />);
    screen.getByRole('button').click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders icon with aria-hidden', () => {
    render(<IconButton icon={Settings} aria-label="Settings" />);
    const svg = screen.getByRole('button').querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });
});
