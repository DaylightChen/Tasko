import { ApiErrorSchema } from '@tasko/types';
import type { ZodSchema } from 'zod';

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

let TAB_ID: string | undefined;

export function getTabId(): string {
  if (!TAB_ID) {
    TAB_ID = crypto.randomUUID();
  }
  return TAB_ID;
}

export async function apiCall<TOut>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body: unknown,
  responseSchema: ZodSchema<TOut>,
): Promise<TOut> {
  const url = new URL(path, window.location.origin);
  // Only advertise application/json when there's a body. Fastify v5 rejects
  // Content-Type: application/json + empty body with FST_ERR_CTP_EMPTY_JSON_BODY,
  // which our error envelope rewraps as a 500. (Bites DELETE in particular.)
  const headers: Record<string, string> = {
    'X-Tasko-Tab-Id': getTabId(),
  };
  const init: RequestInit = { method, headers };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url.toString(), init);

  if (!res.ok) {
    const json: unknown = await res.json().catch(() => ({}));
    const parsed = ApiErrorSchema.safeParse(json);
    if (parsed.success) {
      throw new ApiError(parsed.data.error.code, parsed.data.error.details);
    }
    throw new ApiError('INTERNAL', json);
  }

  const json: unknown = await res.json();
  return responseSchema.parse(json);
}
