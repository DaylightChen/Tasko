/**
 * Focused tests for ConfirmationPrompt initial-focus behavior per brief §11
 * (interaction-patterns.md §11: Cancel holds initial focus for destructive variants).
 */
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConfirmationPrompt } from '../index';

describe('ConfirmationPrompt — initial focus', () => {
  it('destructive: Cancel button receives initial focus via requestAnimationFrame', async () => {
    render(
      <ConfirmationPrompt
        open={true}
        onCancel={() => {}}
        onConfirm={() => {}}
        title="Permanently delete?"
        body="This cannot be undone."
        confirmLabel="Delete forever"
        destructive={true}
      />,
    );

    // Allow the requestAnimationFrame in the useEffect to fire
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    });

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    expect(document.activeElement).toBe(cancelBtn);
  });

  it('non-destructive: Confirm button receives initial focus via requestAnimationFrame', async () => {
    render(
      <ConfirmationPrompt
        open={true}
        onCancel={() => {}}
        onConfirm={() => {}}
        title="Complete all children and continue?"
        body="This task has 3 incomplete children."
        confirmLabel="Complete all"
        destructive={false}
      />,
    );

    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    });

    const confirmBtn = screen.getByRole('button', { name: 'Complete all' });
    expect(document.activeElement).toBe(confirmBtn);
  });

  it('unsaved-changes variant: Cancel ("Keep editing") holds initial focus (destructive=true)', async () => {
    render(
      <ConfirmationPrompt
        open={true}
        onCancel={() => {}}
        onConfirm={() => {}}
        title="Discard changes?"
        body="You have unsaved edits."
        cancelLabel="Keep editing"
        confirmLabel="Discard"
        destructive={true}
      />,
    );

    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    });

    const keepEditingBtn = screen.getByRole('button', { name: 'Keep editing' });
    expect(document.activeElement).toBe(keepEditingBtn);
  });

  it('permanent-delete variant: Cancel holds focus, not confirm (destructive=true)', async () => {
    render(
      <ConfirmationPrompt
        open={true}
        onCancel={() => {}}
        onConfirm={() => {}}
        title="Empty Trash?"
        body="All 5 items in Trash will be permanently deleted. This cannot be undone."
        confirmLabel="Empty Trash"
        destructive={true}
      />,
    );

    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    });

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    const confirmBtn = screen.getByRole('button', { name: 'Empty Trash' });
    expect(document.activeElement).toBe(cancelBtn);
    expect(document.activeElement).not.toBe(confirmBtn);
  });
});
