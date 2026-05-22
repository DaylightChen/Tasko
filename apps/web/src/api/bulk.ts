import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ItemSchema } from '@tasko/types';
import type { Item, ItemId, ProjectId } from '@tasko/types';
import { z } from 'zod';
import { useSnackbarStore } from '../store/snackbar';
import { useUndoStore } from '../store/undo';
import { apiCall } from './client';
import { itemKeys, trashKeys } from './keys';

const BulkMoveOverdueResponseSchema = z.object({
  moved_ids: z.array(z.string()),
  moved_count: z.number(),
  new_due_date: z.string(),
});

const BulkMoveToProjectResponseSchema = z.object({
  moved_count: z.number(),
  items: z.array(ItemSchema),
});

const BulkDeleteResponseSchema = z.object({
  trashed_count: z.number(),
  items: z.array(ItemSchema),
});

const BulkCompleteResponseSchema = z.object({
  completed_count: z.number(),
  new_instances: z.array(ItemSchema),
  items: z.array(ItemSchema),
});

/**
 * useBulkMoveOverdue — move all overdue items to today.
 * POST /api/bulk/move-overdue-to-today
 * Undo: PATCH each item back to its prior due/start dates.
 */
export function useBulkMoveOverdue() {
  const queryClient = useQueryClient();
  const snackbar = useSnackbarStore();
  const undo = useUndoStore();

  // Capture prior state before mutating so undo can restore it
  type PriorEntry = { id: ItemId; due_date: string; start_date: string | null };
  let priorDates: PriorEntry[] = [];

  return useMutation<z.infer<typeof BulkMoveOverdueResponseSchema>, Error, void>({
    mutationFn: () =>
      apiCall('POST', '/api/bulk/move-overdue-to-today', undefined, BulkMoveOverdueResponseSchema) as Promise<
        z.infer<typeof BulkMoveOverdueResponseSchema>
      >,

    onMutate: () => {
      // Collect current overdue items from the today list cache for undo
      const todayData = queryClient.getQueryData<{ items: Item[]; count: number }>(itemKeys.today());
      const today = new Date().toISOString().slice(0, 10);
      priorDates = (todayData?.items ?? [])
        .filter((i) => i.due_date < today && i.trashed_at === null && i.status !== 'done')
        .map((i) => ({ id: i.id as ItemId, due_date: i.due_date, start_date: i.start_date }));
    },

    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all });

      const captured = [...priorDates];
      undo.push({
        label: 'Bulk overdue moved to today',
        apply: async () => {
          await Promise.all(
            captured.map(({ id, due_date, start_date }) =>
              apiCall('PATCH', `/api/items/${id}`, { due_date, start_date }, ItemSchema),
            ),
          );
          queryClient.invalidateQueries({ queryKey: itemKeys.all });
        },
      });

      snackbar.show({
        variant: 'success',
        text: `${data.moved_count} items moved to today.`,
        durationMs: 5000,
        action: { label: 'Undo', onClick: () => undo.pop() },
      });
    },

    onError: () => {
      snackbar.show({ variant: 'error', text: "Couldn't move items. Try again.", durationMs: 5000 });
    },
  });
}

/**
 * useBulkMoveToProject — move selected items to a project.
 * POST /api/bulk/move-to-project
 * Undo: PATCH each item back to its prior project.
 */
type BulkMoveToProjectPrior = { id: ItemId; project_id: ProjectId | null; parent_id: ItemId | null };

export function useBulkMoveToProject() {
  const queryClient = useQueryClient();
  const snackbar = useSnackbarStore();
  const undo = useUndoStore();

  return useMutation<
    z.infer<typeof BulkMoveToProjectResponseSchema>,
    Error,
    { item_ids: ItemId[]; new_project_id: ProjectId; new_parent_id?: ItemId | null; projectName?: string },
    { priorItems: BulkMoveToProjectPrior[] }
  >({
    mutationFn: ({ item_ids, new_project_id, new_parent_id }) =>
      apiCall(
        'POST',
        '/api/bulk/move-to-project',
        { item_ids, new_project_id, new_parent_id: new_parent_id ?? null },
        BulkMoveToProjectResponseSchema,
      ) as Promise<z.infer<typeof BulkMoveToProjectResponseSchema>>,

    onMutate: ({ item_ids }) => {
      // Collect prior project_id + parent_id for each item so undo can restore them.
      const priorItems: BulkMoveToProjectPrior[] = item_ids.map((id) => {
        const item = queryClient.getQueryData<Item>(itemKeys.detail(id));
        return {
          id,
          project_id: (item?.project_id as ProjectId) ?? null,
          parent_id: (item?.parent_id as ItemId) ?? null,
        };
      });
      return { priorItems };
    },

    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all });

      const priorItems = context?.priorItems ?? [];

      undo.push({
        label: 'Bulk moved to project',
        apply: async () => {
          for (const prior of priorItems) {
            await apiCall(
              'PATCH',
              `/api/items/${prior.id}`,
              { project_id: prior.project_id, parent_id: prior.parent_id },
              ItemSchema,
            );
          }
          queryClient.invalidateQueries({ queryKey: itemKeys.all });
        },
      });

      snackbar.show({
        variant: 'info',
        text: `${data.moved_count} tasks moved${variables.projectName ? ` to ${variables.projectName}` : ''}.`,
        durationMs: 5000,
        action: { label: 'Undo', onClick: () => undo.pop() },
      });
    },

    onError: () => {
      snackbar.show({ variant: 'error', text: "Couldn't move items. Try again.", durationMs: 5000 });
    },
  });
}

