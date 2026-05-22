/**
 * Singleton live-region announcer for screen readers.
 * Creates two hidden divs on first call:
 *   - polite:   role="status" aria-live="polite"
 *   - assertive: role="alert" aria-live="assertive"
 *
 * Usage: announce("Task completed. Undo available.") // polite (default)
 *        announce("Cannot drop here.", "assertive")
 */

let politeEl: HTMLElement | null = null;
let assertiveEl: HTMLElement | null = null;

function createRegion(politeness: 'polite' | 'assertive'): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('role', politeness === 'polite' ? 'status' : 'alert');
  el.setAttribute('aria-live', politeness);
  el.setAttribute('aria-atomic', 'true');
  Object.assign(el.style, {
    position: 'absolute',
    left: '-10000px',
    top: 'auto',
    width: '1px',
    height: '1px',
    overflow: 'hidden',
  });
  document.body.appendChild(el);
  return el;
}

function getRegion(politeness: 'polite' | 'assertive'): HTMLElement {
  if (politeness === 'assertive') {
    if (!assertiveEl) assertiveEl = createRegion('assertive');
    return assertiveEl;
  }
  if (!politeEl) politeEl = createRegion('polite');
  return politeEl;
}

/**
 * Announce a message via a live region.
 * @param text - The text to announce.
 * @param politeness - 'polite' (default) or 'assertive'.
 */
export function announce(text: string, politeness: 'polite' | 'assertive' = 'polite'): void {
  if (typeof document === 'undefined') return;
  const el = getRegion(politeness);
  // Clear first, then set after a tick so screen readers reliably fire.
  el.textContent = '';
  setTimeout(() => {
    el.textContent = text;
  }, 50);
}
