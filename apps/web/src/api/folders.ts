import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderCreateSchema, FolderPatchSchema, FolderSchema } from '@tasko/types';
import type { FolderCreate, FolderId, FolderPatch } from '@tasko/types';
import { z } from 'zod';
import { useSnackbarStore } from '../store/snackbar';
import { apiCall } from './client';
import { folderKeys, projectKeys } from './keys';

const FolderListSchema = z.object({
  folders: z.array(FolderSchema),
});

export function useFolders() {
  return useQuery({
    queryKey: folderKeys.all,
    queryFn: () => apiCall('GET', '/api/folders', undefined, FolderListSchema),
  });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();
  const snackbar = useSnackbarStore();

  return useMutation({
    mutationFn: (body: FolderCreate) =>
      apiCall('POST', '/api/folders', FolderCreateSchema.parse(body), FolderSchema),
    onSuccess: (folder) => {
      queryClient.invalidateQueries({ queryKey: folderKeys.all });
      snackbar.show({
        variant: 'success',
        text: `Folder "${folder.name}" created.`,
        durationMs: 3000,
      });
    },
    onError: () => {
      snackbar.show({ variant: 'error', text: "Couldn't create folder. Try again.", durationMs: 5000 });
    },
  });
}

export function usePatchFolder() {
  const queryClient = useQueryClient();
  const snackbar = useSnackbarStore();

  return useMutation({
    mutationFn: ({ id, patch }: { id: FolderId; patch: FolderPatch }) =>
      apiCall('PATCH', `/api/folders/${id}`, FolderPatchSchema.parse(patch), FolderSchema),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: folderKeys.all });
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
    onError: () => {
      snackbar.show({ variant: 'error', text: "Couldn't update folder. Try again.", durationMs: 5000 });
    },
  });
}

export function useDeleteFolder() {
  const queryClient = useQueryClient();
  const snackbar = useSnackbarStore();

  return useMutation({
    mutationFn: (id: FolderId) => {
      const EmptySchema = z.object({});
      return apiCall('DELETE', `/api/folders/${id}`, undefined, EmptySchema);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: folderKeys.all });
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
      snackbar.show({ variant: 'success', text: 'Folder deleted.', durationMs: 3000 });
    },
    onError: () => {
      snackbar.show({ variant: 'error', text: "Couldn't delete folder. Try again.", durationMs: 5000 });
    },
  });
}
