import type { ItemId, ProjectId, TagId } from '@tasko/types';
import type { ItemListFilters } from './items';

export const itemKeys = {
  all: ['items'] as const,
  lists: () => [...itemKeys.all, 'list'] as const,
  list: (filters: ItemListFilters) => [...itemKeys.lists(), filters] as const,
  detail: (id: ItemId) => [...itemKeys.all, 'detail', id] as const,
  today: () => itemKeys.list({ view: 'today' }),
  tomorrow: () => itemKeys.list({ view: 'tomorrow' }),
  next7: () => itemKeys.list({ view: 'next7' }),
  inbox: () => itemKeys.list({ view: 'inbox' }),
  byProject: (projectId: ProjectId) => itemKeys.list({ view: 'project', project_id: projectId }),
  byTag: (tagId: TagId) => itemKeys.list({ view: 'tag', tag_id: tagId }),
  completed: () => itemKeys.list({ view: 'completed' }),
};

export const trashKeys = {
  all: ['trash'] as const,
  list: () => ['trash', 'list'] as const,
};

export const projectKeys = {
  all: ['projects'] as const,
  detail: (id: ProjectId) => ['projects', 'detail', id] as const,
};

export const folderKeys = {
  all: ['folders'] as const,
};

export const tagKeys = {
  all: ['tags'] as const,
  autocomplete: (q: string) => ['tags', 'autocomplete', q] as const,
};

export const configKeys = {
  all: ['config'] as const,
};

export const healthKeys = {
  all: ['health'] as const,
};
