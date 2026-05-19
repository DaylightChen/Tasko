/**
 * sidebar.test.ts
 *
 * Verifies the sidebar store for the collapsed toggle (Cmd+\ binding).
 * Downstream dependency: HotkeyProvider and sidebar CSS collapsed variant.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { useSidebarStore } from '../../store/sidebar';

describe('useSidebarStore', () => {
  afterEach(() => {
    useSidebarStore.setState({ collapsed: false });
  });

  it('starts with collapsed = false', () => {
    useSidebarStore.setState({ collapsed: false });
    expect(useSidebarStore.getState().collapsed).toBe(false);
  });

  it('toggle() flips collapsed (false → true)', () => {
    useSidebarStore.getState().toggle();
    expect(useSidebarStore.getState().collapsed).toBe(true);
  });

  it('toggle() flips collapsed (true → false)', () => {
    useSidebarStore.setState({ collapsed: true });
    useSidebarStore.getState().toggle();
    expect(useSidebarStore.getState().collapsed).toBe(false);
  });

  it('setCollapsed() sets value directly', () => {
    useSidebarStore.getState().setCollapsed(true);
    expect(useSidebarStore.getState().collapsed).toBe(true);

    useSidebarStore.getState().setCollapsed(false);
    expect(useSidebarStore.getState().collapsed).toBe(false);
  });
});
