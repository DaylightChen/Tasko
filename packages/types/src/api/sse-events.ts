import { z } from 'zod';
import { IsoUtcSchema } from '../domain/status.js';
import { ConfigSchema } from '../schemas/config.js';
import { FolderSchema } from '../schemas/folder.js';
import { ItemSchema } from '../schemas/item.js';
import { ProjectSchema } from '../schemas/project.js';
import { TagSchema } from '../schemas/tag.js';

const BaseEvent = z.object({
  source: z.enum(['self', 'other-tab']),
  timestamp: IsoUtcSchema,
});

// Item events
export const ItemCreatedEventSchema = BaseEvent.extend({ id: z.string(), item: ItemSchema });
export type ItemCreatedEvent = z.infer<typeof ItemCreatedEventSchema>;

export const ItemChangedEventSchema = BaseEvent.extend({ id: z.string(), item: ItemSchema });
export type ItemChangedEvent = z.infer<typeof ItemChangedEventSchema>;

export const ItemTrashedEventSchema = BaseEvent.extend({ id: z.string(), item: ItemSchema });
export type ItemTrashedEvent = z.infer<typeof ItemTrashedEventSchema>;

export const ItemRestoredEventSchema = BaseEvent.extend({ id: z.string(), item: ItemSchema });
export type ItemRestoredEvent = z.infer<typeof ItemRestoredEventSchema>;

export const ItemPermanentlyDeletedEventSchema = BaseEvent.extend({ id: z.string() });
export type ItemPermanentlyDeletedEvent = z.infer<typeof ItemPermanentlyDeletedEventSchema>;

// Project events
export const ProjectCreatedEventSchema = BaseEvent.extend({ id: z.string(), project: ProjectSchema });
export type ProjectCreatedEvent = z.infer<typeof ProjectCreatedEventSchema>;

export const ProjectChangedEventSchema = BaseEvent.extend({ id: z.string(), project: ProjectSchema });
export type ProjectChangedEvent = z.infer<typeof ProjectChangedEventSchema>;

export const ProjectDeletedEventSchema = BaseEvent.extend({ id: z.string() });
export type ProjectDeletedEvent = z.infer<typeof ProjectDeletedEventSchema>;

// Folder events
export const FolderCreatedEventSchema = BaseEvent.extend({ id: z.string(), folder: FolderSchema });
export type FolderCreatedEvent = z.infer<typeof FolderCreatedEventSchema>;

export const FolderChangedEventSchema = BaseEvent.extend({ id: z.string(), folder: FolderSchema });
export type FolderChangedEvent = z.infer<typeof FolderChangedEventSchema>;

export const FolderDeletedEventSchema = BaseEvent.extend({ id: z.string() });
export type FolderDeletedEvent = z.infer<typeof FolderDeletedEventSchema>;

// Tag events
export const TagCreatedEventSchema = BaseEvent.extend({ id: z.string(), tag: TagSchema });
export type TagCreatedEvent = z.infer<typeof TagCreatedEventSchema>;

export const TagChangedEventSchema = BaseEvent.extend({ id: z.string(), tag: TagSchema });
export type TagChangedEvent = z.infer<typeof TagChangedEventSchema>;

export const TagDeletedEventSchema = BaseEvent.extend({ id: z.string() });
export type TagDeletedEvent = z.infer<typeof TagDeletedEventSchema>;

// Config event
export const ConfigChangedEventSchema = BaseEvent.extend({ config: ConfigSchema });
export type ConfigChangedEvent = z.infer<typeof ConfigChangedEventSchema>;

// Bulk / trash events
export const TrashEmptiedEventSchema = BaseEvent.extend({ count: z.number().int() });
export type TrashEmptiedEvent = z.infer<typeof TrashEmptiedEventSchema>;

export const BulkCompletedEventSchema = BaseEvent.extend({
  ids: z.array(z.string()),
  count: z.number().int(),
});
export type BulkCompletedEvent = z.infer<typeof BulkCompletedEventSchema>;
