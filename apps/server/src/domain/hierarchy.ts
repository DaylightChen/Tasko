import type { Item, ItemId, ProjectId } from '@tasko/types';
export { rollupProgress } from '@tasko/types';

/**
 * Depth-first enumeration of all non-trashed descendants of `itemId`.
 * Does NOT include the item itself.
 */
export function descendantsOf(itemId: ItemId, items: Map<ItemId, Item>): Item[] {
  const result: Item[] = [];
  const queue: ItemId[] = [itemId];

  while (queue.length > 0) {
    const parentId = queue.shift();
    if (parentId === undefined) break;

    for (const item of items.values()) {
      if (item.parent_id === parentId && !item.trashed_at) {
        result.push(item);
        queue.push(item.id);
      }
    }
  }

  return result;
}

/**
 * Returns all non-trashed items that are at the top level of a project
 * (parent_id === null, project_id === projectId).
 */
export function topLevelOfProject(projectId: ProjectId, items: Map<ItemId, Item>): Item[] {
  return [...items.values()].filter(
    (item) => item.project_id === projectId && item.parent_id === null && item.trashed_at === null,
  );
}
