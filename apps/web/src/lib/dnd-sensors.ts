/**
 * Shared dnd-kit sensors used across all drag surfaces.
 * PointerSensor with 100ms/5px activation + KeyboardSensor.
 */
import { KeyboardSensor, PointerSensor, useSensors } from '@dnd-kit/core';
import { useSensor } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

export function useDndSensors() {
  return useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 100, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
}
