/**
 * bulk-toolbar.test.tsx
 *
 * Covers:
 * - When 3+ items are selected, BulkActionsToolbar shows "3 selected".
 * - Delete button (N < 5) calls bulkDelete.mutate directly (no confirmation).
 * - "Move to…" button fires onMoveToClick callback.
 * - "Mark complete" button calls bulkComplete.mutate.
 * - Cancel button clears the selection.
 * - Toolbar not rendered when fewer than 2 items selected.
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

function setupMocks({
  deleteMutate = vi.fn(),
  completeMutate = vi.fn(),
}: {
  deleteMutate?: ReturnType<typeof vi.fn>;
  completeMutate?: ReturnType<typeof vi.fn>;
} = {}) {
  vi.mocked(useBulkDelete).mockReturnValue({
    mutate: deleteMutate,
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useBulkDelete>);

  vi.mocked(useBulkComplete).mockReturnValue({
    mutate: completeMutate,
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useBulkComplete>);
}

describe('BulkActionsToolbar', () => {
  beforeEach(() => {
    // Clear selection before each test
    useMultiSelectStore.getState().clear();
    vi.clearAllMocks();
    setupMocks();
  });

  afterEach(() => {
    act(() => {});
    useMultiSelectStore.getState().clear();
  });

  it('does not render when fewer than 2 items selected', () => {
    useMultiSelectStore.getState().add('item-1' as ItemId, 'list');
    render(<BulkActionsToolbar />);
    // Toolbar should not be rendered (count < 2)
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('renders toolbar with "3 selected" when 3 items are selected', () => {
    act(() => {
      useMultiSelectStore.getState().add('item-1' as ItemId, 'list');
      useMultiSelectStore.getState().add('item-2' as ItemId, 'list');
      useMultiSelectStore.getState().add('item-3' as ItemId, 'list');
    });

    render(<BulkActionsToolbar />);

    expect(screen.getByText('3 selected')).toBeTruthy();
  });

  it('Delete button (N < 5) calls bulkDelete.mutate directly without confirmation', () => {
    const deleteMutate = vi.fn();
    setupMocks({ deleteMutate });

    act(() => {
      useMultiSelectStore.getState().add('item-1' as ItemId, 'list');
      useMultiSelectStore.getState().add('item-2' as ItemId, 'list');
      useMultiSelectStore.getState().add('item-3' as ItemId, 'list');
    });

    render(<BulkActionsToolbar />);

    const deleteBtn = screen.getByRole('button', { name: /^delete$/i });
    fireEvent.click(deleteBtn);

    // Should fire immediately (no confirmation for N < 5)
    expect(deleteMutate).toHaveBeenCalledTimes(1);
    expect(deleteMutate).toHaveBeenCalledWith({
      item_ids: expect.arrayContaining(['item-1', 'item-2', 'item-3']),
    });

    // No confirmation dialog should appear
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('"Move to…" button calls onMoveToClick with selected ids', () => {
    const onMoveToClick = vi.fn();

    act(() => {
      useMultiSelectStore.getState().add('item-a' as ItemId, 'list');
      useMultiSelectStore.getState().add('item-b' as ItemId, 'list');
    });

    render(<BulkActionsToolbar onMoveToClick={onMoveToClick} />);

    const moveBtn = screen.getByRole('button', { name: /move to/i });
    fireEvent.click(moveBtn);

    expect(onMoveToClick).toHaveBeenCalledTimes(1);
    const callArg = onMoveToClick.mock.calls[0]?.[0] as string[];
    expect(callArg).toContain('item-a');
    expect(callArg).toContain('item-b');
  });

  it('"Mark complete" button calls bulkComplete.mutate with selected ids', () => {
    const completeMutate = vi.fn();
    setupMocks({ completeMutate });

    act(() => {
      useMultiSelectStore.getState().add('item-x' as ItemId, 'list');
      useMultiSelectStore.getState().add('item-y' as ItemId, 'list');
    });

    render(<BulkActionsToolbar />);

    const completeBtn = screen.getByRole('button', { name: /mark complete/i });
    fireEvent.click(completeBtn);

    expect(completeMutate).toHaveBeenCalledTimes(1);
    expect(completeMutate).toHaveBeenCalledWith({
      item_ids: expect.arrayContaining(['item-x', 'item-y']),
    });
  });

  it('"Cancel" button clears the selection', () => {
    act(() => {
      useMultiSelectStore.getState().add('item-1' as ItemId, 'list');
      useMultiSelectStore.getState().add('item-2' as ItemId, 'list');
    });

    expect(useMultiSelectStore.getState().set.size).toBe(2);

    render(<BulkActionsToolbar />);

    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    act(() => {
      fireEvent.click(cancelBtn);
    });

    expect(useMultiSelectStore.getState().set.size).toBe(0);
  });

  it('toolbar shows "Move to…" button only when onMoveToClick is provided', () => {
    act(() => {
      useMultiSelectStore.getState().add('item-1' as ItemId, 'list');
      useMultiSelectStore.getState().add('item-2' as ItemId, 'list');
    });

    render(<BulkActionsToolbar />); // No onMoveToClick prop

    expect(screen.queryByRole('button', { name: /move to/i })).toBeNull();
  });
});
