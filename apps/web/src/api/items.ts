import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ItemCreateSchema, ItemPatchSchema, ItemSchema } from '@tasko/types';
import type { Item, ItemCreate, ItemId, ItemPatch, LocalDate, Priority, Status } from '@tasko/types';
import { z } from 'zod';
import { useOptimisticMutation } from '../hooks/useOptimisticMutation';
import { todayLocal } from '../lib/date-fmt';
import { useSnackbarStore } from '../store/snackbar';
import { useUndoStore } from '../store/undo';
import { apiCall } from './client';
import { itemKeys } from './keys';

export interface ItemListFilters {
  view: 'today' | 'tomorrow' | 'next7' | 'inbox' | 'all' | 'completed' | 'project' | 'tag';
  project_id?: string;
  tag_id?: string;
  parent_id?: string | 'root';
  status?: ('todo' | 'in_progress' | 'done')[];
  priority?: ('none' | 'low' | 'medium' | 'high')[];
  sort?: 'due_asc' | 'priority_desc' | 'title_asc' | 'created_desc' | 'completed_desc';
  include_completed?: boolean;
}

const ItemListResponseSchema = z.object({
  items: z.array(ItemSchema),
  count: z.number(),
});

function buildItemsUrl(filters: ItemListFilters): string {
  const params = new URLSearchParams();
  params.set('view', filters.view);
  if (filters.project_id) params.set('project_id', filters.project_id);
  if (filters.tag_id) params.set('tag_id', filters.tag_id);
  if (filters.parent_id) params.set('parent_id', filters.parent_id);
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.include_completed !== undefined) {
    params.set('include_completed', String(filters.include_completed));
  }
  if (filters.status) {
    for (const s of filters.status) params.append('status', s);
  }
  if (filters.priority) {
    for (const p of filters.priority) params.append('priority', p);
  }
  return `/api/items?${params.toString()}`;
}

export function useItems(filters: ItemListFilters) {
  return useQuery({
    queryKey: itemKeys.list(filters),
    queryFn: () => apiCall('GET', buildItemsUrl(filters), undefined, ItemListResponseSchema),
  });
}

export function useItem(id: ItemId | undefined) {
  // When id is undefined, use a placeholder key that never fires (enabled: false)
  const safeId = id ?? ('' as ItemId);
  return useQuery({
    queryKey: itemKeys.detail(safeId),
    queryFn: () => apiCall('GET', `/api/items/${safeId}`, undefined, ItemSchema),
    enabled: Boolean(id),
  });
}

export function useCreateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: ItemCreate) => apiCall('POST', '/api/items', ItemCreateSchema.parse(body), ItemSchema),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all });
    },
  });
}

export function usePatchItem() {
  const queryClient = useQueryClient();
  const snackbar = useSnackbarStore();

  return useMutation({
    mutationFn: ({ id, patch }: { id: ItemId; patch: ItemPatch }) =>
      apiCall('PATCH', `/api/items/${id}`, ItemPatchSchema.parse(patch), ItemSchema),
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all });
      queryClient.setQueryData(itemKeys.detail(item.id as ItemId), item);
    },
    onError: () => {
      snackbar.show({ variant: 'error', text: "Couldn't save. Try again.", durationMs: 5000 });
    },
  });
}

