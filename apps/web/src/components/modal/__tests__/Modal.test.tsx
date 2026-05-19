import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from '../index';

describe('Modal', () => {
  it('renders nothing when open=false', () => {
    render(
      <Modal open={false} onClose={() => {}} title="Test Modal">
        <p>Content</p>
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders dialog when open=true', () => {
    render(
      <Modal open={true} onClose={() => {}} title="Test Modal">
        <p>Content</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('has aria-labelledby pointing to the title', () => {
    render(
      <Modal open={true} onClose={() => {}} title="Add project">
        <p>Content</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    const titleId = dialog.getAttribute('aria-labelledby');
    expect(titleId).toBeTruthy();
    // biome-ignore lint/style/noNonNullAssertion: guarded by expect(titleId).toBeTruthy() above
    const title = document.getElementById(titleId!);
    expect(title).toHaveTextContent('Add project');
  });

  it('renders alertdialog role when specified', () => {
    render(
      <Modal open={true} onClose={() => {}} title="Alert" role="alertdialog">
        <p>Content</p>
      </Modal>,
    );
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} title="Test">
        <p>Content</p>
      </Modal>,
    );
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on Escape when not dirty', () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} title="Test">
        <p>Content</p>
      </Modal>,
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open={true} onClose={onClose} title="Test">
        <p>Content</p>
      </Modal>,
    );
    // The backdrop is the fixed overlay div wrapping the dialog
    const backdrop = container.ownerDocument.body.querySelector('[data-open]');
    if (backdrop && backdrop !== screen.getByRole('dialog')) {
      fireEvent.click(backdrop);
    }
    // Fallback: test that backdrop click logic works by clicking the overlay
    expect(onClose).toHaveBeenCalled();
  });

  it('shows unsaved-changes guard when dirty=true and Esc is pressed', () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} title="Test" dirty={true}>
        <p>Content</p>
      </Modal>,
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    // Guard should appear instead of immediately closing
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Discard changes?')).toBeInTheDocument();
  });

  it('does not close when Keep editing is clicked in guard', () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} title="Test" dirty={true}>
        <p>Content</p>
      </Modal>,
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.getByText('Discard changes?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /keep editing/i }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
  });

  it('calls onClose when Discard is clicked in guard', () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} title="Test" dirty={true}>
        <p>Content</p>
      </Modal>,
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: /discard/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('traps focus: Tab from last element returns to first', () => {
    render(
      <Modal open={true} onClose={() => {}} title="Test" footer={<button type="button">Footer btn</button>}>
        <button type="button">First btn</button>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    const focusable = dialog.querySelectorAll('button');
    // biome-ignore lint/style/noNonNullAssertion: querySelectorAll returns NodeList from rendered buttons we know exist
    const lastBtn = focusable[focusable.length - 1]!;
    lastBtn.focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: false });
    // After Tab from last, first focusable should be focused
    expect(document.activeElement).toBe(focusable[0]);
  });

  it('traps focus: Shift+Tab from first element goes to last', () => {
    render(
      <Modal open={true} onClose={() => {}} title="Test" footer={<button type="button">Footer btn</button>}>
        <button type="button">First btn</button>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    const focusable = dialog.querySelectorAll('button');
    // biome-ignore lint/style/noNonNullAssertion: querySelectorAll returns NodeList from rendered buttons we know exist
    const firstBtn = focusable[0]!;
    firstBtn.focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(focusable[focusable.length - 1]);
  });

  it('renders footer content', () => {
    render(
      <Modal open={true} onClose={() => {}} title="Test" footer={<button type="button">Save</button>}>
        <p>Body</p>
      </Modal>,
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('renders children in body', () => {
    render(
      <Modal open={true} onClose={() => {}} title="Test">
        <p>Modal body content</p>
      </Modal>,
    );
    expect(screen.getByText('Modal body content')).toBeInTheDocument();
  });

  it('renders with custom maxWidth', () => {
    render(
      <Modal open={true} onClose={() => {}} title="Test" maxWidth={400}>
        <p>Content</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveStyle({ maxWidth: '400px' });
  });

  it('smoke test: renders correctly under prefers-reduced-motion', () => {
    // jsdom doesn't compute styles from @media, but the modal should still render
    render(
      <Modal open={true} onClose={() => {}} title="Reduced motion test">
        <p>Content</p>
      </Modal>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
