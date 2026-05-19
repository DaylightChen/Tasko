import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiCall } from './client';
import { healthKeys } from './keys';

export const HealthSchema = z.object({
  ok: z.boolean(),
  version: z.string(),
  data_dir: z.string(),
  item_count: z.number(),
  uptime_s: z.number(),
});

export function useHealth() {
  return useQuery({
    queryKey: healthKeys.all,
    queryFn: () => apiCall('GET', '/api/health', undefined, HealthSchema),
    staleTime: 60_000,
  });
}
