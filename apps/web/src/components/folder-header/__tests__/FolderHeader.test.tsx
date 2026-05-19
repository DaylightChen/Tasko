/**
 * Tests for FolderHeader component (task-06)
 * Covers: expanded/collapsed state, toggle on click, aria-expanded, chevron rotation
 *         (data-expanded attr), keyboard ArrowRight/ArrowLeft, context menu callbacks.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FolderHeader } from '../index';

describe('FolderHeader', () => {
  it('renders folder name', () => {
    render(<FolderHeader name="Work" expanded={true} onToggle={() => {}} />);
    expect(screen.getByText('Work')).toBeTruthy();
  });

  it('toggle button has aria-expanded="true" when expanded', () => {
    render(<FolderHeader name="Work" expanded={true} onToggle={() => {}} />);
    expect(screen.getByRole('button', { name: /Work/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('toggle button has aria-expanded="false" when collapsed', () => {
    render(<FolderHeader name="Work" expanded={false} onToggle={() => {}} />);
    expect(screen.getByRole('button', { name: /Work/ })).toHaveAttribute('aria-expanded', 'false');
  });

  it('calls onToggle when toggle button is clicked', () => {
    const onToggle = vi.fn();
    render(<FolderHeader name="Projects" expanded={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: /Projects/ }));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('ArrowRight key expands a collapsed folder', () => {
    const onToggle = vi.fn();
    render(<FolderHeader name="Folder" expanded={false} onToggle={onToggle} />);
    fireEvent.keyDown(screen.getByRole('button', { name: /Folder/ }), { key: 'ArrowRight' });
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('ArrowRight does nothing if already expanded', () => {
    const onToggle = vi.fn();
    render(<FolderHeader name="Folder" expanded={true} onToggle={onToggle} />);
    fireEvent.keyDown(screen.getByRole('button', { name: /Folder/ }), { key: 'ArrowRight' });
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('ArrowLeft key collapses an expanded folder', () => {
    const onToggle = vi.fn();
    render(<FolderHeader name="Folder" expanded={true} onToggle={onToggle} />);
    fireEvent.keyDown(screen.getByRole('button', { name: /Folder/ }), { key: 'ArrowLeft' });
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('ArrowLeft does nothing if already collapsed', () => {
    const onToggle = vi.fn();
    render(<FolderHeader name="Folder" expanded={false} onToggle={onToggle} />);
    fireEvent.keyDown(screen.getByRole('button', { name: /Folder/ }), { key: 'ArrowLeft' });
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('expanded chevron has data-expanded attribute', () => {
    const { container } = render(<FolderHeader name="Folder" expanded={true} onToggle={() => {}} />);
    // ChevronDown is rendered with data-expanded when expanded
    expect(container.querySelector('[data-expanded]')).toBeTruthy();
  });

  it('collapsed chevron does not have data-expanded attribute', () => {
    const { container } = render(<FolderHeader name="Folder" expanded={false} onToggle={() => {}} />);
    expect(container.querySelector('[data-expanded]')).toBeNull();
  });

  it('shows children only when expanded', () => {
    const { rerender } = render(
      <FolderHeader name="Folder" expanded={true} onToggle={() => {}}>
        <span>Child item</span>
      </FolderHeader>,
    );
    expect(screen.getByText('Child item')).toBeTruthy();

    rerender(
      <FolderHeader name="Folder" expanded={false} onToggle={() => {}}>
        <span>Child item</span>
      </FolderHeader>,
    );
    expect(screen.queryByText('Child item')).toBeNull();
  });

  it('renders ⋯ more-actions button when menu callbacks are provided', () => {
    render(
      <FolderHeader
        name="Folder"
        expanded={true}
        onToggle={() => {}}
        onRename={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /More actions for Folder/ })).toBeTruthy();
  });

  it('does not render ⋯ button when no menu callbacks', () => {
    render(<FolderHeader name="Folder" expanded={true} onToggle={() => {}} />);
    expect(screen.queryByRole('button', { name: /More actions/ })).toBeNull();
  });
});
