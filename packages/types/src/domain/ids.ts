import { z } from 'zod';

const UlidPattern = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const UlidSchema = z.string().regex(UlidPattern);

// Fixed sentinel id for the Inbox project. The literal predates the strict
// ULID regex and contains 'I' and 'O', which are excluded from Crockford
// base32. We accept it as a valid ProjectId so any project_id field in the
// system (both Project.id and Item.project_id of an Inbox item) round-trips
// through Zod validation without a separate disk/wire schema.
const INBOX_PROJECT_ID_LITERAL = '00000000000000000000INBOX0';

export const ItemIdSchema = UlidSchema.brand<'ItemId'>();
export const ProjectIdSchema = z
  .string()
  .refine((s) => UlidPattern.test(s) || s === INBOX_PROJECT_ID_LITERAL, {
    message: 'Invalid ProjectId',
  })
  .brand<'ProjectId'>();
export const FolderIdSchema = UlidSchema.brand<'FolderId'>();
export const TagIdSchema = UlidSchema.brand<'TagId'>();
export const SubtaskIdSchema = UlidSchema.brand<'SubtaskId'>();

export type ItemId = z.infer<typeof ItemIdSchema>;
export type ProjectId = z.infer<typeof ProjectIdSchema>;
export type FolderId = z.infer<typeof FolderIdSchema>;
export type TagId = z.infer<typeof TagIdSchema>;
export type SubtaskId = z.infer<typeof SubtaskIdSchema>;

export const INBOX_PROJECT_ID = INBOX_PROJECT_ID_LITERAL as ProjectId;
