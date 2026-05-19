import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmationPrompt } from '../index';
import {
  deleteFolderVariant,
  deleteProjectVariant,
  emptyTrashVariant,
  moveOverdueVariant,
  parentCompletionVariant,
  permanentDeleteVariant,
  softDeleteSingleVariant,
  unsavedChangesVariant,
} from '../variants';

describe('ConfirmationPrompt', () => {
  it('renders title and body', () => {
    render(
      <ConfirmationPrompt
        open={true}
        onCancel={() => {}}
        onConfirm={() => {}}
        title="Delete forever?"
        body="This cannot be undone."
        confirmLabel="Delete forever"
      />,
    );
    expect(screen.getByText('Delete forever?')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
  });

  it('uses alertdialog role', () => {
    render(
      <ConfirmationPrompt
        open={true}
        onCancel={() => {}}
        onConfirm={() => {}}
        title="Confirm"
        body="Are you sure?"
        confirmLabel="Yes"
      />,
    );
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmationPrompt
        open={true}
        onCancel={onCancel}
        onConfirm={() => {}}
        title="Confirm"
        body="Body"
        confirmLabel="OK"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm when confirm button is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmationPrompt
        open={true}
        onCancel={() => {}}
        onConfirm={onConfirm}
        title="Confirm"
        body="Body"
        confirmLabel="Delete"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('uses custom cancelLabel', () => {
    render(
      <ConfirmationPrompt
        open={true}
        onCancel={() => {}}
        onConfirm={() => {}}
        title="Discard?"
        body="You have unsaved edits."
        cancelLabel="Keep editing"
        confirmLabel="Discard"
      />,
    );
    expect(screen.getByRole('button', { name: 'Keep editing' })).toBeInTheDocument();
  });

  it('destructive prompt uses destructive button style', () => {
    render(
      <ConfirmationPrompt
        open={true}
        onCancel={() => {}}
        onConfirm={() => {}}
        title="Permanently delete?"
        body="Cannot be undone."
        confirmLabel="Delete forever"
        destructive={true}
      />,
    );
    const confirmBtn = screen.getByRole('button', { name: 'Delete forever' });
    expect(confirmBtn).toHaveAttribute('data-variant', 'destructive');
  });

  it('non-destructive prompt uses primary button style', () => {
    render(
      <ConfirmationPrompt
        open={true}
        onCancel={() => {}}
        onConfirm={() => {}}
        title="Complete all?"
        body="All children will be marked done."
        confirmLabel="Complete all"
        destructive={false}
      />,
    );
    const confirmBtn = screen.getByRole('button', { name: 'Complete all' });
    expect(confirmBtn).toHaveAttribute('data-variant', 'primary');
  });

  it('shows loading state on confirm button when isPending', () => {
    render(
      <ConfirmationPrompt
        open={true}
        onCancel={() => {}}
        onConfirm={() => {}}
        title="Confirm"
        body="Body"
        confirmLabel="Save"
        isPending={true}
      />,
    );
    const confirmBtn = screen.getByRole('button', { name: /save/i });
    expect(confirmBtn).toHaveAttribute('aria-busy', 'true');
  });

  it('renders nothing when open=false', () => {
    render(
      <ConfirmationPrompt
        open={false}
        onCancel={() => {}}
        onConfirm={() => {}}
        title="Confirm"
        body="Body"
        confirmLabel="OK"
      />,
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  // --- variant builders ---
  it('parentCompletionVariant produces correct props', () => {
    const props = parentCompletionVariant(3);
    expect(props.title).toBe('Complete all children and continue?');
    expect(props.body).toContain('3 incomplete');
    expect(props.confirmLabel).toBe('Complete all');
    expect(props.destructive).toBe(false);
  });

  it('softDeleteSingleVariant produces correct props', () => {
    const props = softDeleteSingleVariant('My Task');
    expect(props.title).toBe('Move to Trash?');
    expect(props.body).toContain('"My Task"');
    expect(props.confirmLabel).toBe('Move to Trash');
    expect(props.destructive).toBe(false);
  });

  it('permanentDeleteVariant produces correct props', () => {
    const props = permanentDeleteVariant();
    expect(props.title).toBe('Permanently delete?');
    expect(props.confirmLabel).toBe('Delete forever');
    expect(props.destructive).toBe(true);
  });

  it('emptyTrashVariant produces correct props', () => {
    const props = emptyTrashVariant(5);
    expect(props.title).toBe('Empty Trash?');
    expect(props.body).toContain('5 items');
    expect(props.confirmLabel).toBe('Empty Trash');
    expect(props.destructive).toBe(true);
  });

  it('moveOverdueVariant produces correct props', () => {
    const props = moveOverdueVariant(7);
    expect(props.title).toBe('Move 7 overdue items to today?');
    expect(props.confirmLabel).toBe('Move all');
    expect(props.destructive).toBe(false);
  });

  it('unsavedChangesVariant produces correct props', () => {
    const props = unsavedChangesVariant();
    expect(props.title).toBe('Discard changes?');
    expect(props.cancelLabel).toBe('Keep editing');
    expect(props.confirmLabel).toBe('Discard');
    expect(props.destructive).toBe(true);
  });

  it('deleteFolderVariant produces correct props', () => {
    const props = deleteFolderVariant('Work');
    expect(props.title).toBe('Delete folder "Work"?');
    expect(props.confirmLabel).toBe('Delete folder');
    expect(props.destructive).toBe(true);
  });

  it('deleteProjectVariant produces correct props', () => {
    const props = deleteProjectVariant('Q3 Launch', 12);
    expect(props.title).toBe('Delete project "Q3 Launch"?');
    expect(props.body).toContain('12 active items');
    expect(props.confirmLabel).toBe('Delete project');
    expect(props.destructive).toBe(true);
  });
});
