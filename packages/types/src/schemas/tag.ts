import { z } from 'zod';
import { TagIdSchema } from '../domain/ids.js';
import { IsoUtcSchema } from '../domain/status.js';

export const TagSchema = z.object({
  id: TagIdSchema,
  schema_version: z.literal(1),
  name: z.string().min(1).max(32),
  name_lower: z.string().min(1).max(32),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .nullable()
    .default(null),
  created_at: IsoUtcSchema,
  updated_at: IsoUtcSchema,
});
export type Tag = z.infer<typeof TagSchema>;

// 33 chars to allow a leading '#' which the API layer strips before storage.
export const TagCreateSchema = z.object({
  name: z.string().min(1).max(33),
});
export type TagCreate = z.infer<typeof TagCreateSchema>;

export const TagPatchSchema = TagSchema.omit({
  id: true,
  created_at: true,
  schema_version: true,
  name_lower: true,
}).partial();
export type TagPatch = z.infer<typeof TagPatchSchema>;
