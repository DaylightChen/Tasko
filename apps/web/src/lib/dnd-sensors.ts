/**
 * Shared dnd-kit sensors used across all drag surfaces.
 *
 * Mouse uses `distance` activation so clicks never start a drag — the pointer
 * must travel ≥8px before drag mode engages. Touch uses `delay + tolerance`
 * so taps stay clean and the page can still scroll on a swipe-style gesture.
 */
import { KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

export function useDndSensors() {
  return useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
}
