/**
 * Tests for the command palette store.
 * Covers: initial state, openPalette, closePalette toggle behavior.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { useCommandPaletteStore } from './command-palette';

describe('useCommandPaletteStore', () => {
  afterEach(() => {
    // Reset to closed state after each test
    useCommandPaletteStore.setState({ open: false });
  });

  it('starts closed', () => {
    expect(useCommandPaletteStore.getState().open).toBe(false);
  });

  it('openPalette sets open to true', () => {
    useCommandPaletteStore.getState().openPalette();
    expect(useCommandPaletteStore.getState().open).toBe(true);
  });

  it('closePalette sets open to false', () => {
    useCommandPaletteStore.setState({ open: true });
    useCommandPaletteStore.getState().closePalette();
    expect(useCommandPaletteStore.getState().open).toBe(false);
  });

  it('openPalette then closePalette toggles back to false', () => {
    useCommandPaletteStore.getState().openPalette();
    expect(useCommandPaletteStore.getState().open).toBe(true);
    useCommandPaletteStore.getState().closePalette();
    expect(useCommandPaletteStore.getState().open).toBe(false);
  });

  it('calling openPalette twice stays open', () => {
    useCommandPaletteStore.getState().openPalette();
    useCommandPaletteStore.getState().openPalette();
    expect(useCommandPaletteStore.getState().open).toBe(true);
  });

  it('calling closePalette when already closed stays false', () => {
    useCommandPaletteStore.getState().closePalette();
    expect(useCommandPaletteStore.getState().open).toBe(false);
  });
});
