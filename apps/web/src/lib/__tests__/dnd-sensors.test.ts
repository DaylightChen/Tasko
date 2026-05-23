/**
 * Regression: a click on a task row must never start a drag.
 *
 * The original config (`PointerSensor` with `delay: 100ms, tolerance: 5px`)
 * activated a drag whenever a click was held just past 100ms with any cursor
 * jitter — so opening the task modal frequently flashed `data-state=
 * "drag-source-placeholder"` and occasionally reordered tasks.
 *
 * The fix splits mouse and touch:
 *   - Mouse: `distance: 8` — drag only activates after intentional movement,
 *     so any click without movement is never a drag.
 *   - Touch: `delay: 250, tolerance: 5` — preserves page scrolling on swipe,
 *     requires a hold-to-drag to disambiguate from a tap.
 *
 * Both invariants must hold so the user-reported "easy to trigger drag when
 * clicking" bug stays fixed across mouse and touch surfaces.
 */
import { KeyboardSensor, MouseSensor, TouchSensor } from '@dnd-kit/core';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useDndSensors } from '../dnd-sensors';

describe('useDndSensors', () => {
  const sensors = renderHook(() => useDndSensors()).result.current;

  // dnd-kit's `SensorOptions` is a structural base; concrete sensors define
  // their own option shapes. We coerce via `unknown` here to assert on
  // activationConstraint without leaking sensor-internal types into the test.
  const findSensor = (cls: unknown) => sensors.find((s) => s.sensor === cls);
  const getConstraint = (descriptor: ReturnType<typeof findSensor>) =>
    (
      descriptor?.options as unknown as
        | { activationConstraint?: { distance?: number; delay?: number; tolerance?: number } }
        | undefined
    )?.activationConstraint;

  it('configures a MouseSensor with distance-based activation (no delay-based activation on click)', () => {
    const mouse = findSensor(MouseSensor);
    expect(mouse).toBeDefined();
    const constraint = getConstraint(mouse);
    expect(constraint).toBeDefined();
    expect(constraint?.distance).toBe(8);
    expect(constraint?.delay).toBeUndefined();
  });

  it('configures a TouchSensor with a hold-to-drag activation (preserves scroll)', () => {
    const touch = findSensor(TouchSensor);
    expect(touch).toBeDefined();
    const constraint = getConstraint(touch);
    expect(constraint).toBeDefined();
    expect(constraint?.delay ?? 0).toBeGreaterThanOrEqual(200);
    expect(constraint?.tolerance ?? 0).toBeGreaterThanOrEqual(5);
  });

  it('keeps a KeyboardSensor so Space/Enter still drives drag for keyboard users', () => {
    expect(findSensor(KeyboardSensor)).toBeDefined();
  });
});
