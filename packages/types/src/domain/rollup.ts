import type { Item } from '../schemas/item.js';
import type { ItemId } from './ids.js';

/**
 * Computes the rollup progress for an Epic or Feature: the count of direct
 * children with status === 'done' over the total non-trashed direct children.
 *
 * Pure function — works on any Map<ItemId, Item>. Usable on both server
 * (passes the indexer's items map) and client (passes a map built from the
 * TanStack Query cache).
 *
 * Returns { completed, total }. When total === 0 the caller should hide
 * the progress chip entirely.
 */
export function rollupProgress(item: Item, items: Map<ItemId, Item>): { completed: number; total: number } {
  const children = [...items.values()].filter((i) => i.parent_id === item.id && i.trashed_at === null);
  const completed = children.filter((c) => c.status === 'done').length;
  return { completed, total: children.length };
}
