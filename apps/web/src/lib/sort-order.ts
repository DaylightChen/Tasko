/**
 * Sort-order math for sparse-integer drag reordering.
 *
 * Given two adjacent siblings A and B (where A < B), the new item's sort_order
 * is floor((A + B) / 2). If |A - B| < 2, callers should renumber the full list
 * using `renumberList`.
 */

/**
 * Compute the sort_order value for an item placed between A and B.
 * Returns null if the gap is too small (< 2); caller must renumber.
 */
export function sortOrderBetween(a: number, b: number): number | null {
  if (Math.abs(a - b) < 2) return null;
  return Math.floor((a + b) / 2);
}

/**
 * Produce a new sort_order array for an entire list with 1024-step spacing.
 * The returned array has the same length as `count`.
 */
export function renumberList(count: number): number[] {
  return Array.from({ length: count }, (_, i) => (i + 1) * 1024);
}

/**
 * Compute the new sort_order for an item being moved to position `newIndex`
 * in the given sorted array of sort_orders (sorted ascending).
 *
 * `sortedOrders` should not include the item being moved.
 * Returns the new sort_order (a number) plus a flag indicating whether a full
 * renumber is needed (in which case `renumberList` should be called on the
 * whole array).
 */
export function computeNewSortOrder(
  sortedOrders: number[],
  newIndex: number,
): { value: number; needsRenumber: boolean } {
  const n = sortedOrders.length;

  if (n === 0) {
    return { value: 1024, needsRenumber: false };
  }

  if (newIndex <= 0) {
    // Place before the first element
    const first = sortedOrders[0] ?? 1024;
    const value = Math.floor(first / 2);
    return { value, needsRenumber: first < 2 };
  }

  if (newIndex >= n) {
    // Place after the last element
    const last = sortedOrders[n - 1] ?? 0;
    return { value: last + 1024, needsRenumber: false };
  }

  const a = sortedOrders[newIndex - 1] ?? 0;
  const b = sortedOrders[newIndex] ?? a + 2048;
  const result = sortOrderBetween(a, b);
  if (result === null) {
    return { value: Math.floor((a + b) / 2), needsRenumber: true };
  }
  return { value: result, needsRenumber: false };
}