export function useToggleComplete() {
  const queryClient = useQueryClient();
  const snackbar = useSnackbarStore();
  const undo = useUndoStore();

  return useMutation<Item, Error, { id: ItemId; nextStatus: Status }, { prior: Item | undefined }>({
    mutationFn: ({ id, nextStatus }) =>
      apiCall(
        'PATCH',
        `/api/items/${id}`,
        ItemPatchSchema.parse({
          status: nextStatus,
          completed_at: nextStatus === 'done' ? new Date().toISOString() : null,
        }),
        ItemSchema,
      ) as Promise<Item>,

    onMutate: async ({ id, nextStatus }) => {
      await queryClient.cancelQueries({ queryKey: itemKeys.detail(id) });
      const prior = queryClient.getQueryData<Item>(itemKeys.detail(id));

      queryClient.setQueryData<Item>(itemKeys.detail(id), (old) =>
        old
          ? {
              ...old,
              status: nextStatus,
              completed_at: nextStatus === 'done' ? new Date().toISOString() : null,
            }
          : undefined,
      );
      queryClient.invalidateQueries({ queryKey: itemKeys.lists() });

      undo.push({
        label: nextStatus === 'done' ? 'Task completed' : 'Task reopened',
        apply: async () => {
          await apiCall(
            'PATCH',
            `/api/items/${id}`,
            ItemPatchSchema.parse({ status: prior?.status ?? 'todo', completed_at: null }),
            ItemSchema,
          );
          queryClient.invalidateQueries({ queryKey: itemKeys.all });
        },
      });

      return { prior };
    },

    onError: (_err, { id }, ctx) => {
      if (ctx?.prior) {
        queryClient.setQueryData(itemKeys.detail(id), ctx.prior);
      }
      queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
      snackbar.show({ variant: 'error', text: "Couldn't save. Try again.", durationMs: 5000 });
    },

    onSuccess: (item, { id, nextStatus }) => {
      queryClient.setQueryData(itemKeys.detail(id), item);
      queryClient.invalidateQueries({ queryKey: itemKeys.lists() });

      if (nextStatus === 'done') {
        snackbar.show({
          variant: 'success',
          text: 'Task completed.',
          durationMs: 5000,
          action: { label: 'Undo', onClick: () => undo.pop() },
        });
      }
    },
  });
}

export function useReschedule() {
  const queryClient = useQueryClient();
  const snackbar = useSnackbarStore();

  return useMutation<Item, Error, { id: ItemId; newDate: LocalDate }, { prior: Item | undefined }>({
    mutationFn: ({ id, newDate }) =>
      apiCall(
        'PATCH',
        `/api/items/${id}`,
        ItemPatchSchema.parse({ due_date: newDate }),
        ItemSchema,
      ) as Promise<Item>,

    onMutate: async ({ id, newDate }) => {
      await queryClient.cancelQueries({ queryKey: itemKeys.detail(id) });
      const prior = queryClient.getQueryData<Item>(itemKeys.detail(id));

      queryClient.setQueryData<Item>(itemKeys.detail(id), (old) =>
        old ? { ...old, due_date: newDate } : undefined,
      );
      queryClient.invalidateQueries({ queryKey: itemKeys.lists() });

      return { prior };
    },

    onError: (_err, { id }, ctx) => {
      if (ctx?.prior) {
        queryClient.setQueryData(itemKeys.detail(id), ctx.prior);
      }
      queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
      snackbar.show({ variant: 'error', text: "Couldn't save. Try again.", durationMs: 5000 });
    },

    onSuccess: (item, { id, newDate }) => {
      queryClient.setQueryData(itemKeys.detail(id), item);
      queryClient.invalidateQueries({ queryKey: itemKeys.lists() });

      const dateLabel = newDate === todayLocal() ? 'today' : newDate;
      snackbar.show({
        variant: 'success',
        text: `Task rescheduled to ${dateLabel}.`,
        durationMs: 5000,
      });
    },
  });
}

export function useChangePriority() {
  const queryClient = useQueryClient();

  return useOptimisticMutation<{ id: ItemId; priority: Priority }, Item, Item | undefined>({
    mutationFn: ({ id, priority }) =>
      apiCall('PATCH', `/api/items/${id}`, ItemPatchSchema.parse({ priority }), ItemSchema) as Promise<Item>,

    buildOptimistic: (qc, { id, priority }) => {
      const prior = qc.getQueryData<Item>(itemKeys.detail(id));
      qc.setQueryData<Item>(itemKeys.detail(id), (old) => (old ? { ...old, priority } : undefined));
      qc.invalidateQueries({ queryKey: itemKeys.lists() });
      return prior;
    },

    buildUndo: ({ id }, prior) => ({
      label: 'Priority changed',
      apply: async () => {
        if (prior) {
          await apiCall(
            'PATCH',
            `/api/items/${id}`,
            ItemPatchSchema.parse({ priority: prior.priority }),
            ItemSchema,
          );
          queryClient.invalidateQueries({ queryKey: itemKeys.all });
        }
      },
    }),

    buildSnackbar: () => null,

    onSuccess: (item, { id }) => {
      queryClient.setQueryData(itemKeys.detail(id), item);
      queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
    },

    invalidate: (qc, { id: _id }) => {
      qc.invalidateQueries({ queryKey: itemKeys.lists() });
    },

    onError: ({ id }, prior) => {
      if (prior) {
        queryClient.setQueryData(itemKeys.detail(id), prior);
      }
      queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
    },
  });
}

