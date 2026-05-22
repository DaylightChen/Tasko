import type { Item, ItemId } from '@tasko/types';

/**
 * Client-side mirror of the server's canMove algorithm (data-model.md §3.7).
 * Operates on a Map<ItemId, Item> derived from the TanStack Query cache.
 *
 * Returns { ok: true } or { ok: false, reason: string } — identical shape
 * to the server's CanMoveResult.
 */

export type CanMoveClientResult = { ok: true } | { ok: false; reason: string };

function levelOf(item: Item, items: Map<ItemId, Item>): number {
  let level = 1;
  let cursor = item.parent_id ? items.get(item.parent_id) : null;
  while (cursor) {
    level++;
    cursor = cursor.parent_id ? (items.get(cursor.parent_id) ?? null) : null;
  }
  return level;
}

function maxDescendantDepth(item: Item, items: Map<ItemId, Item>): number {
  const children = [...items.values()].filter((i) => i.parent_id === item.id && !i.trashed_at);
  if (children.length === 0) {
    if (item.type === 'task' && (item.subtasks ?? []).length > 0) return 1;
    return 0;
  }
  return 1 + Math.max(...children.map((c) => maxDescendantDepth(c, items)));
}

/**
 * Check whether moving `source` under `newParent` (null = project root) is
 * allowed. This mirrors the server's canMove function exactly.
 */
export function canMoveClient({
  source,
  newParent,
  items,
}: {
  source: Item;
  newParent: Item | null;
  items: Map<ItemId, Item>;
}): CanMoveClientResult {
  if (source.type !== 'task' && newParent !== null && newParent.type === 'task') {
    return { ok: false, reason: 'Only subtasks may attach to a Task.' };
  }

  const newSourceLevel = newParent === null ? 1 : levelOf(newParent, items) + 1;
  const dDepth = maxDescendantDepth(source, items);

  if (newSourceLevel + dDepth > 4) {
    return {
      ok: false,
      reason: `Would exceed maximum nesting depth (${newSourceLevel + dDepth} levels, cap is 4).`,
    };
  }

  if (newParent !== null) {
    let cursor: Item | null = newParent;
    while (cursor) {
      if (cursor.id === source.id) {
        return { ok: false, reason: 'Cannot place under own descendant.' };
      }
      cursor = cursor.parent_id ? (items.get(cursor.parent_id) ?? null) : null;
    }
  }

  return { ok: true };
}
