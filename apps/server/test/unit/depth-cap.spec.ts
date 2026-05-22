/**
 * Unit tests for domain/depth-cap.ts
 *
 * Covers:
 * - levelOf: single-item root, chained parent chain
 * - maxDescendantDepth: leaf, task with subtasks, nested children
 * - canMove: fresh Task at root → ok; Epic→Feature→Task family → ok;
 *   Feature→Feature→Task border → ok; Feature→Feature→Task→child → rejected;
 *   non-task attached to Task → rejected with subtask-attachment reason;
 *   cycle (Epic placed under its descendant) → rejected with 'Cannot place under own descendant.';
 * - canPlaceAtRoot: convenience wrapper behaves correctly
 */
import type { Item, ItemId, ProjectId } from '@tasko/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { canMove, canPlaceAtRoot, levelOf, maxDescendantDepth } from '../../src/domain/depth-cap.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

let idCounter = 0;
function makeId(): ItemId {
  idCounter++;
  return `item-${String(idCounter).padStart(4, '0')}` as ItemId;
}

const PROJECT_ID = 'proj-test' as ProjectId;

function makeItem(overrides: Partial<Item> & { id?: ItemId; parent_id?: ItemId | null }): Item {
  return {
    id: overrides.id ?? makeId(),
    schema_version: 1,
    type: overrides.type ?? 'task',
    project_id: PROJECT_ID,
    parent_id: overrides.parent_id ?? null,
    title: overrides.title ?? 'Untitled',
    notes: '',
    due_date: '2026-05-19',
    start_date: null,
    due_time: null,
    priority: 'none',
    status: overrides.status ?? 'todo',
    tags: [],
    subtasks: overrides.subtasks ?? [],
    recurrence: null,
    completed_at: null,
    trashed_at: overrides.trashed_at ?? null,
    trashed_with: null,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function buildMap(items: Item[]): Map<ItemId, Item> {
  const map = new Map<ItemId, Item>();
  for (const item of items) map.set(item.id, item);
  return map;
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  idCounter = 0;
});

afterEach(() => {
  idCounter = 0;
});

describe('levelOf', () => {
  it('returns 1 for a top-level item (parent_id = null)', () => {
    const item = makeItem({ id: 'a' as ItemId, parent_id: null });
    const map = buildMap([item]);
    expect(levelOf(item, map)).toBe(1);
  });

  it('returns 2 for a direct child of a root item', () => {
    const parent = makeItem({ id: 'a' as ItemId, parent_id: null });
    const child = makeItem({ id: 'b' as ItemId, parent_id: 'a' as ItemId });
    const map = buildMap([parent, child]);
    expect(levelOf(child, map)).toBe(2);
  });

  it('returns 3 for a grandchild (depth = 3)', () => {
    const root = makeItem({ id: 'a' as ItemId, parent_id: null });
    const child = makeItem({ id: 'b' as ItemId, parent_id: 'a' as ItemId });
    const grandchild = makeItem({ id: 'c' as ItemId, parent_id: 'b' as ItemId });
    const map = buildMap([root, child, grandchild]);
    expect(levelOf(grandchild, map)).toBe(3);
  });

  it('returns 4 for a great-grandchild (depth = 4)', () => {
    const a = makeItem({ id: 'a' as ItemId, parent_id: null });
    const b = makeItem({ id: 'b' as ItemId, parent_id: 'a' as ItemId });
    const c = makeItem({ id: 'c' as ItemId, parent_id: 'b' as ItemId });
    const d = makeItem({ id: 'd' as ItemId, parent_id: 'c' as ItemId });
    const map = buildMap([a, b, c, d]);
    expect(levelOf(d, map)).toBe(4);
  });
});

describe('maxDescendantDepth', () => {
  it('returns 0 for a leaf task with no subtasks', () => {
    const item = makeItem({ id: 'a' as ItemId, type: 'task' });
    const map = buildMap([item]);
    expect(maxDescendantDepth(item, map)).toBe(0);
  });

  it('returns 1 for a task that has subtasks (inlined level counts as +1)', () => {
    const item = makeItem({
      id: 'a' as ItemId,
      type: 'task',
      subtasks: [
        {
          id: 'st-1' as unknown as import('@tasko/types').SubtaskId,
          title: 'Subtask',
          status: 'todo',
          completed_at: null,
          sort_order: 0,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ],
    });
    const map = buildMap([item]);
    expect(maxDescendantDepth(item, map)).toBe(1);
  });

  it('returns 1 for an Epic with one Feature child (no deeper)', () => {
    const epic = makeItem({ id: 'e' as ItemId, type: 'epic', parent_id: null });
    const feature = makeItem({ id: 'f' as ItemId, type: 'feature', parent_id: 'e' as ItemId });
    const map = buildMap([epic, feature]);
    expect(maxDescendantDepth(epic, map)).toBe(1);
  });

  it('returns 2 for an Epic with Feature→Task chain', () => {
    const epic = makeItem({ id: 'e' as ItemId, type: 'epic', parent_id: null });
    const feature = makeItem({ id: 'f' as ItemId, type: 'feature', parent_id: 'e' as ItemId });
    const task = makeItem({ id: 't' as ItemId, type: 'task', parent_id: 'f' as ItemId });
    const map = buildMap([epic, feature, task]);
    expect(maxDescendantDepth(epic, map)).toBe(2);
  });

  it('excludes trashed descendants from the depth count', () => {
    const epic = makeItem({ id: 'e' as ItemId, type: 'epic', parent_id: null });
    const feature = makeItem({ id: 'f' as ItemId, type: 'feature', parent_id: 'e' as ItemId });
    const task = makeItem({
      id: 't' as ItemId,
      type: 'task',
      parent_id: 'f' as ItemId,
      trashed_at: '2026-01-01T00:00:00Z',
    });
    const map = buildMap([epic, feature, task]);
    // task is trashed → only 1 level deep (the Feature)
    expect(maxDescendantDepth(epic, map)).toBe(1);
  });
});

describe('canMove', () => {
  it('allows placing a fresh Task at the project root', () => {
    const task = makeItem({ id: 't' as ItemId, type: 'task', parent_id: null });
    const map = buildMap([task]);
    const result = canMove({ source: task, newParent: null, items: map });
    expect(result.ok).toBe(true);
  });

  it('allows a complete Epic→Feature→Task hierarchy (3 levels, within cap)', () => {
    // Epic(L1) → Feature(L2) → Task(L3): placing Task under Feature → newSourceLevel=3, dDepth=0 → 3 ≤ 4
    const epic = makeItem({ id: 'e' as ItemId, type: 'epic', parent_id: null });
    const feature = makeItem({ id: 'f' as ItemId, type: 'feature', parent_id: 'e' as ItemId });
    const task = makeItem({ id: 't' as ItemId, type: 'task', parent_id: null });
    const map = buildMap([epic, feature, task]);
    const result = canMove({ source: task, newParent: feature, items: map });
    expect(result.ok).toBe(true);
  });

  it('allows Epic→Feature→Task with subtasks family (borderline: 4 levels)', () => {
    // epic(L1) → feature(L2) → task(L3) with subtask → placing feature under epic:
    // newSourceLevel=2, maxDescendantDepth(feature) = 2 (task + subtask inline), total = 4 ≤ 4
    const epic = makeItem({ id: 'e' as ItemId, type: 'epic', parent_id: null });
    const feature = makeItem({ id: 'f' as ItemId, type: 'feature', parent_id: null });
    const task = makeItem({
      id: 't' as ItemId,
      type: 'task',
      parent_id: 'f' as ItemId,
      subtasks: [
        {
          id: 'st-1' as unknown as import('@tasko/types').SubtaskId,
          title: 'Subtask',
          status: 'todo',
          completed_at: null,
          sort_order: 0,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ],
    });
    const map = buildMap([epic, feature, task]);
    const result = canMove({ source: feature, newParent: epic, items: map });
    expect(result.ok).toBe(true);
  });

  it('rejects when nesting would exceed 4 levels', () => {
    // feature(L1) already has task(L2) which has subtask → maxDescendantDepth(feature)=2
    // placing that feature under another feature that is at L2 → newSourceLevel=3
    // 3 + 2 = 5 > 4 → reject
    const epicParent = makeItem({ id: 'ep' as ItemId, type: 'epic', parent_id: null });
    const outerFeature = makeItem({ id: 'of' as ItemId, type: 'feature', parent_id: 'ep' as ItemId });
    const innerFeature = makeItem({ id: 'if' as ItemId, type: 'feature', parent_id: null });
    const task = makeItem({
      id: 't' as ItemId,
      type: 'task',
      parent_id: 'if' as ItemId,
      subtasks: [
        {
          id: 'st-1' as unknown as import('@tasko/types').SubtaskId,
          title: 'Subtask',
          status: 'todo',
          completed_at: null,
          sort_order: 0,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ],
    });
    const map = buildMap([epicParent, outerFeature, innerFeature, task]);
    // Trying to place innerFeature (which has task+subtask = 2 deep) under outerFeature (L2) → newLevel=3, 3+2=5
    const result = canMove({ source: innerFeature, newParent: outerFeature, items: map });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/exceed maximum nesting depth/i);
    }
  });

  it('rejects placing a non-task (Feature) under a Task — subtask-attachment rule', () => {
    const task = makeItem({ id: 't' as ItemId, type: 'task', parent_id: null });
    const feature = makeItem({ id: 'f' as ItemId, type: 'feature', parent_id: null });
    const map = buildMap([task, feature]);
    const result = canMove({ source: feature, newParent: task, items: map });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/Only subtasks may attach to a Task/i);
    }
  });

  it('rejects placing an Epic under a Task — subtask-attachment rule', () => {
    const task = makeItem({ id: 't' as ItemId, type: 'task', parent_id: null });
    const epic = makeItem({ id: 'e' as ItemId, type: 'epic', parent_id: null });
    const map = buildMap([task, epic]);
    const result = canMove({ source: epic, newParent: task, items: map });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/Only subtasks may attach to a Task/i);
    }
  });

  it('rejects a cycle: placing an Epic under one of its own descendants', () => {
    // epic → feature → task; try placing epic under task → cycle
    const epic = makeItem({ id: 'e' as ItemId, type: 'epic', parent_id: null });
    const feature = makeItem({ id: 'f' as ItemId, type: 'feature', parent_id: 'e' as ItemId });
    const task = makeItem({ id: 't' as ItemId, type: 'task', parent_id: 'f' as ItemId });
    const map = buildMap([epic, feature, task]);
    // task is of type 'task', so the non-task-under-task guard hits first for feature/epic.
    // Use feature as the target with feature under epic — cycle:
    // Place epic under feature (epic's own descendant)
    // But feature's type is 'feature', so the subtask rule won't block this.
    // Actually feature is a descendant of epic, and epic.type !== 'task' and feature.type !== 'task'
    // → subtask rule won't fire; levelOf(feature) = 2; epic has depth 2 beneath itself already
    // newSourceLevel=3, dDepth of epic=2 → 5 > 4 → depth cap fires first.
    // To test the pure cycle path, we need a shallow cycle: place epic (leaf, no children except feature)
    // under feature where dDepth(epic without cycle) = 1 (feature, but we're placing it) ...
    // The clean cycle test: epic has only feature child; feature has 0 extra children.
    // maxDescendantDepth(epic) = 1 (feature); newSourceLevel = levelOf(feature)+1 = 3; 3+1=4 ≤ 4
    // So depth cap DOESN'T fire here; cycle check runs → should return 'Cannot place under own descendant.'
    const epicB = makeItem({ id: 'eb' as ItemId, type: 'epic', parent_id: null });
    const featureB = makeItem({ id: 'fb' as ItemId, type: 'feature', parent_id: 'eb' as ItemId });
    const mapB = buildMap([epicB, featureB]);
    const result = canMove({ source: epicB, newParent: featureB, items: mapB });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('Cannot place under own descendant.');
    }
  });

  it('allows a Task placed under another Task (subtask semantics)', () => {
    // A task CAN be placed under another task (they become subtasks-as-tasks semantically)
    // The subtask-attachment rule only blocks non-tasks. task-under-task is allowed.
    const parentTask = makeItem({ id: 'pt' as ItemId, type: 'task', parent_id: null });
    const childTask = makeItem({ id: 'ct' as ItemId, type: 'task', parent_id: null });
    const map = buildMap([parentTask, childTask]);
    const result = canMove({ source: childTask, newParent: parentTask, items: map });
    // source.type === 'task', so subtask-attachment rule won't fire.
    // newSourceLevel = 2; dDepth = 0; 2 ≤ 4 → ok
    expect(result.ok).toBe(true);
  });
});

