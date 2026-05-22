import { useQueryClient } from '@tanstack/react-query';
/**
 * GlobalShortcuts — registers single-key no-input navigation shortcuts
 * that the HotkeyProvider does not wire directly.
 *
 * Mounted at app root alongside GlobalUndo and other singletons.
 *
 * Shortcuts registered here:
 *   t  — navigate to /today (or, when a row is focused, schedule it to today)
 *   i  — navigate to /inbox
 *   n  — focus the current view's quick-add input
 *   /  — same as n (alternative)
 */
import { useNavigate } from '@tanstack/react-router';
import type { Item, ItemId } from '@tasko/types';
import { usePatchItem } from '../api/items';
import { itemKeys } from '../api/keys';
import { useHotkey } from '../hooks/useHotkey';
import { todayLocal } from '../lib/date-fmt';
import { useFocusedRowStore } from '../store/focused-row';
import { useQuickAddRefStore } from '../store/quick-add-ref';

export function GlobalShortcuts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const patchItem = usePatchItem();

  // t — navigate to /today, OR reschedule focused row to today
  useHotkey('no-input', 't', () => {
    const { focusedId } = useFocusedRowStore.getState();
    if (focusedId) {
      const item = queryClient.getQueryData<Item>(itemKeys.detail(focusedId as ItemId));
      if (item) {
        patchItem.mutate({ id: focusedId as ItemId, patch: { due_date: todayLocal() } });
      }
    } else {
      void navigate({ to: '/today' });
    }
  });

  // i — navigate to /inbox
  useHotkey('no-input', 'i', () => {
    void navigate({ to: '/inbox' });
  });

  // n / / — focus the current view's quick-add input
  const focusQuickAdd = () => {
    const { ref } = useQuickAddRefStore.getState();
    ref?.focus();
  };

  useHotkey('no-input', 'n', focusQuickAdd);
  useHotkey('no-input', '/', focusQuickAdd);

  return null;
}
