import type { ItemId } from '@tasko/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LS_KEY, useSubtaskExpansionStore } from './subtask-expansion';

const TASK_A = '01ARZ3NDEKTSV4RRFFQ69G5FAA' as ItemId;
const TASK_B = '01ARZ3NDEKTSV4RRFFQ69G5FBB' as ItemId;

describe('useSubtaskExpansionStore', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset store between tests
    useSubtaskExpansionStore.setState({ expanded: {} });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('defaults to collapsed (isExpanded false for unknown task)', () => {
    expect(useSubtaskExpansionStore.getState().isExpanded(TASK_A)).toBe(false);
  });

  it('toggle flips state', () => {
    useSubtaskExpansionStore.getState().toggle(TASK_A);
    expect(useSubtaskExpansionStore.getState().isExpanded(TASK_A)).toBe(true);
    useSubtaskExpansionStore.getState().toggle(TASK_A);
    expect(useSubtaskExpansionStore.getState().isExpanded(TASK_A)).toBe(false);
  });

  it('expansion of one task does not affect another', () => {
    useSubtaskExpansionStore.getState().toggle(TASK_A);
    expect(useSubtaskExpansionStore.getState().isExpanded(TASK_A)).toBe(true);
    expect(useSubtaskExpansionStore.getState().isExpanded(TASK_B)).toBe(false);
  });

  it('persists expanded set to localStorage', () => {
    useSubtaskExpansionStore.getState().toggle(TASK_A);
    const raw = localStorage.getItem(LS_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw ?? '{}') as { state: { expanded: Record<string, boolean> } };
    expect(parsed.state.expanded[TASK_A]).toBe(true);
  });

  it('collapsing removes the key (keeps storage tidy)', () => {
    useSubtaskExpansionStore.getState().toggle(TASK_A);
    useSubtaskExpansionStore.getState().toggle(TASK_A);
    const raw = localStorage.getItem(LS_KEY);
    const parsed = JSON.parse(raw ?? '{}') as { state: { expanded: Record<string, boolean> } };
    // Collapsed is the default, so we don't keep a `false` entry around.
    expect(parsed.state.expanded[TASK_A]).toBeUndefined();
  });
});
