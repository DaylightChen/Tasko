/**
 * drag-auto-scroll — edge-proximity auto-scroll during DnD.
 *
 * Call `startAutoScroll(container, clientY)` on each onDragMove event.
 * Call `stopAutoScroll()` on onDragEnd / onDragCancel.
 *
 * Thresholds (per interaction-patterns.md §1.5):
 *   40-30px → slow   (velocity: 4px/frame)
 *   30-15px → medium (velocity: 10px/frame)
 *   15-0px  → fast   (velocity: 20px/frame)
 */

let rafId: number | null = null;
let scrollContainer: HTMLElement | null = null;
let scrollVelocity = 0;

function getVelocity(distance: number): number {
  if (distance <= 0) return 0;
  if (distance <= 15) return 20;
  if (distance <= 30) return 10;
  if (distance <= 40) return 4;
  return 0;
}

function tick() {
  if (scrollContainer && scrollVelocity !== 0) {
    scrollContainer.scrollBy({ top: scrollVelocity, behavior: 'instant' });
  }
  rafId = requestAnimationFrame(tick);
}

/**
 * Update the scroll intent based on current pointer position.
 * `clientY` is the pointer's viewport Y coordinate.
 */
export function updateAutoScroll(container: HTMLElement, clientY: number): void {
  const rect = container.getBoundingClientRect();
  const distFromTop = clientY - rect.top;
  const distFromBottom = rect.bottom - clientY;

  let velocity = 0;

  if (distFromTop < 40 && distFromTop >= 0) {
    velocity = -getVelocity(distFromTop);
  } else if (distFromBottom < 40 && distFromBottom >= 0) {
    velocity = getVelocity(distFromBottom);
  }

  scrollContainer = container;
  scrollVelocity = velocity;

  if (velocity !== 0 && rafId === null) {
    rafId = requestAnimationFrame(tick);
  } else if (velocity === 0 && rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

/**
 * Stop all auto-scroll activity. Call on dragEnd / dragCancel.
 */
export function stopAutoScroll(): void {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  scrollContainer = null;
  scrollVelocity = 0;
}