/**
 * useBulkDelete — soft-delete selected items.
 * POST /api/bulk/delete
 * Undo: restore each item individually.
 */
export function useBulkDelete() {
  const queryClient = useQueryClient();
  const snackbar = useSnackbarStore();
  const undo = useUndoStore();

  return useMutation<z.infer<typeof BulkDeleteResponseSchema>, Error, { item_ids: ItemId[] }>({
    mutationFn: ({ item_ids }) =>
      apiCall('POST', '/api/bulk/delete', { item_ids }, BulkDeleteResponseSchema) as Promise<
        z.infer<typeof BulkDeleteResponseSchema>
      >,

    onSuccess: (data, { item_ids }) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all });
      queryClient.invalidateQueries({ queryKey: trashKeys.all });

      // Undo: restore each top-level item (cascade descendants restore with their parent)
      const topLevelIds = item_ids.slice();
      undo.push({
        label: 'Bulk items moved to Trash',
        apply: async () => {
          await Promise.all(
            topLevelIds.map((id) =>
              apiCall(
                'POST',
                `/api/items/${id}/restore`,
                undefined,
                z.object({ restored: z.array(ItemSchema) }),
              ),
            ),
          );
          queryClient.invalidateQueries({ queryKey: itemKeys.all });
          queryClient.invalidateQueries({ queryKey: trashKeys.all });
        },
      });

      snackbar.show({
        variant: 'info',
        text: `${data.trashed_count} items moved to Trash.`,
        durationMs: 5000,
        action: { label: 'Undo', onClick: () => undo.pop() },
      });
    },

    onError: () => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all });
      snackbar.show({ variant: 'error', text: "Couldn't delete items. Try again.", durationMs: 5000 });
    },
  });
}

/**
 * useBulkComplete — mark multiple items as done.
 * POST /api/bulk/complete
 * Undo: PATCH each item back to prior status + delete any generated recurrence instances.
 */
export function useBulkComplete() {
  const queryClient = useQueryClient();
  const snackbar = useSnackbarStore();
  const undo = useUndoStore();

  return useMutation<z.infer<typeof BulkCompleteResponseSchema>, Error, { item_ids: ItemId[] }>({
    mutationFn: ({ item_ids }) =>
      apiCall('POST', '/api/bulk/complete', { item_ids }, BulkCompleteResponseSchema) as Promise<
        z.infer<typeof BulkCompleteResponseSchema>
      >,

    onSuccess: (data, { item_ids }) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all });

      // Undo: reopen each completed item; delete any generated next instances
      const completedIds = item_ids.slice();
      const newInstanceIds = data.new_instances.map((i) => i.id as ItemId);
      undo.push({
        label: 'Bulk completed',
        apply: async () => {
          // Reopen all completed items
          await Promise.all(
            completedIds.map((id) =>
              apiCall('PATCH', `/api/items/${id}`, { status: 'todo', completed_at: null }, ItemSchema),
            ),
          );
          // Delete generated recurrence instances (soft-delete is fine)
          for (const instanceId of newInstanceIds) {
            try {
              await fetch(`/api/items/${instanceId}`, { method: 'DELETE' });
            } catch {
              // best-effort
            }
          }
          queryClient.invalidateQueries({ queryKey: itemKeys.all });
        },
      });

      snackbar.show({
        variant: 'success',
        text: `${data.completed_count} tasks completed.`,
        durationMs: 5000,
        action: { label: 'Undo', onClick: () => undo.pop() },
      });
    },

    onError: () => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all });
      snackbar.show({ variant: 'error', text: "Couldn't complete items. Try again.", durationMs: 5000 });
    },
  });
}
