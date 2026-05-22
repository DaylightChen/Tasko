import type { ApiErrorCode } from '@tasko/types';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    public code: ApiErrorCode,
    public override message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function envelope(err: unknown, req: FastifyRequest, reply: FastifyReply): void {
  if (err instanceof HttpError) {
    void reply
      .code(err.statusCode)
      .send({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  if (err instanceof ZodError) {
    void reply
      .code(400)
      .send({ error: { code: 'VALIDATION', message: 'Invalid request body.', details: err.issues } });
    return;
  }
  // Unhandled — log full error so it's debuggable from server stderr instead
  // of disappearing into a generic 500.
  req.log.error({ err, url: req.url, method: req.method }, 'unhandled error in route');
  void reply.code(500).send({ error: { code: 'INTERNAL', message: 'Server error.' } });
}
