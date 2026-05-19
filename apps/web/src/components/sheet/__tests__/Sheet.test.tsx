import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Sheet } from '../index';

describe('Sheet', () => {
  it('renders nothing when open=false', () => {
    render(
      <Sheet open={false} onClose={() => {}} title="Test Sheet">
        <p>Content</p>
      </Sheet>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders dialog when open=true', () => {
    render(
      <Sheet open={true} onClose={() => {}} title="Test Sheet">
        <p>Content</p>
      </Sheet>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('has aria-labelledby pointing to the title', () => {
    render(
      <Sheet open={true} onClose={() => {}} title="Edit Task">
        <p>Content</p>
      </Sheet>,
    );
    const dialog = screen.getByRole('dialog');
    const labelId = dialog.getAttribute('aria-labelledby');
    // biome-ignore lint/style/noNonNullAssertion: aria-labelledby is always set by the Sheet component
    const title = document.getElementById(labelId!);
    expect(title).toHaveTextContent('Edit Task');
  });

  it('renders drag handle button', () => {
    render(
      <Sheet open={true} onClose={() => {}} title="Test">
        <p>Content</p>
      </Sheet>,
    );
    expect(screen.getByRole('button', { name: /drag to dismiss/i })).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <Sheet open={true} onClose={onClose} title="Test">
        <p>Content</p>
      </Sheet>,
    );
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    render(
      <Sheet open={true} onClose={onClose} title="Test">
        <p>Content</p>
      </Sheet>,
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when drag handle is activated by Enter', () => {
    const onClose = vi.fn();
    render(
      <Sheet open={true} onClose={onClose} title="Test">
        <p>Content</p>
      </Sheet>,
    );
    const handle = screen.getByRole('button', { name: /drag to dismiss/i });
    fireEvent.keyDown(handle, { key: 'Enter' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders children', () => {
    render(
      <Sheet open={true} onClose={() => {}} title="Test">
        <p>Sheet body content</p>
      </Sheet>,
    );
    expect(screen.getByText('Sheet body content')).toBeInTheDocument();
  });

  it('renders footer', () => {
    render(
      <Sheet open={true} onClose={() => {}} title="Test" footer={<button type="button">Save</button>}>
        <p>Content</p>
      </Sheet>,
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });
});
