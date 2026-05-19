/**
 * global-shortcuts.test.tsx
 *
 * Verifies GlobalShortcuts component:
 * - 't' from no-input mode (no focused row) navigates to /today
 * - 'i' navigates to /inbox
 * - 'n' calls focus() on the registered quick-add ref
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../api/items', () => ({
  usePatchItem: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false })),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { GlobalShortcuts } from '../../app/global-shortcuts';
import { useFocusedRowStore } from '../../store/focused-row';
import { useHotkeyStore } from '../../store/hotkey-registry';
import { useQuickAddRefStore } from '../../store/quick-add-ref';

// ── Helpers ───────────────────────────────────────────────────────────────────

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function fireKey(key: string, extras: Partial<KeyboardEventInit> = {}) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...extras }));
}

describe('GlobalShortcuts', () => {
  beforeEach(() => {
    useHotkeyStore.getState().reset();
    useFocusedRowStore.getState().clear();
    useQuickAddRefStore.setState({ ref: null });
    mockNavigate.mockReset();
  });

  afterEach(() => {
    useHotkeyStore.getState().reset();
    useFocusedRowStore.getState().clear();
    useQuickAddRefStore.setState({ ref: null });
  });

  it('t navigates to /today when no row is focused', () => {
    render(
      <Wrapper>
        <GlobalShortcuts />
      </Wrapper>,
    );

    act(() => {
      fireKey('t');
    });

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/today' });
  });

  it('i navigates to /inbox', () => {
    render(
      <Wrapper>
        <GlobalShortcuts />
      </Wrapper>,
    );

    act(() => {
      fireKey('i');
    });

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/inbox' });
  });

  it('n focuses the quick-add input', () => {
    const fakeInput = { focus: vi.fn() } as unknown as HTMLInputElement;
    useQuickAddRefStore.setState({ ref: fakeInput });

    render(
      <Wrapper>
        <GlobalShortcuts />
      </Wrapper>,
    );

    act(() => {
      fireKey('n');
    });

    expect(fakeInput.focus).toHaveBeenCalled();
  });

  it('/ focuses the quick-add input', () => {
    const fakeInput = { focus: vi.fn() } as unknown as HTMLInputElement;
    useQuickAddRefStore.setState({ ref: fakeInput });

    render(
      <Wrapper>
        <GlobalShortcuts />
      </Wrapper>,
    );

    act(() => {
      fireKey('/');
    });

    expect(fakeInput.focus).toHaveBeenCalled();
  });

  it('t does NOT navigate when a row is focused (schedules to today instead)', () => {
    useFocusedRowStore.getState().setFocusedId('row-123');

    render(
      <Wrapper>
        <GlobalShortcuts />
      </Wrapper>,
    );

    act(() => {
      fireKey('t');
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('t does nothing (no navigate, no crash) when in input mode', () => {
    act(() => {
      useHotkeyStore.getState().push('input');
    });

    render(
      <Wrapper>
        <GlobalShortcuts />
      </Wrapper>,
    );

    act(() => {
      fireKey('t');
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
