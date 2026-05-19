/**
 * Tests for the theme store (useThemeStore).
 * Covers: setPreference, resolved theme computation, document.documentElement.dataset.theme mutation,
 * setResolvedFromMedia for system preference.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useThemeStore } from './theme';

describe('useThemeStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useThemeStore.setState({ preference: 'system', resolved: 'light' });
    // Reset document theme attribute
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has correct initial state', () => {
    const state = useThemeStore.getState();
    expect(state.preference).toBe('system');
    expect(state.resolved).toBe('light');
  });

  it('setPreference("light") sets preference and resolved to light, updates dataset.theme', () => {
    useThemeStore.getState().setPreference('light');
    const state = useThemeStore.getState();
    expect(state.preference).toBe('light');
    expect(state.resolved).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('setPreference("dark") sets preference and resolved to dark, updates dataset.theme', () => {
    useThemeStore.getState().setPreference('dark');
    const state = useThemeStore.getState();
    expect(state.preference).toBe('dark');
    expect(state.resolved).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('setPreference("system") resolves to light when matchMedia does not match dark', () => {
    // The setup.ts stub returns matches: false — so system resolves to light
    useThemeStore.getState().setPreference('system');
    const state = useThemeStore.getState();
    expect(state.preference).toBe('system');
    expect(state.resolved).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('setPreference("system") resolves to dark when matchMedia reports prefers dark', () => {
    // Override matchMedia to simulate OS dark mode
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList);

    useThemeStore.getState().setPreference('system');
    const state = useThemeStore.getState();
    expect(state.preference).toBe('system');
    expect(state.resolved).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('setResolvedFromMedia(true) sets resolved to dark and updates dataset.theme', () => {
    useThemeStore.getState().setResolvedFromMedia(true);
    const state = useThemeStore.getState();
    expect(state.resolved).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('setResolvedFromMedia(false) sets resolved to light and updates dataset.theme', () => {
    useThemeStore.setState({ resolved: 'dark' });
    useThemeStore.getState().setResolvedFromMedia(false);
    const state = useThemeStore.getState();
    expect(state.resolved).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('setPreference does not throw if called multiple times', () => {
    expect(() => {
      useThemeStore.getState().setPreference('dark');
      useThemeStore.getState().setPreference('light');
      useThemeStore.getState().setPreference('system');
    }).not.toThrow();
  });
});
