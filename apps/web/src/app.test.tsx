import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('App', () => {
  it('renders "Tasko service: OK" when /api/health responds ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true } as Response));

    render(<App />);

    const status = await screen.findByText('Tasko service: OK');
    expect(status).toBeTruthy();
  });

  it('renders error state when /api/health fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Network error')));

    render(<App />);

    const status = await screen.findByText('Tasko service: not running. Start the server and refresh.');
    expect(status).toBeTruthy();
  });
});
