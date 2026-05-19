/**
 * bulk-delete-confirm.test.tsx
 *
 * Covers:
 * - When 5+ items are selected and Delete is clicked, a confirmation prompt
 *   appears BEFORE calling bulkDelete.mutate.
 * - Confirming in the dialog calls bulkDelete.mutate.
 * - Cancelling does NOT call bulkDelete.mutate.
 */
import type { ItemId } from '@tasko/types';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/bulk', () => ({
  useBulkDelete: vi.fn(),
  useBulkComplete: vi.fn(),
  useBulkMoveToProject: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useBulkMoveOverdue: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

import { useBulkComplete, useBulkDelete } from '../../api/bulk';
import { useMultiSelectStore } from '../../store/multi-select';
import { BulkActionsToolbar } from '../_shared/BulkActionsToolbar';

const noopMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

describe('BulkActionsToolbar — delete confirmation for 5+ items', () => {
  beforeEach(() => {
    useMultiSelectStore.getState().clear();
    vi.clearAllMocks();

    vi.mocked(useBulkComplete).mockReturnValue(noopMutation as unknown as ReturnType<typeof useBulkComplete>);
  });

  afterEach(() => {
    act(() => {});
    useMultiSelectStore.getState().clear();
  });

  function selectNItems(n: number) {
    act(() => {
      for (let i = 1; i <= n; i++) {
        useMultiSelectStore.getState().add(`item-${i}` as ItemId, 'list');
      }
    });
  }

  it('clicking Delete with 5 selected items opens confirmation dialog BEFORE mutating', () => {
    const deleteMutate = vi.fn();
    vi.mocked(useBulkDelete).mockReturnValue({
      mutate: deleteMutate,
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useBulkDelete>);

    selectNItems(5);
    render(<BulkActionsToolbar />);

    const deleteBtn = screen.getByRole('button', { name: /^delete$/i });
    fireEvent.click(deleteBtn);

    // mutate should NOT be called yet (confirmation opens first)
    expect(deleteMutate).not.toHaveBeenCalled();

    // Confirmation dialog should be visible
    expect(screen.getByText(/move 5 items to trash\?/i)).toBeTruthy();
  });

  it('clicking Delete with exactly 4 items does NOT open confirmation', () => {
    const deleteMutate = vi.fn();
    vi.mocked(useBulkDelete).mockReturnValue({
      mutate: deleteMutate,
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useBulkDelete>);

    selectNItems(4);
    render(<BulkActionsToolbar />);

    const deleteBtn = screen.getByRole('button', { name: /^delete$/i });
    fireEvent.click(deleteBtn);

    // mutate IS called immediately (no confirmation for N < 5)
    expect(deleteMutate).toHaveBeenCalledTimes(1);
    // No dialog
    expect(screen.queryByText(/move 4 items to trash\?/i)).toBeNull();
  });

  it('confirming in dialog calls deleteMutate', () => {
    const deleteMutate = vi.fn();
    vi.mocked(useBulkDelete).mockReturnValue({
      mutate: deleteMutate,
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useBulkDelete>);

    selectNItems(6);
    render(<BulkActionsToolbar />);

    // Click delete to open dialog
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(deleteMutate).not.toHaveBeenCalled();

    // Find and click the confirm button in the dialog
    const confirmBtn = screen.getByRole('button', { name: /move to trash/i });
    fireEvent.click(confirmBtn);

    expect(deleteMutate).toHaveBeenCalledTimes(1);
  });

  it('cancelling the confirmation does NOT call deleteMutate', () => {
    const deleteMutate = vi.fn();
    vi.mocked(useBulkDelete).mockReturnValue({
      mutate: deleteMutate,
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useBulkDelete>);

    selectNItems(5);
    render(<BulkActionsToolbar />);

    // Open dialog
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    // Two "Cancel" buttons exist: the toolbar's own Cancel + the ConfirmationPrompt's Cancel.
    // The ConfirmationPrompt's Cancel is the last one rendered.
    const allCancelBtns = screen.getAllByRole('button', { name: /^cancel$/i });
    const dialogCancelBtn = allCancelBtns[allCancelBtns.length - 1];
    act(() => {
      if (dialogCancelBtn) fireEvent.click(dialogCancelBtn);
    });

    expect(deleteMutate).not.toHaveBeenCalled();
  });
});
