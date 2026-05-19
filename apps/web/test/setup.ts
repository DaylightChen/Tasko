import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

// cmdk@1.1.1 instantiates ResizeObserver in a React effect; jsdom doesn't provide it.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// cmdk@1.1.1 calls scrollIntoView on list items; jsdom doesn't implement it.
if (typeof Element.prototype.scrollIntoView === 'undefined') {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom does not implement window.matchMedia; provide a minimal stub so
// tests that indirectly call it (theme store, ThemeBootstrap) don't crash.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  });
}

// These stubs are specifically required by @tanstack/react-virtual: the virtualizer
// reads offsetHeight/offsetWidth and getBoundingClientRect on the scroll container to
// determine how many rows to render. jsdom returns 0 for all layout dimensions, so
// the virtualizer would conclude the visible area is 0 px and render no rows at all.
// Stubbing to 600×800 makes all virtualized views render their row windows in tests.
//
// If a future test needs getBoundingClientRect to return 0 or specific per-element
// dimensions, override it on that element instance directly (not on the prototype).
// See apps/web/src/views/__tests__/auto-scroll.test.ts for the per-element pattern.
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
  configurable: true,
  get() {
    return 600;
  },
});
Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
  configurable: true,
  get() {
    return 800;
  },
});
HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
  return {
    width: 800,
    height: 600,
    top: 0,
    left: 0,
    right: 800,
    bottom: 600,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;
};
