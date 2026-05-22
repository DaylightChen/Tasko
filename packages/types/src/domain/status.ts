import { z } from 'zod';

export const StatusSchema = z.enum(['todo', 'in_progress', 'done']);
export type Status = z.infer<typeof StatusSchema>;

export const PrioritySchema = z.enum(['none', 'low', 'medium', 'high']);
export type Priority = z.infer<typeof PrioritySchema>;

export const ItemTypeSchema = z.enum(['epic', 'feature', 'task']);
export type ItemType = z.infer<typeof ItemTypeSchema>;

// YYYY-MM-DD local date string. NOT an ISO timestamp.
export const LocalDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export type LocalDate = z.infer<typeof LocalDateSchema>;

// HH:MM in 24h. NOT timezone aware.
export const LocalTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export type LocalTime = z.infer<typeof LocalTimeSchema>;

// ISO 8601 UTC timestamp (with offset).
export const IsoUtcSchema = z.string().datetime();
export type IsoUtc = z.infer<typeof IsoUtcSchema>;
