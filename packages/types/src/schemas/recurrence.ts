import { z } from 'zod';

export const WeekdaySchema = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
export type Weekday = z.infer<typeof WeekdaySchema>;

export const AnchorModeSchema = z.enum(['on_schedule', 'after_completion']);
export type AnchorMode = z.infer<typeof AnchorModeSchema>;

export const RecurrenceRuleSchema = z.discriminatedUnion('frequency', [
  z.object({ frequency: z.literal('daily'), anchor_mode: AnchorModeSchema }),
  z.object({
    frequency: z.literal('every_n_days'),
    interval: z.number().int().min(1).max(365),
    anchor_mode: AnchorModeSchema,
  }),
  z.object({
    frequency: z.literal('weekly'),
    weekdays: z.array(WeekdaySchema).min(1).max(7),
    anchor_mode: AnchorModeSchema,
  }),
  z.object({
    frequency: z.literal('monthly'),
    day_of_month: z.number().int().min(1).max(31),
    anchor_mode: AnchorModeSchema,
  }),
  z.object({
    frequency: z.literal('yearly'),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
    anchor_mode: AnchorModeSchema,
  }),
]);
export type RecurrenceRule = z.infer<typeof RecurrenceRuleSchema>;
