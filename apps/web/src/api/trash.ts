import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ItemSchema } from '@tasko/types';
import type { Item, ItemId } from '@tasko/types';
import { z } from 'zod';
import { useSnackbarStore } from '../store/snackbar';
import { useUndoStore } from '../store/undo';
import { apiCall } from './client';
import { itemKeys, trashKeys } from './keys';

const TrashListResponseSchema = z.object({
  items: z.array(ItemSchema),
  count: z.number(),
});

const TrashedResponseSchema = z.object({
  trashed: z.array(ItemSchema),
});

const RestoredResponseSchema = z.object({
  restored: z.array(ItemSchema),
});

const EmptyTrashResponseSchema = z.object({
  deleted_count: z.number(),
});

export function useTrashList(sort?: 'trashed_desc' | 'title_asc') {
  const params = new URLSearchParams();
  if (sort) params.set('sort', sort);
  const url = `/api/trash${params.toString() ? `?${params.toString()}` : ''}`;
  return useQuery({
    queryKey: [...trashKeys.list(), sort ?? 'trashed_desc'],
    queryFn: () => apiCall('GET', url, undefined, TrashListResponseSchema),
  });
}

/**
 * useTrashItem — soft-delete a single item (DELETE /api/items/:id).
 * Optimistic: invalidates item queries. Undo: restores the item.
 */
export function useTrashItem() {
  const queryClient = useQueryClient();
  const snackbar = useSnackbarStore();
  const undo = useUndoStore();

  return useMutation<{ trashed: Item[] }, Error, { id: ItemId; title?: string; childCount?: number }>({
    mutationFn: ({ id }) =>
      apiCall('DELETE', `/api/items/${id}`, undefined, TrashedResponseSchema) as Promise<{
        trashed: Item[];
      }>,

    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: itemKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
    },

    onSuccess: (response, { id, title, childCount }) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all });
      queryClient.invalidateQueries({ queryKey: trashKeys.all });

      const hasChildren = (childCount ?? 0) > 0;
      const text = hasChildren
        ? `${title ?? 'Item'} and ${childCount} items moved to Trash.`
        : 'Task moved to Trash.';

      undo.push({
        label: 'Task moved to Trash',
        apply: async () => {
          await apiCall('POST', `/api/items/${id}/restore`, undefined, RestoredResponseSchema);
          queryClient.invalidateQueries({ queryKey: itemKeys.all });
          queryClient.invalidateQueries({ queryKey: trashKeys.all });
        },
      });

      snackbar.show({
        variant: 'info',
        text,
        durationMs: 5000,
        action: { label: 'Undo', onClick: () => undo.pop() },
      });
    },

    onError: () => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all });
      snackbar.show({ variant: 'error', text: "Couldn't delete. Try again.", durationMs: 5000 });
    },
  });
}

/**
 * useRestoreItem — restore a single item from trash (POST /api/items/:id/restore).
 * No undo (user is in Trash view intentionally).
 */
export function useRestoreItem() {
  const queryClient = useQueryClient();
  const snackbar = useSnackbarStore();

  return useMutation<{ restored: Item[] }, Error, ItemId>({
    mutationFn: (id) =>
      apiCall('POST', `/api/items/${id}/restore`, undefined, RestoredResponseSchema) as Promise<{
        restored: Item[];
      }>,

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all });
      queryClient.invalidateQueries({ queryKey: trashKeys.all });
      snackbar.show({ variant: 'restored', text: 'Task restored.', durationMs: 5000 });
    },

    onError: () => {
      snackbar.show({ variant: 'error', text: "Couldn't restore. Try again.", durationMs: 5000 });
    },
  });
}

/**
 * usePermanentDeleteItem — hard-delete from trash (DELETE /api/items/:id?permanent=true).
 * Item must already be in trash. No undo (irreversible).
 */
export function usePermanentDeleteItem() {
  const queryClient = useQueryClient();
  const snackbar = useSnackbarStore();

  return useMutation<void, Error, ItemId>({
    mutationFn: async (id) => {
      const res = await fetch(`/api/items/${id}?permanent=true`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const json: unknown = await res.json().catch(() => ({}));
        throw new Error(String(json));
      }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trashKeys.all });
      snackbar.show({ variant: 'info', text: 'Task permanently deleted.', durationMs: 5000 });
    },

    onError: () => {
      snackbar.show({ variant: 'error', text: "Couldn't delete permanently. Try again.", durationMs: 5000 });
    },
  });
}

/**
 * useEmptyTrash — permanently delete all items in trash.
 * No undo (irreversible).
 */
export function useEmptyTrash() {
  const queryClient = useQueryClient();
  const snackbar = useSnackbarStore();

  return useMutation<{ deleted_count: number }, Error, void>({
    mutationFn: () =>
      apiCall('POST', '/api/trash/empty', undefined, EmptyTrashResponseSchema) as Promise<{
        deleted_count: number;
      }>,

    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: trashKeys.all });
      snackbar.show({
        variant: 'info',
        text: `Trash emptied. ${data.deleted_count} items deleted.`,
        durationMs: 5000,
      });
    },

    onError: () => {
      snackbar.show({ variant: 'error', text: "Couldn't empty Trash. Try again.", durationMs: 5000 });
    },
  });
}
