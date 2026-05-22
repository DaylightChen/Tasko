/**
 * Guard a dnd-kit keydown listener so it only fires when the keypress
 * originated on the draggable element itself, not on a text-entry descendant.
 *
 * Why: dnd-kit's KeyboardSensor activates a drag on Space/Enter when the
 * activator element receives the event. But the `listeners` spread also
 * attaches `onKeyDown` to the draggable wrapper, so any Enter that bubbles
 * up from an inline-edit <input> inside the row activates a phantom keyboard
 * drag — with no follow-up keystroke to end it, `isDragging` is stuck true
 * and the row renders as the drag-placeholder ghost (no checkbox/priority/
 * date chips, just the title text).
 */
import type React from 'react';

export function guardDndKeyDown<E extends Element>(
  dndKeyDown: React.KeyboardEventHandler<E> | undefined,
): React.KeyboardEventHandler<E> {
  return (e) => {
    const target = e.target as Element | null;
    const isInsideTextEntry =
      target?.tagName === 'INPUT' ||
      target?.tagName === 'TEXTAREA' ||
      (target as HTMLElement | null)?.isContentEditable === true;
    if (isInsideTextEntry) return;
    dndKeyDown?.(e);
  };
}
