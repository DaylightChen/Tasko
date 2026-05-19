import { z } from 'zod';
import { FolderIdSchema } from '../domain/ids.js';
import { IsoUtcSchema } from '../domain/status.js';

export const FolderSchema = z.object({
  id: FolderIdSchema,
  schema_version: z.literal(1),
  name: z.string().min(1).max(60),
  sort_order: z.number().int(),
  created_at: IsoUtcSchema,
  updated_at: IsoUtcSchema,
});
export type Folder = z.infer<typeof FolderSchema>;

export const FolderCreateSchema = FolderSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  schema_version: true,
}).extend({ sort_order: z.number().int().optional() });
export type FolderCreate = z.infer<typeof FolderCreateSchema>;

export const FolderPatchSchema = FolderSchema.omit({
  id: true,
  created_at: true,
  schema_version: true,
}).partial();
export type FolderPatch = z.infer<typeof FolderPatchSchema>;
