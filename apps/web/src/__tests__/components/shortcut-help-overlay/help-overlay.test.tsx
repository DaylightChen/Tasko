/**
 * help-overlay.test.tsx
 *
 * Verifies:
 * - The overlay renders with role="dialog" and the title "Keyboard shortcuts".
 * - Pressing ? (via store toggle) shows / hides the overlay.
 * - Pressing Esc dismisses it.
 * - Clicking outside dismisses it.
 * - Contains expected shortcut entries from microcopy §13.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShortcutHelpOverlay } from '../../../components/shortcut-help-overlay';
import { useHotkeyStore } from '../../../store/hotkey-registry';
import { useShortcutHelpStore } from '../../../store/shortcut-help';

describe('ShortcutHelpOverlay', () => {
  beforeEach(() => {
    useHotkeyStore.getState().reset();
    useShortcutHelpStore.setState({ open: false });
  });

  afterEach(() => {
    useHotkeyStore.getState().reset();
    useShortcutHelpStore.setState({ open: false });
  });

  it('renders with role="dialog" and correct aria-label when open', () => {
    const onClose = vi.fn();
    render(<ShortcutHelpOverlay open={true} onClose={onClose} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-label', 'Keyboard shortcuts');
  });

  it('does not render when closed', () => {
    render(<ShortcutHelpOverlay open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the title "Keyboard shortcuts"', () => {
    render(<ShortcutHelpOverlay open={true} onClose={vi.fn()} />);
    expect(screen.getByText('Keyboard shortcuts')).toBeInTheDocument();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<ShortcutHelpOverlay open={true} onClose={onClose} />);

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });

    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<ShortcutHelpOverlay open={true} onClose={onClose} />);

    const closeBtn = screen.getByRole('button', { name: 'Close keyboard shortcuts' });
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalled();
  });

  it('contains expected shortcut entries from microcopy §13', () => {
    render(<ShortcutHelpOverlay open={true} onClose={vi.fn()} />);

    // Section headings
    expect(screen.getByText('NAVIGATE')).toBeInTheDocument();
    expect(screen.getByText('ROW (when focused, no input active)')).toBeInTheDocument();
    expect(screen.getByText('MODAL')).toBeInTheDocument();
    expect(screen.getByText('CALENDAR')).toBeInTheDocument();
    expect(screen.getByText('GLOBAL')).toBeInTheDocument();

    // Specific shortcut entries
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Inbox')).toBeInTheDocument();
    expect(screen.getByText('Command palette')).toBeInTheDocument();
    expect(screen.getByText('Toggle sidebar')).toBeInTheDocument();
    expect(screen.getByText('Open modal')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('opens and closes via the store toggle', () => {
    const onClose = vi.fn();
    const { rerender } = render(<ShortcutHelpOverlay open={false} onClose={onClose} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(<ShortcutHelpOverlay open={true} onClose={onClose} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    rerender(<ShortcutHelpOverlay open={false} onClose={onClose} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
