import { z } from 'zod';
import { ItemIdSchema, ProjectIdSchema, TagIdSchema } from '../domain/ids.js';
import {
  IsoUtcSchema,
  ItemTypeSchema,
  LocalDateSchema,
  LocalTimeSchema,
  PrioritySchema,
  StatusSchema,
} from '../domain/status.js';
import { RecurrenceRuleSchema } from './recurrence.js';
import { SubtaskCreateSchema, SubtaskSchema } from './subtask.js';

const ItemBaseSchema = z.object({
  id: ItemIdSchema,
  schema_version: z.literal(1),
  type: ItemTypeSchema,
  project_id: ProjectIdSchema,
  parent_id: ItemIdSchema.nullable(),

  title: z.string().min(1).max(500),
  notes: z.string().max(50_000).default(''),

  due_date: LocalDateSchema,
  start_date: LocalDateSchema.nullable(),
  due_time: LocalTimeSchema.nullable(),

  priority: PrioritySchema.default('none'),
  status: StatusSchema.default('todo'),

  tags: z.array(TagIdSchema).default([]),
  subtasks: z.array(SubtaskSchema).default([]),
  recurrence: RecurrenceRuleSchema.nullable(),

  completed_at: IsoUtcSchema.nullable(),
  trashed_at: IsoUtcSchema.nullable(),
  trashed_with: ItemIdSchema.nullable(),

  sort_order: z.number().int(),

  created_at: IsoUtcSchema,
  updated_at: IsoUtcSchema,
});

export const ItemSchema = ItemBaseSchema.refine((v) => v.start_date === null || v.start_date <= v.due_date, {
  path: ['start_date'],
  message: 'start_date must be on or before due_date',
});
export type Item = z.infer<typeof ItemSchema>;

export const ItemCreateSchema = ItemBaseSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  completed_at: true,
  trashed_at: true,
  trashed_with: true,
  schema_version: true,
})
  .extend({
    sort_order: z.number().int().optional(),
    subtasks: z.array(SubtaskCreateSchema).optional(),
  })
  .refine((v) => v.start_date === null || v.due_date === null || v.start_date <= v.due_date, {
    message: 'start_date must be on or before due_date',
    path: ['start_date'],
  });
export type ItemCreate = z.infer<typeof ItemCreateSchema>;

export const ItemPatchSchema = ItemBaseSchema.omit({
  id: true,
  created_at: true,
  schema_version: true,
  trashed_at: true,
  trashed_with: true,
})
  .partial()
  .extend({ updated_at: IsoUtcSchema.optional() })
  .refine((v) => v.start_date == null || v.due_date == null || v.start_date <= v.due_date, {
    message: 'start_date must be on or before due_date',
    path: ['start_date'],
  });
export type ItemPatch = z.infer<typeof ItemPatchSchema>;
