/**
 * Unit tests for lib/drag-auto-scroll.ts
 *
 * Tests the edge-proximity scroll logic in isolation.
 * Verifies that updateAutoScroll calls scrollBy with the expected direction
 * and velocity when the pointer is within the proximity threshold.
 *
 * Strategy: Replace requestAnimationFrame with a synchronous stub that
 * collects callbacks, then explicitly invoke one frame at a time. We stop
 * after one frame to avoid the infinite rAF loop inside tick().
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stopAutoScroll, updateAutoScroll } from '../../lib/drag-auto-scroll';

// ─── rAF stub that collects callbacks without infinite looping ────────────────

let pendingCallbacks: FrameRequestCallback[] = [];
let frameId = 0;

function flushOneFrame() {
  // Take only the first callback to avoid running the rAF loop
  const cbs = pendingCallbacks.splice(0, 1);
  for (const cb of cbs) cb(performance.now());
}

// ─── Container helpers ────────────────────────────────────────────────────────

function makeContainer(rect: { top: number; bottom: number }): HTMLElement {
  const el = document.createElement('div');
  el.getBoundingClientRect = () =>
    ({
      top: rect.top,
      bottom: rect.bottom,
      left: 0,
      right: 100,
      width: 100,
      height: rect.bottom - rect.top,
      x: 0,
      y: rect.top,
      toJSON: () => {},
    }) as DOMRect;
  el.scrollBy = vi.fn();
  return el;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('drag-auto-scroll — updateAutoScroll velocity logic', () => {
  const originalRaf = globalThis.requestAnimationFrame;
  const originalCaf = globalThis.cancelAnimationFrame;

  beforeEach(() => {
    pendingCallbacks = [];
    frameId = 0;
    // Replace rAF with a collecting stub
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
      frameId++;
      pendingCallbacks.push(cb);
      return frameId;
    };
    globalThis.cancelAnimationFrame = vi.fn((_id: number) => {
      // noop — just prevent real cancellation
    });
  });

  afterEach(() => {
    stopAutoScroll();
    pendingCallbacks = [];
    globalThis.requestAnimationFrame = originalRaf;
    globalThis.cancelAnimationFrame = originalCaf;
    vi.clearAllMocks();
  });

  it('calls scrollBy with a negative velocity (scroll up) when pointer is 20px from the top', () => {
    const container = makeContainer({ top: 0, bottom: 600 });
    // clientY=20 → distFromTop=20 → 15<20≤30 → medium velocity=10 → scrollBy({top:-10})
    updateAutoScroll(container as HTMLElement, 20);
    expect(pendingCallbacks.length).toBeGreaterThan(0);
    flushOneFrame();
    expect(container.scrollBy).toHaveBeenCalledWith({ top: -10, behavior: 'instant' });
  });

  it('calls scrollBy with a positive velocity (scroll down) when pointer is 20px from the bottom', () => {
    const container = makeContainer({ top: 0, bottom: 600 });
    // clientY=580 → distFromBottom=600-580=20 → medium velocity=10 → scrollBy({top:+10})
    updateAutoScroll(container as HTMLElement, 580);
    flushOneFrame();
    expect(container.scrollBy).toHaveBeenCalledWith({ top: 10, behavior: 'instant' });
  });

  it('uses fast velocity (20px/frame) when pointer is within 15px of the edge', () => {
    const container = makeContainer({ top: 0, bottom: 600 });
    // clientY=5 → distFromTop=5 → ≤15px → fast velocity=20
    updateAutoScroll(container as HTMLElement, 5);
    flushOneFrame();
    expect(container.scrollBy).toHaveBeenCalledWith({ top: -20, behavior: 'instant' });
  });

  it('uses slow velocity (4px/frame) when pointer is between 30px and 40px from edge', () => {
    const container = makeContainer({ top: 0, bottom: 600 });
    // clientY=35 → distFromTop=35 → 30<35≤40 → slow velocity=4
    updateAutoScroll(container as HTMLElement, 35);
    flushOneFrame();
    expect(container.scrollBy).toHaveBeenCalledWith({ top: -4, behavior: 'instant' });
  });

  it('does NOT schedule a rAF callback when pointer is outside the 40px proximity zone', () => {
    const container = makeContainer({ top: 0, bottom: 600 });
    // clientY=300 → far from both edges → no rAF scheduled
    updateAutoScroll(container as HTMLElement, 300);
    expect(pendingCallbacks.length).toBe(0);
  });

  it('stopAutoScroll calls cancelAnimationFrame to cancel the pending rAF', () => {
    const container = makeContainer({ top: 0, bottom: 600 });
    updateAutoScroll(container as HTMLElement, 20);
    expect(pendingCallbacks.length).toBeGreaterThan(0);
    stopAutoScroll();
    // cancelAnimationFrame should have been called to cancel the pending frame
    expect(globalThis.cancelAnimationFrame).toHaveBeenCalled();
    // After stopAutoScroll, calling flushOneFrame should NOT call scrollBy
    // (the tick function checks scrollVelocity which is reset to 0 by stopAutoScroll)
    flushOneFrame();
    expect(container.scrollBy).not.toHaveBeenCalled();
  });

  it('uses medium velocity (10px/frame) when pointer is between 15px and 30px from edge', () => {
    const container = makeContainer({ top: 0, bottom: 600 });
    // clientY=25 → distFromTop=25 → 15<25≤30 → velocity=10
    updateAutoScroll(container as HTMLElement, 25);
    flushOneFrame();
    expect(container.scrollBy).toHaveBeenCalledWith({ top: -10, behavior: 'instant' });
  });
});
