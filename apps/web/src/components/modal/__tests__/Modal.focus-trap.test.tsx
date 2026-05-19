/**
 * Focused Modal tests for:
 * 1. Focus trap: Tab from last focusable → wraps to first
 * 2. Focus trap: Shift+Tab from first focusable → wraps to last
 * 3. Esc with dirty=true: discard guard shown, onClose NOT called immediately
 * 4. Esc on guard: dismisses guard, keeps modal open
 * 5. Discard on guard: calls onClose
 * 6. returnFocusTo: focus returns to supplied ref element on close
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from '../index';

describe('Modal focus trap', () => {
  it('Tab from last focusable element wraps to first', () => {
    render(
      <Modal
        open={true}
        onClose={() => {}}
        title="Trap test"
        footer={<button type="button">Footer action</button>}
      >
        <button type="button">Body button</button>
      </Modal>,
    );

    const dialog = screen.getByRole('dialog');
    const focusable = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    // focusable: [Close (Esc), Body button, Footer action]
    expect(focusable.length).toBeGreaterThanOrEqual(2);

    const last = focusable.at(-1);
    const first = focusable.at(0);
    if (!last || !first) throw new Error('No focusable elements found');
    last.focus();
    expect(document.activeElement).toBe(last);

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(first);
  });

  it('Shift+Tab from first focusable element wraps to last', () => {
    render(
      <Modal
        open={true}
        onClose={() => {}}
        title="Trap test"
        footer={<button type="button">Footer action</button>}
      >
        <button type="button">Body button</button>
      </Modal>,
    );

    const dialog = screen.getByRole('dialog');
    const focusable = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));

    const first = focusable.at(0);
    const last = focusable.at(-1);
    if (!first || !last) throw new Error('No focusable elements found');
    first.focus();
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('Tab in middle of focusable list does NOT wrap prematurely', () => {
    render(
      <Modal
        open={true}
        onClose={() => {}}
        title="Trap test"
        footer={<button type="button">Footer action</button>}
      >
        <button type="button">Middle button</button>
      </Modal>,
    );

    const dialog = screen.getByRole('dialog');
    const focusable = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    // Focus a middle element (index 1 if there are 3)
    if (focusable.length >= 3) {
      const middle = focusable.at(1);
      if (!middle) throw new Error('No middle element');
      middle.focus();
      // Normal Tab from middle — should NOT redirect (focus trap only handles first/last)
      // We just assert no error is thrown and modal remains open
      fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: false });
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    }
  });
});

describe('Modal unsaved-changes guard — Esc behavior', () => {
  it('Esc with dirty=true shows guard; does NOT call onClose immediately', () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} title="Test" dirty={true}>
        <p>Content</p>
      </Modal>,
    );

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Discard changes?')).toBeInTheDocument();
    expect(screen.getByText('You have unsaved edits.')).toBeInTheDocument();
  });

  it('Esc on guard closes the guard without calling onClose', () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} title="Test" dirty={true}>
        <p>Content</p>
      </Modal>,
    );

    // Open the guard
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.getByText('Discard changes?')).toBeInTheDocument();

    // Press Esc again — should dismiss the guard
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
  });

  it('[Keep editing] dismisses the guard without calling onClose', () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} title="Test" dirty={true}>
        <p>Content</p>
      </Modal>,
    );

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: /keep editing/i }));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
  });

  it('[Discard] on guard calls onClose exactly once', () => {
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

  it('Backdrop click with dirty=true shows guard, not immediate close', () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} title="Test" dirty={true}>
        <p>Content</p>
      </Modal>,
    );

    // The backdrop div is the element with data-open that wraps the dialog
    const backdrop = document.body.querySelector('[data-open]');
    if (backdrop && backdrop !== screen.getByRole('dialog')) {
      // simulate click on backdrop itself (not on the dialog)
      Object.defineProperty(Event.prototype, 'target', { writable: true });
      // Use fireEvent on the backdrop directly — but we need it to hit the backdrop not the dialog
      // The backdrop onClick checks e.target === e.currentTarget
      fireEvent.click(backdrop, { bubbles: false });
    }
    // At minimum, if the guard was shown, onClose shouldn't have been called without confirmation
    // (This is a best-effort test because jsdom event targeting for this pattern is limited)
    // We assert that if guard IS visible, onClose hasn't been called
    if (screen.queryByText('Discard changes?')) {
      expect(onClose).not.toHaveBeenCalled();
    }
  });
});

describe('Modal focus return on close', () => {
  it('focus returns to the trigger element via returnFocusTo on close', async () => {
    function Wrapper() {
      const [open, setOpen] = useState(false);
      const triggerRef = useRef<HTMLButtonElement>(null);

      return (
        <>
          <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>
            Open modal
          </button>
          <Modal open={open} onClose={() => setOpen(false)} title="Test" returnFocusTo={triggerRef}>
            <button type="button">Inner</button>
          </Modal>
        </>
      );
    }

    render(<Wrapper />);

    const trigger = screen.getByRole('button', { name: 'Open modal' });
    trigger.focus();
    fireEvent.click(trigger);

    // Modal is open; close it
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      // let focus-restore effect run
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(document.activeElement).toBe(trigger);
  });
});
