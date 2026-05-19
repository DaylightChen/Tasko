import { z } from 'zod';

export const ApiErrorCodeSchema = z.enum([
  'VALIDATION',
  'ITEM_NOT_FOUND',
  'PROJECT_NOT_FOUND',
  'FOLDER_NOT_FOUND',
  'TAG_NOT_FOUND',
  'PARENT_NOT_FOUND',
  'DEPTH_CAP',
  'INBOX_IMMUTABLE',
  'FS_WRITE',
  'DUPLICATE_TAG',
  'RECURRENCE_INVALID',
  'INTERNAL',
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: ApiErrorCodeSchema,
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
