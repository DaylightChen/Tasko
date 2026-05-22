import { z } from 'zod';
import { FolderIdSchema, ProjectIdSchema } from '../domain/ids.js';
import { IsoUtcSchema } from '../domain/status.js';

export const ProjectSchema = z.object({
  id: ProjectIdSchema,
  schema_version: z.literal(1),
  name: z.string().min(1).max(80),
  folder_id: FolderIdSchema.nullable(),
  is_hierarchical: z.boolean().default(false),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .nullable()
    .default(null),
  icon: z.string().max(40).nullable().default(null),
  sort_order: z.number().int(),
  is_inbox: z.boolean().default(false),
  created_at: IsoUtcSchema,
  updated_at: IsoUtcSchema,
});
export type Project = z.infer<typeof ProjectSchema>;

export const ProjectCreateSchema = ProjectSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  schema_version: true,
  is_inbox: true,
}).extend({ sort_order: z.number().int().optional() });
export type ProjectCreate = z.infer<typeof ProjectCreateSchema>;

export const ProjectPatchSchema = ProjectSchema.omit({
  id: true,
  created_at: true,
  schema_version: true,
  is_inbox: true,
}).partial();
export type ProjectPatch = z.infer<typeof ProjectPatchSchema>;
