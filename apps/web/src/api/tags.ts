import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TagCreateSchema, TagSchema } from '@tasko/types';
import type { TagCreate } from '@tasko/types';
import { z } from 'zod';
import { useSnackbarStore } from '../store/snackbar';
import { apiCall } from './client';
import { tagKeys } from './keys';

const TagListSchema = z.object({
  tags: z.array(TagSchema),
});

export function useTags(includeOrphans = false) {
  return useQuery({
    queryKey: [...tagKeys.all, { include_orphans: includeOrphans }],
    queryFn: () => {
      const params = includeOrphans ? '?include_orphans=true' : '';
      return apiCall('GET', `/api/tags${params}`, undefined, TagListSchema);
    },
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  const snackbar = useSnackbarStore();

  return useMutation({
    mutationFn: (body: TagCreate) => apiCall('POST', '/api/tags', TagCreateSchema.parse(body), TagSchema),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.all });
    },
    onError: () => {
      snackbar.show({ variant: 'error', text: "Couldn't create tag. Try again.", durationMs: 5000 });
    },
  });
}
