import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ConfigPatchSchema, ConfigSchema } from '@tasko/types';
import type { ConfigPatch } from '@tasko/types';
import { useSnackbarStore } from '../store/snackbar';
import { apiCall } from './client';
import { configKeys } from './keys';

export function useConfig() {
  return useQuery({
    queryKey: configKeys.all,
    queryFn: () => apiCall('GET', '/api/config', undefined, ConfigSchema),
  });
}

export function useUpdateConfig() {
  const queryClient = useQueryClient();
  const snackbar = useSnackbarStore();

  return useMutation({
    mutationFn: (patch: ConfigPatch) =>
      apiCall('PATCH', '/api/config', ConfigPatchSchema.parse(patch), ConfigSchema),
    onSuccess: (updated) => {
      queryClient.setQueryData(configKeys.all, updated);
      snackbar.show({ variant: 'success', text: 'Saved.', durationMs: 3000 });
    },
    onError: () => {
      snackbar.show({ variant: 'error', text: "Couldn't save. Try again.", durationMs: 5000 });
    },
  });
}
