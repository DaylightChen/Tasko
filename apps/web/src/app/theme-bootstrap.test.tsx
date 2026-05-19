/**
 * Tests for ThemeBootstrap.
 * Covers:
 * - Sets document.documentElement.dataset.theme = 'dark' when useConfig returns theme: 'dark'
 * - Sets dataset.theme = 'light' when config returns theme: 'light'
 * - Subscribes to matchMedia change when preference is 'system'
 * - Does not crash when config is loading (data is undefined)
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/config', () => ({
  useConfig: vi.fn(),
}));

import { useConfig } from '../api/config';
import { useThemeStore } from '../store/theme';
import { ThemeBootstrap } from './theme-bootstrap';

function renderBootstrap(children?: React.ReactNode) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeBootstrap>{children ?? <div>content</div>}</ThemeBootstrap>
    </QueryClientProvider>,
  );
}

describe('ThemeBootstrap', () => {
  beforeEach(() => {
    // Reset theme store and DOM attribute
    useThemeStore.setState({ preference: 'system', resolved: 'light' });
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('applies dataset.theme = "dark" when config.theme is "dark"', async () => {
    vi.mocked(useConfig).mockReturnValue({
      data: {
        schema_version: 1,
        theme: 'dark',
        week_start: 'mon',
        last_modified: new Date().toISOString(),
      },
    } as ReturnType<typeof useConfig>);

    renderBootstrap();

    // The effect runs after render; wait for it
    await vi.waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('dark');
    });
  });

  it('applies dataset.theme = "light" when config.theme is "light"', async () => {
    vi.mocked(useConfig).mockReturnValue({
      data: {
        schema_version: 1,
        theme: 'light',
        week_start: 'mon',
        last_modified: new Date().toISOString(),
      },
    } as ReturnType<typeof useConfig>);

    renderBootstrap();

    await vi.waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('light');
    });
  });

  it('does not crash when config data is undefined (still loading)', () => {
    vi.mocked(useConfig).mockReturnValue({ data: undefined } as ReturnType<typeof useConfig>);
    expect(() => renderBootstrap()).not.toThrow();
  });

  it('renders children', () => {
    vi.mocked(useConfig).mockReturnValue({ data: undefined } as ReturnType<typeof useConfig>);
    const { getByText } = renderBootstrap(<span>Hello world</span>);
    expect(getByText('Hello world')).toBeTruthy();
  });

  it('subscribes to matchMedia change when preference is "system"', async () => {
    vi.mocked(useConfig).mockReturnValue({
      data: {
        schema_version: 1,
        theme: 'system',
        week_start: 'mon',
        last_modified: new Date().toISOString(),
      },
    } as ReturnType<typeof useConfig>);

    const addEventListenerMock = vi.fn();
    const removeEventListenerMock = vi.fn();

    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false,
      addEventListener: addEventListenerMock,
      removeEventListener: removeEventListenerMock,
    } as unknown as MediaQueryList);

    const { unmount } = renderBootstrap();

    await vi.waitFor(() => {
      expect(addEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function));
    });

    unmount();
    expect(removeEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
