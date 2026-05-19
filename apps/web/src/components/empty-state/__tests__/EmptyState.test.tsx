import { fireEvent, render, screen } from '@testing-library/react';
import { Inbox } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from '../index';

describe('EmptyState', () => {
  it('renders headline and subline', () => {
    render(
      <EmptyState
        icon={Inbox}
        headline="Inbox is clear."
        subline="Quick-add lands here when no project is picked."
      />,
    );
    expect(screen.getByText('Inbox is clear.')).toBeInTheDocument();
    expect(screen.getByText('Quick-add lands here when no project is picked.')).toBeInTheDocument();
  });

  it('renders icon with aria-hidden', () => {
    render(<EmptyState icon={Inbox} headline="Empty" subline="No items." />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders action button when action is provided', () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        icon={Inbox}
        headline="No matches."
        subline="Try removing a filter."
        action={{ label: 'Clear filters', onClick }}
      />,
    );
    const btn = screen.getByRole('button', { name: 'Clear filters' });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not render action button when no action provided', () => {
    render(<EmptyState icon={Inbox} headline="Empty" subline="Nothing here." />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('applies neutral tone by default', () => {
    const { container } = render(<EmptyState icon={Inbox} headline="Empty" subline="Nothing here." />);
    expect(container.firstChild).toHaveAttribute('data-tone', 'neutral');
  });

  it('applies flourish tone when specified', () => {
    const { container } = render(
      <EmptyState icon={Inbox} headline="Welcome to Tasko." subline="Add your first task." tone="flourish" />,
    );
    expect(container.firstChild).toHaveAttribute('data-tone', 'flourish');
  });

  it('headline uses h2 element', () => {
    render(<EmptyState icon={Inbox} headline="Nothing due today." subline="You're caught up." />);
    const h2 = screen.getByRole('heading', { level: 2 });
    expect(h2).toHaveTextContent('Nothing due today.');
  });
});
