import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ProjectCreateSchema, ProjectPatchSchema, ProjectSchema } from '@tasko/types';
import type { ProjectCreate, ProjectId, ProjectPatch } from '@tasko/types';
import { z } from 'zod';
import { useSnackbarStore } from '../store/snackbar';
import { apiCall } from './client';
import { projectKeys } from './keys';

const ProjectListSchema = z.object({
  projects: z.array(ProjectSchema),
});

export function useProjects() {
  return useQuery({
    queryKey: projectKeys.all,
    queryFn: () => apiCall('GET', '/api/projects', undefined, ProjectListSchema),
  });
}

/**
 * useProject — fetch a single project by id. Derives the result from the
 * projects list cache to avoid a separate endpoint (GET /api/projects/:id
 * is not implemented in v1; task-04 routes use the list).
 */
export function useProject(id: string | undefined) {
  const query = useProjects();
  const project = query.data?.projects.find((p) => p.id === id) ?? null;
  return { ...query, project };
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const snackbar = useSnackbarStore();

  return useMutation({
    mutationFn: (body: ProjectCreate) =>
      apiCall('POST', '/api/projects', ProjectCreateSchema.parse(body), ProjectSchema),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
      snackbar.show({
        variant: 'success',
        text: `Project "${project.name}" created.`,
        durationMs: 3000,
      });
    },
    onError: () => {
      snackbar.show({ variant: 'error', text: "Couldn't create project. Try again.", durationMs: 5000 });
    },
  });
}

export function usePatchProject() {
  const queryClient = useQueryClient();
  const snackbar = useSnackbarStore();

  return useMutation({
    mutationFn: ({ id, patch }: { id: ProjectId; patch: ProjectPatch }) =>
      apiCall('PATCH', `/api/projects/${id}`, ProjectPatchSchema.parse(patch), ProjectSchema),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
    onError: () => {
      snackbar.show({ variant: 'error', text: "Couldn't update project. Try again.", durationMs: 5000 });
    },
  });
}

export function useDeleteProject() {
  const snackbar = useSnackbarStore();

  return useMutation({
    mutationFn: (_id: ProjectId) => {
      snackbar.show({
        variant: 'info',
        text: 'Project deletion not yet implemented.',
        durationMs: 5000,
      });
      return Promise.reject(new Error('Not yet implemented'));
    },
    onError: () => {
      /* stub — task-12 implements real cascade delete */
    },
  });
}
