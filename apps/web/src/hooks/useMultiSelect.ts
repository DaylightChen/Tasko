import { useRouterState } from '@tanstack/react-router';
import type { ItemId } from '@tasko/types';
import { useCallback, useEffect, useRef } from 'react';
import type { MultiSelectScope } from '../store/multi-select';
import { useMultiSelectStore } from '../store/multi-select';

/**
 * Attaches multi-select behaviour to a list of visible items.
 *
 * Returned `handleListClick` should be set as the `onClick` on the
 * wrapping `<ul>` element. It uses event-delegation to find the
 * nearest `[data-item-id]` ancestor of the click target.
 *
 * Keyboard shortcuts:
 *   - ⌘A / Ctrl+A  → select all visible rows
 *   - Esc           → clear selection (registered globally by GlobalUndo; also
 *                     handled here so the list container intercepts it first)
 */
export function useMultiSelect(visibleIds: ItemId[], scope: MultiSelectScope) {
  const multiSelect = useMultiSelectStore();

  // Clear selection on route change (interaction-patterns.md §3.5)
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;
  const prevPath = useRef(pathname);
  useEffect(() => {
    if (prevPath.current !== pathname) {
      useMultiSelectStore.getState().clear();
      prevPath.current = pathname;
    }
  }, [pathname]);

  // ⌘A to select all
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (active instanceof HTMLInputElement) return;
      if (active instanceof HTMLTextAreaElement) return;
      if (active instanceof HTMLElement && active.isContentEditable) return;

      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === 'a') {
        // Only activate if current scope matches or no scope is active yet
        if (multiSelect.scope === null || multiSelect.scope === scope) {
          e.preventDefault();
          for (const id of visibleIds) {
            multiSelect.add(id, scope);
          }
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [visibleIds, scope, multiSelect]);

  /**
   * Place this as `onClick` on the `<ul>` container.
   * Uses event delegation via `[data-item-id]` attribute.
   */
  const handleListClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const target = e.target as HTMLElement;
      const row = target.closest('[data-item-id]');
      if (!row) return;

      const itemId = row.getAttribute('data-item-id') as ItemId | null;
      if (!itemId) return;

      const isShift = e.shiftKey;
      const isMod = e.metaKey || e.ctrlKey;

      if (isShift) {
        // Range-select from anchor to this id
        e.preventDefault();
        multiSelect.selectRange(itemId, visibleIds);
      } else if (isMod) {
        // Toggle this id
        e.preventDefault();
        multiSelect.toggle(itemId);
        multiSelect.setAnchor(itemId);
      } else if (multiSelect.set.size > 0) {
        // When already in multi-select mode, plain click → single-select this row
        e.preventDefault();
        multiSelect.clear();
        multiSelect.add(itemId, scope);
      }
      // Plain click with no selection active: handled by the row's own onClick (modal open)
    },
    [visibleIds, scope, multiSelect],
  );

  return { handleListClick, multiSelect };
}
