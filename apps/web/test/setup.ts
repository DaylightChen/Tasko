import '@testing-library/jest-dom/vitest';

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
