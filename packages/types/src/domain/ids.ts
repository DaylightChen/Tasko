import { z } from 'zod';

const UlidPattern = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const UlidSchema = z.string().regex(UlidPattern);

export const ItemIdSchema = UlidSchema.brand<'ItemId'>();
export const ProjectIdSchema = UlidSchema.brand<'ProjectId'>();
export const FolderIdSchema = UlidSchema.brand<'FolderId'>();
export const TagIdSchema = UlidSchema.brand<'TagId'>();
export const SubtaskIdSchema = UlidSchema.brand<'SubtaskId'>();

export type ItemId = z.infer<typeof ItemIdSchema>;
export type ProjectId = z.infer<typeof ProjectIdSchema>;
export type FolderId = z.infer<typeof FolderIdSchema>;
export type TagId = z.infer<typeof TagIdSchema>;
export type SubtaskId = z.infer<typeof SubtaskIdSchema>;

// Fixed sentinel id for the Inbox project. All chars are in the ULID base32 alphabet.
export const INBOX_PROJECT_ID = '00000000000000000000INBOX0' as ProjectId;