describe('canPlaceAtRoot', () => {
  it('allows placing a flat task at root', () => {
    const task = makeItem({ id: 't' as ItemId, type: 'task', parent_id: null });
    const map = buildMap([task]);
    expect(canPlaceAtRoot(task, map).ok).toBe(true);
  });

  it('allows placing an Epic (with shallow tree) at root — Epic at root is level 1', () => {
    const epic = makeItem({ id: 'e' as ItemId, type: 'epic', parent_id: null });
    const feature = makeItem({ id: 'f' as ItemId, type: 'feature', parent_id: 'e' as ItemId });
    const task = makeItem({ id: 't' as ItemId, type: 'task', parent_id: 'f' as ItemId });
    const map = buildMap([epic, feature, task]);
    // newSourceLevel = 1 (root); dDepth(epic) = 2; 1+2 = 3 ≤ 4 → ok
    expect(canPlaceAtRoot(epic, map).ok).toBe(true);
  });

  it('rejects placing a deep subtree at root if it exceeds 4 levels', () => {
    // Build a 4-deep chain: epic→feature→task→(subtask inline):
    // dDepth(epic) = 3 (feature + task + subtask): 1+3 = 4 ≤ 4 → still ok
    // To fail: epic→feature→task (subtask) ← dDepth=3; placing this at root: 1+3=4 still ok
    // We need dDepth > 3 to fail. That requires epic→feat→task→(some 4th level child):
    // Let's add another task child under the subtask-parent-task (since tasks can have task children):
    const epic = makeItem({ id: 'e' as ItemId, type: 'epic', parent_id: null });
    const feat = makeItem({ id: 'f' as ItemId, type: 'feature', parent_id: 'e' as ItemId });
    const task = makeItem({
      id: 't' as ItemId,
      type: 'task',
      parent_id: 'f' as ItemId,
      subtasks: [
        {
          id: 'st-1' as unknown as import('@tasko/types').SubtaskId,
          title: 'Subtask',
          status: 'todo',
          completed_at: null,
          sort_order: 0,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ],
    });
    const extraChild = makeItem({ id: 'x' as ItemId, type: 'task', parent_id: 't' as ItemId });
    const map = buildMap([epic, feat, task, extraChild]);
    // maxDescendantDepth(epic):
    //   children of epic = [feat]; maxDescendantDepth(feat):
    //     children of feat = [task]; maxDescendantDepth(task):
    //       children of task = [extraChild]; maxDescendantDepth(extraChild):
    //         no children, no subtasks → 0
    //       → 1 + max(0) = 1, BUT task also has subtask → subtask branch:
    //         wait, children.length > 0 (extraChild), so subtask branch doesn't run
    //         → 1 + 0 = 1
    //       → so maxDescendantDepth(task) = 1
    //     → 1 + 1 = 2
    //   → maxDescendantDepth(feat) = 2
    //   → 1 + 2 = 3
    // dDepth(epic) = 3; 1 + 3 = 4 ≤ 4 → still ok at root
    // Actually to get a rejection we need dDepth = 4:
    // epic→feat→task→subtaskChild→(subtask of subtaskChild)
    const subtaskChild = makeItem({
      id: 'sc' as ItemId,
      type: 'task',
      parent_id: 'x' as ItemId,
    });
    const deepMap = buildMap([epic, feat, task, extraChild, subtaskChild]);
    // dDepth: epic → feat(1) → task(2) → extraChild(3) → subtaskChild(4) → dDepth=4; 1+4=5 > 4
    expect(canPlaceAtRoot(epic, deepMap).ok).toBe(false);
  });
});
