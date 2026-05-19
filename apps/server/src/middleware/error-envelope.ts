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

export function envelope(err: unknown, _req: FastifyRequest, reply: FastifyReply): void {
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
  void reply.code(500).send({ error: { code: 'INTERNAL', message: 'Server error.' } });
}
