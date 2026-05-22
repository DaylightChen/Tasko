/**
 * Unit tests for lib/depth-cap-client.ts
 *
 * Mirrors the server depth-cap.spec.ts test cases to ensure the client-side
 * implementation is an exact mirror of the server's canMove algorithm.
 *
 * Covers:
 * - Fresh task at root → ok
 * - Epic→Feature→Task family → ok
 * - Non-task under Task → rejected (subtask-attachment rule)
 * - Depth cap exceeded → rejected
 * - Cycle (Epic placed under its own descendant) → rejected with 'Cannot place under own descendant.'
 */
import type { Item, ItemId, ProjectId } from '@tasko/types';
import { describe, expect, it } from 'vitest';
import { canMoveClient } from '../depth-cap-client';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PROJECT_ID = 'proj-test' as ProjectId;

function makeItem(
  id: string,
  overrides: {
    type?: Item['type'];
    parent_id?: ItemId | null;
    title?: string;
    status?: Item['status'];
    subtasks?: Item['subtasks'];
    trashed_at?: string | null;
  } = {},
): Item {
  return {
    id: id as ItemId,
    schema_version: 1,
    type: overrides.type ?? 'task',
    project_id: PROJECT_ID,
    parent_id: overrides.parent_id ?? null,
    title: overrides.title ?? id,
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
    trashed_at: (overrides.trashed_at ?? null) as string | null,
    trashed_with: null,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

function buildMap(items: Item[]): Map<ItemId, Item> {
  const map = new Map<ItemId, Item>();
  for (const item of items) map.set(item.id, item);
  return map;
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('canMoveClient', () => {
  it('allows placing a task at project root (newParent = null)', () => {
    const task = makeItem('task-1', { type: 'task' });
    const map = buildMap([task]);
    expect(canMoveClient({ source: task, newParent: null, items: map }).ok).toBe(true);
  });

  it('allows a valid Epic → Feature → Task nesting', () => {
    const epic = makeItem('e', { type: 'epic', parent_id: null });
    const feature = makeItem('f', { type: 'feature', parent_id: 'e' as ItemId });
    const task = makeItem('t', { type: 'task', parent_id: null });
    const map = buildMap([epic, feature, task]);
    expect(canMoveClient({ source: task, newParent: feature, items: map }).ok).toBe(true);
  });

  it('rejects placing a Feature (non-task) under a Task — subtask-attachment rule', () => {
    const parentTask = makeItem('pt', { type: 'task', parent_id: null });
    const feature = makeItem('f', { type: 'feature', parent_id: null });
    const map = buildMap([parentTask, feature]);
    const result = canMoveClient({ source: feature, newParent: parentTask, items: map });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/Only subtasks may attach to a Task/i);
    }
  });

  it('rejects placing an Epic under a Task — subtask-attachment rule', () => {
    const parentTask = makeItem('pt', { type: 'task', parent_id: null });
    const epic = makeItem('e', { type: 'epic', parent_id: null });
    const map = buildMap([parentTask, epic]);
    const result = canMoveClient({ source: epic, newParent: parentTask, items: map });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/Only subtasks may attach to a Task/i);
    }
  });

  it('rejects when nesting would create a 5th level (exceeds depth cap of 4)', () => {
    // epic(L1) → feat(L2) → task(L3) → taskL4(L4). Trying to place a new task under taskL4 → L5
    const epic = makeItem('e', { type: 'epic', parent_id: null });
    const feat = makeItem('f', { type: 'feature', parent_id: 'e' as ItemId });
    const task = makeItem('t', { type: 'task', parent_id: 'f' as ItemId });
    const taskL4 = makeItem('tl4', { type: 'task', parent_id: 't' as ItemId });
    const looseTask = makeItem('loose', { type: 'task', parent_id: null });
    const map = buildMap([epic, feat, task, taskL4, looseTask]);
    const result = canMoveClient({ source: looseTask, newParent: taskL4, items: map });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/exceed maximum nesting depth/i);
    }
  });

  it('rejects placing an Epic under its own descendant (cycle)', () => {
    // epic → feature; try to place epic under feature
    const epic = makeItem('epic', { type: 'epic', parent_id: null });
    const feature = makeItem('feat', { type: 'feature', parent_id: 'epic' as ItemId });
    const map = buildMap([epic, feature]);
    // Level check: newSourceLevel = levelOf(feature)+1 = 3; dDepth(epic) = 1 (feature); 3+1=4 ≤ 4 → depth cap does NOT block
    // Cycle check: feature is a descendant of epic → rejected
    const result = canMoveClient({ source: epic, newParent: feature, items: map });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('Cannot place under own descendant.');
    }
  });

  it('allows placing an item next to its sibling (no-op or lateral move)', () => {
    const epic = makeItem('e', { type: 'epic', parent_id: null });
    const feat1 = makeItem('f1', { type: 'feature', parent_id: 'e' as ItemId });
    const feat2 = makeItem('f2', { type: 'feature', parent_id: 'e' as ItemId });
    const task = makeItem('t', { type: 'task', parent_id: 'f1' as ItemId });
    const map = buildMap([epic, feat1, feat2, task]);
    // Move task under feat2 (same level, different parent) → valid
    const result = canMoveClient({ source: task, newParent: feat2, items: map });
    expect(result.ok).toBe(true);
  });
});
