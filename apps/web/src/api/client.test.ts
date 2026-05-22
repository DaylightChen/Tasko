/**
 * Tests for the typed apiCall<TOut> wrapper and ApiError class.
 * Covers: X-Tasko-Tab-Id header, 2xx parsing, non-2xx ApiError, schema parse failure.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError, apiCall, getTabId } from './client';

// Helpers
function makeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('getTabId()', () => {
  it('returns a non-empty string', () => {
    const id = getTabId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('returns the same value on repeated calls (cached)', () => {
    const a = getTabId();
    const b = getTabId();
    expect(a).toBe(b);
  });
});

describe('apiCall<TOut>', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const SimpleSchema = z.object({ value: z.string() });

  it('sends X-Tasko-Tab-Id header on every request', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(200, { value: 'hello' }));

    await apiCall('GET', '/api/test', undefined, SimpleSchema);

    const call = fetchMock.mock.calls[0] as [string, RequestInit] | undefined;
    const headers = (call?.[1].headers ?? {}) as Record<string, string>;
    expect(headers['X-Tasko-Tab-Id']).toBeDefined();
    expect(typeof headers['X-Tasko-Tab-Id']).toBe('string');
    // biome-ignore lint/style/noNonNullAssertion: guarded by expect above
    expect(headers['X-Tasko-Tab-Id']!.length).toBeGreaterThan(0);
  });

  it('sends the same X-Tasko-Tab-Id across multiple calls (stable cache)', async () => {
    fetchMock
      .mockResolvedValueOnce(makeResponse(200, { value: 'a' }))
      .mockResolvedValueOnce(makeResponse(200, { value: 'b' }));

    await apiCall('GET', '/api/one', undefined, SimpleSchema);
    await apiCall('GET', '/api/two', undefined, SimpleSchema);

    const first = (fetchMock.mock.calls[0] as [string, RequestInit])[1].headers as Record<string, string>;
    const second = (fetchMock.mock.calls[1] as [string, RequestInit])[1].headers as Record<string, string>;
    expect(first['X-Tasko-Tab-Id']).toBe(second['X-Tasko-Tab-Id']);
  });

  it('returns parsed body on 2xx with valid schema', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(200, { value: 'hello' }));

    const result = await apiCall('GET', '/api/test', undefined, SimpleSchema);
    expect(result).toEqual({ value: 'hello' });
  });

  it('sends body as JSON for POST/PATCH', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(200, { value: 'ok' }));

    await apiCall('POST', '/api/test', { name: 'foo' }, SimpleSchema);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(JSON.stringify({ name: 'foo' }));
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('throws ApiError with correct code on non-2xx with valid ApiErrorSchema envelope', async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse(404, {
        error: {
          code: 'ITEM_NOT_FOUND',
          message: 'Item not found',
          details: { id: 'abc' },
        },
      }),
    );

    await expect(apiCall('GET', '/api/items/abc', undefined, SimpleSchema)).rejects.toThrow(ApiError);

    fetchMock.mockResolvedValueOnce(
      makeResponse(404, {
        error: {
          code: 'ITEM_NOT_FOUND',
          message: 'Item not found',
          details: { id: 'abc' },
        },
      }),
    );

    try {
      await apiCall('GET', '/api/items/abc', undefined, SimpleSchema);
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.code).toBe('ITEM_NOT_FOUND');
      expect(apiErr.details).toEqual({ id: 'abc' });
    }
  });

  it('throws ApiError with code INTERNAL on non-2xx with unrecognised error body', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(500, { something: 'unexpected' }));

    try {
      await apiCall('GET', '/api/fail', undefined, SimpleSchema);
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.code).toBe('INTERNAL');
    }
  });

  it('throws ApiError on non-2xx with a known code and no details', async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse(400, { error: { code: 'VALIDATION', message: 'Bad input' } }),
    );

    try {
      await apiCall('POST', '/api/projects', {}, SimpleSchema);
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.code).toBe('VALIDATION');
    }
  });

  it('throws a ZodError on 2xx when body fails the provided schema', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(200, { wrong_field: 'nope' }));

    await expect(apiCall('GET', '/api/test', undefined, SimpleSchema)).rejects.toThrow();
  });

  it('uses the correct HTTP method in the request', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(200, { value: 'ok' }));

    await apiCall('DELETE', '/api/items/1', undefined, SimpleSchema);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('DELETE');
  });
});
