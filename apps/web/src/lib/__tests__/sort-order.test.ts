/**
 * Unit tests for lib/sort-order.ts
 *
 * Covers:
 * - sortOrderBetween: midpoint math; gap-<2 returns null
 * - renumberList: correct 1024-step spacing
 * - computeNewSortOrder: head, tail, and middle insertion; needsRenumber flag
 */

import { describe, expect, it } from 'vitest';
import { computeNewSortOrder, renumberList, sortOrderBetween } from '../sort-order';

describe('sortOrderBetween', () => {
  it('returns the floor midpoint between two values', () => {
    expect(sortOrderBetween(1000, 3000)).toBe(2000);
  });

  it('returns floor when midpoint is not an integer', () => {
    expect(sortOrderBetween(1024, 1027)).toBe(1025);
  });

  it('returns null when gap is exactly 1 (less than 2)', () => {
    expect(sortOrderBetween(1024, 1025)).toBeNull();
  });

  it('returns null when gap is 0 (same value)', () => {
    expect(sortOrderBetween(1024, 1024)).toBeNull();
  });

  it('returns a value when gap is exactly 2', () => {
    expect(sortOrderBetween(1024, 1026)).toBe(1025);
  });
});

describe('renumberList', () => {
  it('produces 1024-step spacing starting at 1024', () => {
    expect(renumberList(3)).toEqual([1024, 2048, 3072]);
  });

  it('handles count of 1', () => {
    expect(renumberList(1)).toEqual([1024]);
  });

  it('returns empty array for count 0', () => {
    expect(renumberList(0)).toEqual([]);
  });

  it('produces correct length', () => {
    expect(renumberList(5)).toHaveLength(5);
  });
});

describe('computeNewSortOrder', () => {
  it('returns 1024 for an empty list', () => {
    const { value, needsRenumber } = computeNewSortOrder([], 0);
    expect(value).toBe(1024);
    expect(needsRenumber).toBe(false);
  });

  it('places item before first element (newIndex=0)', () => {
    const { value, needsRenumber } = computeNewSortOrder([2048, 4096], 0);
    expect(value).toBe(1024); // floor(2048/2)
    expect(needsRenumber).toBe(false);
  });

  it('places item after last element (newIndex >= n)', () => {
    const { value, needsRenumber } = computeNewSortOrder([1024, 2048], 2);
    expect(value).toBe(3072); // last + 1024
    expect(needsRenumber).toBe(false);
  });

  it('computes midpoint for middle insertion', () => {
    // Between 1024 and 3072 → midpoint = floor((1024+3072)/2) = 2048
    const { value, needsRenumber } = computeNewSortOrder([1024, 3072], 1);
    expect(value).toBe(2048);
    expect(needsRenumber).toBe(false);
  });

  it('sets needsRenumber=true when the gap between adjacent items is < 2', () => {
    // Two items only 1 apart: gap < 2 → needs renumber
    const { needsRenumber } = computeNewSortOrder([1024, 1025], 1);
    expect(needsRenumber).toBe(true);
  });

  it('needsRenumber path: value is still the approximate midpoint', () => {
    // Even when renumber needed, value must be close to the midpoint
    const { value } = computeNewSortOrder([100, 101], 1);
    // floor((100+101)/2) = 100
    expect(value).toBe(100);
  });
});
