import { z } from 'zod';
import { IsoUtcSchema } from '../domain/status.js';

export const ThemeSchema = z.enum(['light', 'dark', 'system']);
export type Theme = z.infer<typeof ThemeSchema>;

export const WeekStartSchema = z.enum(['sun', 'mon']);
export type WeekStart = z.infer<typeof WeekStartSchema>;

export const ConfigSchema = z.object({
  schema_version: z.literal(1),
  theme: ThemeSchema.default('system'),
  week_start: WeekStartSchema.default('mon'),
  last_modified: IsoUtcSchema,
});
export type Config = z.infer<typeof ConfigSchema>;

export const ConfigPatchSchema = ConfigSchema.omit({ schema_version: true, last_modified: true }).partial();
export type ConfigPatch = z.infer<typeof ConfigPatchSchema>;
