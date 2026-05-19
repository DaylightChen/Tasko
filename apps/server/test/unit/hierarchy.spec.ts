/**
 * Unit tests for domain/hierarchy.ts
 *
 * Covers:
 * - descendantsOf: leaf, 1 child, multi-level, excludes trashed
 * - topLevelOfProject: filters by project + null parent + trashed
 * - rollupProgress: empty, partial, full, excludes trashed
 */
import type { Item, ItemId, ProjectId } from '@tasko/types';
import { describe, expect, it } from 'vitest';
import { descendantsOf, rollupProgress, topLevelOfProject } from '../../src/domain/hierarchy.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PROJ_A = 'proj-a' as ProjectId;
const PROJ_B = 'proj-b' as ProjectId;

function makeItem(
  id: string,
  overrides: {
    parent_id?: string | null;
    project_id?: string;
    type?: Item['type'];
    status?: Item['status'];
    trashed_at?: string | null;
    title?: string;
  } = {},
): Item {
  return {
    id: id as ItemId,
    schema_version: 1,
    type: overrides.type ?? 'task',
    project_id: (overrides.project_id ?? PROJ_A) as ProjectId,
    parent_id: (overrides.parent_id ?? null) as ItemId | null,
    title: overrides.title ?? id,
    notes: '',
    due_date: '2026-05-19',
    start_date: null,
    due_time: null,
    priority: 'none',
    status: overrides.status ?? 'todo',
    tags: [],
    subtasks: [],
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

// ─── descendantsOf ────────────────────────────────────────────────────────────

describe('descendantsOf', () => {
  it('returns empty array for a leaf item', () => {
    const leaf = makeItem('leaf');
    const map = buildMap([leaf]);
    expect(descendantsOf('leaf' as ItemId, map)).toEqual([]);
  });

  it('returns direct children only for a single-level parent', () => {
    const parent = makeItem('parent');
    const child1 = makeItem('c1', { parent_id: 'parent' });
    const child2 = makeItem('c2', { parent_id: 'parent' });
    const map = buildMap([parent, child1, child2]);
    const result = descendantsOf('parent' as ItemId, map);
    const resultIds = result.map((i) => i.id).sort();
    expect(resultIds).toEqual(['c1', 'c2'].sort());
  });

  it('returns all descendants in a multi-level chain', () => {
    const epic = makeItem('epic');
    const feature = makeItem('feature', { parent_id: 'epic' });
    const task = makeItem('task', { parent_id: 'feature' });
    const map = buildMap([epic, feature, task]);
    const result = descendantsOf('epic' as ItemId, map);
    const resultIds = result.map((i) => i.id).sort();
    expect(resultIds).toEqual(['feature', 'task'].sort());
  });

  it('excludes trashed descendants', () => {
    const epic = makeItem('epic');
    const feature = makeItem('feature', { parent_id: 'epic' });
    const trashedTask = makeItem('task-trashed', {
      parent_id: 'feature',
      trashed_at: '2026-01-01T00:00:00Z',
    });
    const map = buildMap([epic, feature, trashedTask]);
    const result = descendantsOf('epic' as ItemId, map);
    // feature is not trashed so it appears; trashedTask is excluded
    expect(result.map((i) => i.id)).toContain('feature');
    expect(result.map((i) => i.id)).not.toContain('task-trashed');
  });

  it('does not include the item itself', () => {
    const item = makeItem('self');
    const map = buildMap([item]);
    const result = descendantsOf('self' as ItemId, map);
    expect(result.map((i) => i.id)).not.toContain('self');
  });
});

// ─── topLevelOfProject ───────────────────────────────────────────────────────

describe('topLevelOfProject', () => {
  it('returns only items with parent_id=null for the given project', () => {
    const topA1 = makeItem('topA1', { project_id: PROJ_A, parent_id: null });
    const topA2 = makeItem('topA2', { project_id: PROJ_A, parent_id: null });
    const childA = makeItem('childA', { project_id: PROJ_A, parent_id: 'topA1' });
    const topB = makeItem('topB', { project_id: PROJ_B, parent_id: null });
    const map = buildMap([topA1, topA2, childA, topB]);
    const result = topLevelOfProject(PROJ_A, map);
    const resultIds = result.map((i) => i.id).sort();
    expect(resultIds).toEqual(['topA1', 'topA2'].sort());
  });

  it('excludes trashed items from top-level results', () => {
    const top = makeItem('top');
    const trashedTop = makeItem('trashed-top', {
      parent_id: null,
      trashed_at: '2026-01-01T00:00:00Z',
    });
    const map = buildMap([top, trashedTop]);
    const result = topLevelOfProject(PROJ_A, map);
    expect(result.map((i) => i.id)).toContain('top');
    expect(result.map((i) => i.id)).not.toContain('trashed-top');
  });

  it('returns empty array when project has no top-level items', () => {
    const child = makeItem('child', { project_id: PROJ_A, parent_id: 'nonexistent' });
    const map = buildMap([child]);
    expect(topLevelOfProject(PROJ_A, map)).toHaveLength(0);
  });
});

// ─── rollupProgress ──────────────────────────────────────────────────────────

describe('rollupProgress', () => {
  it('returns { completed: 0, total: 0 } for an item with no children', () => {
    const epic = makeItem('epic', { type: 'epic' });
    const map = buildMap([epic]);
    expect(rollupProgress(epic, map)).toEqual({ completed: 0, total: 0 });
  });

  it('returns correct counts when all children are incomplete', () => {
    const epic = makeItem('epic', { type: 'epic' });
    const f1 = makeItem('f1', { type: 'feature', parent_id: 'epic', status: 'todo' });
    const f2 = makeItem('f2', { type: 'feature', parent_id: 'epic', status: 'todo' });
    const map = buildMap([epic, f1, f2]);
    expect(rollupProgress(epic, map)).toEqual({ completed: 0, total: 2 });
  });

  it('returns correct counts when some children are done', () => {
    const epic = makeItem('epic', { type: 'epic' });
    const f1 = makeItem('f1', { type: 'feature', parent_id: 'epic', status: 'done' });
    const f2 = makeItem('f2', { type: 'feature', parent_id: 'epic', status: 'todo' });
    const f3 = makeItem('f3', { type: 'feature', parent_id: 'epic', status: 'done' });
    const map = buildMap([epic, f1, f2, f3]);
    expect(rollupProgress(epic, map)).toEqual({ completed: 2, total: 3 });
  });

  it('returns { completed: total } when all children are done', () => {
    const feature = makeItem('feat', { type: 'feature' });
    const t1 = makeItem('t1', { type: 'task', parent_id: 'feat', status: 'done' });
    const t2 = makeItem('t2', { type: 'task', parent_id: 'feat', status: 'done' });
    const map = buildMap([feature, t1, t2]);
    expect(rollupProgress(feature, map)).toEqual({ completed: 2, total: 2 });
  });

  it('excludes trashed children from the count', () => {
    const epic = makeItem('epic', { type: 'epic' });
    const f1 = makeItem('f1', { type: 'feature', parent_id: 'epic', status: 'done' });
    const trashedF = makeItem('ft', {
      type: 'feature',
      parent_id: 'epic',
      status: 'todo',
      trashed_at: '2026-01-01T00:00:00Z',
    });
    const map = buildMap([epic, f1, trashedF]);
    expect(rollupProgress(epic, map)).toEqual({ completed: 1, total: 1 });
  });

  it('counts only direct children, not grandchildren', () => {
    const epic = makeItem('epic', { type: 'epic' });
    const feat = makeItem('feat', { type: 'feature', parent_id: 'epic', status: 'todo' });
    const task = makeItem('task', { type: 'task', parent_id: 'feat', status: 'done' });
    const map = buildMap([epic, feat, task]);
    // Only feat is a direct child of epic; task is a grandchild
    expect(rollupProgress(epic, map)).toEqual({ completed: 0, total: 1 });
  });
});
