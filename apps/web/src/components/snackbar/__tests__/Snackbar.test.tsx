import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Snackbar } from '../index';

describe('Snackbar', () => {
  it('renders text content', () => {
    render(<Snackbar variant="success" text="Task completed." onDismiss={() => {}} />);
    expect(screen.getByText('Task completed.')).toBeInTheDocument();
  });

  it('has role=status and aria-live=polite for success variant', () => {
    render(<Snackbar variant="success" text="Task completed." onDismiss={() => {}} />);
    const snackbar = screen.getByRole('status');
    expect(snackbar).toHaveAttribute('aria-live', 'polite');
    expect(snackbar).toHaveAttribute('aria-atomic', 'true');
  });

  it('has role=status and aria-live=polite for info variant', () => {
    render(<Snackbar variant="info" text="Info message." onDismiss={() => {}} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('has role=status and aria-live=polite for restored variant', () => {
    render(<Snackbar variant="restored" text="Restored." onDismiss={() => {}} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('has role=alert and aria-live=assertive for error variant', () => {
    render(<Snackbar variant="error" text="Error occurred." onDismiss={() => {}} />);
    const snackbar = screen.getByRole('alert');
    expect(snackbar).toHaveAttribute('aria-live', 'assertive');
    expect(snackbar).toHaveAttribute('aria-atomic', 'true');
  });

  it('has role=alert and aria-live=assertive for depth-cap variant', () => {
    render(<Snackbar variant="depth-cap" text="Can't move there." onDismiss={() => {}} />);
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
  });

  it('renders action button when action is provided', () => {
    render(
      <Snackbar
        variant="success"
        text="Task completed."
        action={{ label: 'Undo', onClick: () => {} }}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });

  it('does not render action button when no action', () => {
    render(<Snackbar variant="success" text="Saved." onDismiss={() => {}} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls action.onClick and onDismiss when action button is clicked', () => {
    const actionOnClick = vi.fn();
    const onDismiss = vi.fn();
    render(
      <Snackbar
        variant="success"
        text="Task completed."
        action={{ label: 'Undo', onClick: actionOnClick }}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(actionOnClick).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does NOT steal focus on mount', () => {
    const focusedBefore = document.createElement('button');
    document.body.appendChild(focusedBefore);
    focusedBefore.focus();

    render(<Snackbar variant="success" text="Task completed." onDismiss={() => {}} />);

    // Focus should still be on the previously focused element
    expect(document.activeElement).toBe(focusedBefore);
    document.body.removeChild(focusedBefore);
  });
});
