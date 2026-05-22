import type { Item, ItemId } from '@tasko/types';

export type CanMoveResult = { ok: true } | { ok: false; reason: string };

/**
 * Returns the 1-based level of `item` in its project tree.
 * Level 1 = top-level item (parent_id === null).
 * Level 2 = child of a top-level item, etc.
 */
export function levelOf(item: Item, items: Map<ItemId, Item>): number {
  let level = 1;
  let cursor = item.parent_id ? items.get(item.parent_id) : null;
  while (cursor) {
    level++;
    cursor = cursor.parent_id ? (items.get(cursor.parent_id) ?? null) : null;
  }
  return level;
}

/**
 * Returns the maximum depth of descendants beneath `item`, where `item` itself
 * is depth 0. Excludes trashed items. A task with subtasks adds 1 for the
 * subtask level even though subtasks are inlined.
 */
export function maxDescendantDepth(item: Item, items: Map<ItemId, Item>): number {
  const children = [...items.values()].filter((i) => i.parent_id === item.id && !i.trashed_at);
  if (children.length === 0) {
    if (item.type === 'task' && (item.subtasks ?? []).length > 0) return 1;
    return 0;
  }
  return 1 + Math.max(...children.map((c) => maxDescendantDepth(c, items)));
}

/**
 * Checks whether moving `source` to be a child of `newParent` (or to the
 * project root when `newParent` is null) is allowed by the 4-level depth cap,
 * the subtask-attachment rule, and cycle prevention.
 */
export function canMove({
  source,
  newParent,
  items,
}: {
  source: Item;
  newParent: Item | null;
  items: Map<ItemId, Item>;
}): CanMoveResult {
  // Subtask attachment rule: only tasks may be children of a task.
  // Epics and Features cannot be placed under a Task.
  if (source.type !== 'task' && newParent !== null && newParent.type === 'task') {
    return { ok: false, reason: 'Only subtasks may attach to a Task.' };
  }

  // Compute the new level of source after the move.
  const newSourceLevel = newParent === null ? 1 : levelOf(newParent, items) + 1;

  // Deepest descendant depth under source (0 if leaf).
  const dDepth = maxDescendantDepth(source, items);

  if (newSourceLevel + dDepth > 4) {
    return {
      ok: false,
      reason: `Would exceed maximum nesting depth (${newSourceLevel + dDepth} levels, cap is 4).`,
    };
  }

  // Cycle check: newParent must not be a descendant of source.
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

/**
 * Convenience: check whether `source` can be placed at the project root
 * (i.e., parent_id = null). Equivalent to canMove with newParent = null.
 */
export function canPlaceAtRoot(source: Item, items: Map<ItemId, Item>): CanMoveResult {
  return canMove({ source, newParent: null, items });
}
