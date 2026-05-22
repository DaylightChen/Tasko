/**
 * keyboard-sensor.test.tsx
 *
 * Tests that the KeyboardSensor included in useDndSensors enables the
 * keyboard drag lifecycle:
 *   - Focus a sortable item, press Space → fires onDragStart
 *   - Press Escape → fires onDragCancel
 *
 * We test at the DndContext callback level, not real pointer simulation,
 * since jsdom doesn't support real DnD via PointerSensor.
 *
 * Coverage note: The KeyboardSensor requires a DOM element to receive the
 * Space keydown event. We render a minimal DndContext with a useSortable item
 * and use fireEvent to simulate keyboard interaction.
 *
 * JSDOM limitation: KeyboardSensor uses getBoundingClientRect to compute
 * drop targets. In jsdom, getBoundingClientRect always returns zeros, so
 * actual "move to target" keyboard navigation isn't testable. We verify:
 * 1. Space keydown on a sortable element triggers DnD activation (onDragStart).
 * 2. Escape during drag triggers onDragCancel.
 */

import type { DragCancelEvent, DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { DndContext } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDndSensors } from '../../lib/dnd-sensors';

// ── Minimal test component with a sortable row ────────────────────────────────

function SortableItem({ id, title }: { id: string; title: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      data-testid={`row-${id}`}
      data-state={isDragging ? 'dragging' : undefined}
      aria-label={title}
      {...attributes}
      {...listeners}
    >
      {title}
    </div>
  );
}

type TestDndListProps = {
  onDragStart?: (e: DragStartEvent) => void;
  onDragEnd?: (e: DragEndEvent) => void;
  onDragCancel?: (e: DragCancelEvent) => void;
};

function TestDndList({ onDragStart, onDragEnd, onDragCancel }: TestDndListProps) {
  const sensors = useDndSensors();
  const items = ['item-1', 'item-2', 'item-3'];

  // Build optional callback props without undefined values (exactOptionalPropertyTypes)
  const optionalCallbacks: Partial<{
    onDragStart: (e: DragStartEvent) => void;
    onDragEnd: (e: DragEndEvent) => void;
    onDragCancel: (e: DragCancelEvent) => void;
  }> = {};
  if (onDragStart) optionalCallbacks.onDragStart = onDragStart;
  if (onDragEnd) optionalCallbacks.onDragEnd = onDragEnd;
  if (onDragCancel) optionalCallbacks.onDragCancel = onDragCancel;

  return (
    <DndContext sensors={sensors} {...optionalCallbacks}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        {items.map((id) => (
          <SortableItem key={id} id={id} title={`Task ${id}`} />
        ))}
      </SortableContext>
    </DndContext>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useDndSensors — KeyboardSensor activates on Space', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires onDragStart when Space is pressed on a sortable element', () => {
    const onDragStart = vi.fn();
    render(<TestDndList onDragStart={onDragStart} />);

    const row = screen.getByTestId('row-item-1');
    // Focus the element first (keyboard sensor requires focus)
    row.focus();
    // Press Space to initiate drag
    fireEvent.keyDown(row, { key: ' ', code: 'Space' });

    expect(onDragStart).toHaveBeenCalledOnce();
    expect(onDragStart).toHaveBeenCalledWith(
      expect.objectContaining({
        active: expect.objectContaining({ id: 'item-1' }),
      }),
    );
  });

  it('fires onDragCancel when Escape is pressed during an active drag', () => {
    const onDragStart = vi.fn();
    const onDragCancel = vi.fn();
    render(<TestDndList onDragStart={onDragStart} onDragCancel={onDragCancel} />);

    const row = screen.getByTestId('row-item-1');
    row.focus();
    // Initiate drag — Space triggers activate
    fireEvent.keyDown(row, { key: ' ', code: 'Space' });
    expect(onDragStart).toHaveBeenCalledOnce();

    // The KeyboardSensor registers its active keydown handler via setTimeout(fn).
    // Flush timers so the Escape/Enter handlers are registered on document.
    act(() => {
      vi.runAllTimers();
    });

    // Cancel drag with Escape (dispatched on document, which is where the
    // active keyboard handler listens)
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    expect(onDragCancel).toHaveBeenCalledOnce();
  });

  it('fires onDragEnd with Enter key after drag is initiated', () => {
    const onDragEnd = vi.fn();
    render(<TestDndList onDragEnd={onDragEnd} />);

    const row = screen.getByTestId('row-item-2');
    row.focus();
    // Initiate drag
    fireEvent.keyDown(row, { key: ' ', code: 'Space' });

    // Flush the setTimeout so the active key handlers register
    act(() => {
      vi.runAllTimers();
    });

    // Commit drop with Enter (on document)
    fireEvent.keyDown(document, { key: 'Enter', code: 'Enter' });

    expect(onDragEnd).toHaveBeenCalledOnce();
  });
});
