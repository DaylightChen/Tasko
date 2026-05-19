import { useSSEStore } from '@/store/sse';
import type { QueryClient } from '@tanstack/react-query';
import type { ItemId, ProjectId } from '@tasko/types';
import {
  BulkCompletedEventSchema,
  ConfigChangedEventSchema,
  FolderChangedEventSchema,
  FolderCreatedEventSchema,
  FolderDeletedEventSchema,
  ItemChangedEventSchema,
  ItemCreatedEventSchema,
  ItemPermanentlyDeletedEventSchema,
  ItemRestoredEventSchema,
  ItemTrashedEventSchema,
  ProjectChangedEventSchema,
  ProjectCreatedEventSchema,
  ProjectDeletedEventSchema,
  TagChangedEventSchema,
  TagCreatedEventSchema,
  TrashEmptiedEventSchema,
} from '@tasko/types';
import type { ZodSchema } from 'zod';
import { configKeys, folderKeys, itemKeys, projectKeys, tagKeys, trashKeys } from './keys';

export function createSSEClient(tabId: string, queryClient: QueryClient): () => void {
  const url = new URL('/api/events', window.location.origin);
  url.searchParams.set('tab_id', tabId);
  const es = new EventSource(url.toString());

  function on<T>(type: string, schema: ZodSchema<T>, handler: (payload: T) => void): void {
    es.addEventListener(type, (e: Event) => {
      const me = e as MessageEvent<string>;
      const parsed = schema.safeParse(JSON.parse(me.data) as unknown);
      if (!parsed.success) {
        console.warn('SSE schema mismatch', type, parsed.error);
        return;
      }
      handler(parsed.data);
    });
  }

  on('item.created', ItemCreatedEventSchema, (p) => {
    if (p.source === 'self') return;
    void queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
  });

  on('item.changed', ItemChangedEventSchema, (p) => {
    if (p.source === 'self') return;
    queryClient.setQueryData(itemKeys.detail(p.id as ItemId), p.item);
    void queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
  });

  on('item.trashed', ItemTrashedEventSchema, (p) => {
    if (p.source === 'self') return;
    void queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: trashKeys.list() });
  });

  on('item.restored', ItemRestoredEventSchema, (p) => {
    if (p.source === 'self') return;
    void queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: trashKeys.list() });
  });

  on('item.permanently_deleted', ItemPermanentlyDeletedEventSchema, (p) => {
    if (p.source === 'self') return;
    void queryClient.invalidateQueries({ queryKey: trashKeys.list() });
  });

  on('project.created', ProjectCreatedEventSchema, (p) => {
    if (p.source === 'self') return;
    void queryClient.invalidateQueries({ queryKey: projectKeys.all });
  });

  on('project.changed', ProjectChangedEventSchema, (p) => {
    if (p.source === 'self') return;
    queryClient.setQueryData(projectKeys.detail(p.id as ProjectId), p.project);
    void queryClient.invalidateQueries({ queryKey: projectKeys.all });
  });

  on('project.deleted', ProjectDeletedEventSchema, (p) => {
    if (p.source === 'self') return;
    void queryClient.invalidateQueries({ queryKey: projectKeys.all });
    void queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: trashKeys.list() });
  });

  on('folder.created', FolderCreatedEventSchema, (p) => {
    if (p.source === 'self') return;
    void queryClient.invalidateQueries({ queryKey: folderKeys.all });
  });

  on('folder.changed', FolderChangedEventSchema, (p) => {
    if (p.source === 'self') return;
    void queryClient.invalidateQueries({ queryKey: folderKeys.all });
  });

  on('folder.deleted', FolderDeletedEventSchema, (p) => {
    if (p.source === 'self') return;
    void queryClient.invalidateQueries({ queryKey: folderKeys.all });
    void queryClient.invalidateQueries({ queryKey: projectKeys.all });
  });

  on('tag.created', TagCreatedEventSchema, (p) => {
    if (p.source === 'self') return;
    void queryClient.invalidateQueries({ queryKey: tagKeys.all });
  });

  on('tag.changed', TagChangedEventSchema, (p) => {
    if (p.source === 'self') return;
    void queryClient.invalidateQueries({ queryKey: tagKeys.all });
  });

  on('config.changed', ConfigChangedEventSchema, (p) => {
    if (p.source === 'self') return;
    queryClient.setQueryData(configKeys.all, p.config);
  });

  on('trash.emptied', TrashEmptiedEventSchema, (p) => {
    if (p.source === 'self') return;
    void queryClient.invalidateQueries({ queryKey: trashKeys.list() });
  });

  on('bulk.completed', BulkCompletedEventSchema, (p) => {
    if (p.source === 'self') return;
    void queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
  });

  es.onerror = () => {
    useSSEStore.setState({ connectionState: 'reconnecting' });
  };

  es.onopen = () => {
    const prior = useSSEStore.getState().connectionState;
    useSSEStore.setState({ connectionState: 'connected' });
    if (prior === 'reconnecting') {
      void queryClient.refetchQueries({ stale: true });
    }
  };

  return () => {
    es.close();
  };
}
