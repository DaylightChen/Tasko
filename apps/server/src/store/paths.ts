import { join } from 'node:path';
import type { FolderId, ItemId, ProjectId, TagId } from '@tasko/types';

export interface Paths {
  dataDir: string;
  configFile: string;
  itemsDir: string;
  trashDir: string;
  projectsDir: string;
  foldersDir: string;
  tagsDir: string;
  itemFile: (id: ItemId) => string;
  trashFile: (id: ItemId) => string;
  projectFile: (id: ProjectId) => string;
  folderFile: (id: FolderId) => string;
  tagFile: (id: TagId) => string;
}

export function buildPaths(dataDir: string): Paths {
  const itemsDir = join(dataDir, 'items');
  const trashDir = join(dataDir, 'trash');
  const projectsDir = join(dataDir, 'projects');
  const foldersDir = join(dataDir, 'folders');
  const tagsDir = join(dataDir, 'tags');
  return {
    dataDir,
    configFile: join(dataDir, 'config.json'),
    itemsDir,
    trashDir,
    projectsDir,
    foldersDir,
    tagsDir,
    itemFile: (id: ItemId) => join(itemsDir, `${id}.json`),
    trashFile: (id: ItemId) => join(trashDir, `${id}.json`),
    projectFile: (id: ProjectId) => join(projectsDir, `${id}.json`),
    folderFile: (id: FolderId) => join(foldersDir, `${id}.json`),
    tagFile: (id: TagId) => join(tagsDir, `${id}.json`),
  };
}
