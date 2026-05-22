/**
 * Tests for the SettingsView component.
 * Covers:
 * - Renders <h1>Settings</h1>
 * - APPEARANCE, WEEK, ABOUT section headers present
 * - Theme radio group with Light / Dark / System options
 * - Week-start radio group with Sunday / Monday options
 * - Clicking Dark radio calls useUpdateConfig.mutate({ theme: 'dark' })
 * - Clicking Sunday radio calls useUpdateConfig.mutate({ week_start: 'sun' })
 * - "View keyboard shortcuts" button is rendered
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/config', () => ({
  useConfig: vi.fn(),
  useUpdateConfig: vi.fn(),
}));

import { useConfig, useUpdateConfig } from '../../api/config';
import { SettingsView } from './index';

const mutateMock = vi.fn();

function setupMocks(theme = 'system', weekStart = 'mon') {
  vi.mocked(useConfig).mockReturnValue({
    data: {
      schema_version: 1,
      theme,
      week_start: weekStart,
      last_modified: new Date().toISOString(),
    },
  } as ReturnType<typeof useConfig>);

  vi.mocked(useUpdateConfig).mockReturnValue({
    mutate: mutateMock,
    isPending: false,
  } as unknown as ReturnType<typeof useUpdateConfig>);
}

function renderSettings() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsView />
    </QueryClientProvider>,
  );
}

describe('SettingsView', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders <h1>Settings</h1>', () => {
    setupMocks();
    renderSettings();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toBe('Settings');
  });

  it('renders APPEARANCE section header', () => {
    setupMocks();
    renderSettings();
    // Could be h2 or generic heading
    const headings = screen.getAllByRole('heading');
    const appearance = headings.find((h) => h.textContent?.includes('APPEARANCE'));
    expect(appearance).toBeTruthy();
  });

  it('renders WEEK section header', () => {
    setupMocks();
    renderSettings();
    const headings = screen.getAllByRole('heading');
    const week = headings.find((h) => h.textContent?.includes('WEEK'));
    expect(week).toBeTruthy();
  });

  it('renders ABOUT section header', () => {
    setupMocks();
    renderSettings();
    const headings = screen.getAllByRole('heading');
    const about = headings.find((h) => h.textContent?.includes('ABOUT'));
    expect(about).toBeTruthy();
  });

  it('renders Light, Dark, System radio buttons', () => {
    setupMocks();
    renderSettings();
    expect(screen.getByRole('radio', { name: /Light/ })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Dark/ })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /System/ })).toBeTruthy();
  });

  it('renders Sunday and Monday radio buttons for week-start', () => {
    setupMocks();
    renderSettings();
    expect(screen.getByRole('radio', { name: /Sunday/ })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Monday/ })).toBeTruthy();
  });

  it('System radio is checked by default when config.theme is system', () => {
    setupMocks('system');
    renderSettings();
    const systemRadio = screen.getByRole('radio', { name: /System/ }) as HTMLInputElement;
    expect(systemRadio.checked).toBe(true);
  });

  it('Dark radio is checked when config.theme is dark', () => {
    setupMocks('dark');
    renderSettings();
    const darkRadio = screen.getByRole('radio', { name: /^Dark$/ }) as HTMLInputElement;
    expect(darkRadio.checked).toBe(true);
  });

  it('clicking Dark radio calls useUpdateConfig.mutate with { theme: "dark" }', () => {
    setupMocks('system');
    renderSettings();

    const darkRadio = screen.getByRole('radio', { name: /^Dark$/ });
    fireEvent.click(darkRadio);

    expect(mutateMock).toHaveBeenCalledOnce();
    expect(mutateMock).toHaveBeenCalledWith({ theme: 'dark' });
  });

  it('clicking Light radio calls useUpdateConfig.mutate with { theme: "light" }', () => {
    setupMocks('dark');
    renderSettings();

    const lightRadio = screen.getByRole('radio', { name: /^Light$/ });
    fireEvent.click(lightRadio);

    expect(mutateMock).toHaveBeenCalledOnce();
    expect(mutateMock).toHaveBeenCalledWith({ theme: 'light' });
  });

  it('clicking Sunday radio calls useUpdateConfig.mutate with { week_start: "sun" }', () => {
    setupMocks('system', 'mon');
    renderSettings();

    const sundayRadio = screen.getByRole('radio', { name: /^Sunday$/ });
    fireEvent.click(sundayRadio);

    expect(mutateMock).toHaveBeenCalledOnce();
    expect(mutateMock).toHaveBeenCalledWith({ week_start: 'sun' });
  });

  it('renders "View keyboard shortcuts" button', () => {
    setupMocks();
    renderSettings();
    expect(screen.getByText('View keyboard shortcuts')).toBeTruthy();
  });

  it('renders "Tasko v0.1 · Local-first" about text', () => {
    setupMocks();
    renderSettings();
    expect(screen.getByText('Tasko v0.1 · Local-first')).toBeTruthy();
  });
});