export function useEditTitleInline() {
  const queryClient = useQueryClient();
  const snackbar = useSnackbarStore();

  return useMutation<Item, Error, { id: ItemId; title: string }, { prior: Item | undefined }>({
    mutationFn: ({ id, title }) =>
      apiCall('PATCH', `/api/items/${id}`, ItemPatchSchema.parse({ title }), ItemSchema) as Promise<Item>,

    onMutate: async ({ id, title }) => {
      await queryClient.cancelQueries({ queryKey: itemKeys.detail(id) });
      const prior = queryClient.getQueryData<Item>(itemKeys.detail(id));

      queryClient.setQueryData<Item>(itemKeys.detail(id), (old) => (old ? { ...old, title } : undefined));
      queryClient.invalidateQueries({ queryKey: itemKeys.lists() });

      return { prior };
    },

    onError: (_err, { id }, ctx) => {
      if (ctx?.prior) {
        queryClient.setQueryData(itemKeys.detail(id), ctx.prior);
      }
      queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
      snackbar.show({ variant: 'error', text: "Couldn't save. Try again.", durationMs: 5000 });
    },

    onSuccess: (item, { id }) => {
      queryClient.setQueryData(itemKeys.detail(id), item);
      queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
    },
  });
}

/**
 * useMoveItem — re-parent or cross-project move via POST /api/items/:id/move.
 */
export function useMoveItem() {
  const queryClient = useQueryClient();
  const snackbar = useSnackbarStore();

  return useMutation<Item, Error, { id: ItemId; new_parent_id?: ItemId | null; new_project_id?: string }>({
    mutationFn: ({ id, new_parent_id, new_project_id }) =>
      apiCall(
        'POST',
        `/api/items/${id}/move`,
        { new_parent_id, new_project_id },
        ItemSchema,
      ) as Promise<Item>,

    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all });
      queryClient.setQueryData(itemKeys.detail(item.id as ItemId), item);
    },

    onError: (_err) => {
      snackbar.show({ variant: 'error', text: "Couldn't move item. Try again.", durationMs: 5000 });
    },
  });
}

/**
 * useDeleteItem — stub for task-08. Real soft-delete endpoint lands in task-12.
 * For now, shows a "Coming in task-12" snackbar.
 */
export function useDeleteItem() {
  const snackbar = useSnackbarStore();

  return useMutation<void, Error, { id: ItemId }>({
    mutationFn: async ({ id: _id }) => {
      // task-12 will wire DELETE /api/items/:id here
      void _id;
    },
    onSuccess: () => {
      snackbar.show({
        variant: 'info',
        text: 'Coming in task-12.',
        durationMs: 3000,
      });
    },
    onError: () => {
      snackbar.show({ variant: 'error', text: "Couldn't save. Try again.", durationMs: 5000 });
    },
  });
}

/**
 * useBulkMoveOverdue — stub for task-08. Real bulk endpoint lands in task-12.
 * POST /api/bulk/move-overdue-to-today
 */
export function useBulkMoveOverdue() {
  const snackbar = useSnackbarStore();

  return useMutation<void, Error, void>({
    mutationFn: async () => {
      // Bulk endpoint coming in task-12
    },
    onSuccess: () => {
      snackbar.show({
        variant: 'info',
        text: 'Bulk endpoint coming in task-12.',
        durationMs: 3000,
      });
    },
    onError: () => {
      snackbar.show({ variant: 'error', text: "Couldn't save. Try again.", durationMs: 5000 });
    },
  });
}
