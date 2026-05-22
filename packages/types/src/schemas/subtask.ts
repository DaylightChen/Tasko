import { z } from 'zod';
import { SubtaskIdSchema } from '../domain/ids.js';
import { IsoUtcSchema } from '../domain/status.js';

// No 'in_progress' for subtasks — locked by product spec §9.4 #6.
export const SubtaskStatusSchema = z.enum(['todo', 'done']);
export type SubtaskStatus = z.infer<typeof SubtaskStatusSchema>;

export const SubtaskSchema = z.object({
  id: SubtaskIdSchema,
  title: z.string().min(1).max(200),
  status: SubtaskStatusSchema.default('todo'),
  completed_at: IsoUtcSchema.nullable().default(null),
  sort_order: z.number().int(),
  created_at: IsoUtcSchema,
  updated_at: IsoUtcSchema,
});
export type Subtask = z.infer<typeof SubtaskSchema>;

export const SubtaskCreateSchema = SubtaskSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  completed_at: true,
}).extend({ sort_order: z.number().int().optional() });
export type SubtaskCreate = z.infer<typeof SubtaskCreateSchema>;

export const SubtaskPatchSchema = SubtaskSchema.omit({ id: true, created_at: true }).partial();
export type SubtaskPatch = z.infer<typeof SubtaskPatchSchema>;
