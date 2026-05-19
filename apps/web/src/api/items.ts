import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ItemCreateSchema, ItemPatchSchema, ItemSchema } from '@tasko/types';
import type { ItemCreate, ItemId, ItemPatch } from '@tasko/types';
import { z } from 'zod';
import { useSnackbarStore } from '../store/snackbar';
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
