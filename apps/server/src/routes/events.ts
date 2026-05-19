import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const EventsQuerySchema = z.object({ tab_id: z.string().optional() });

export const HEARTBEAT_INTERVAL_MS = Number(process.env.SSE_HEARTBEAT_MS ?? 25_000);

export function registerEventsRoute(app: FastifyInstance): void {
  app.get('/api/events', async (req, reply) => {
    const { tab_id } = EventsQuerySchema.parse(req.query);

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    reply.raw.flushHeaders?.();

    const unsubscribe = app.broker.subscribe((event) => {
      const source = event.tabId === tab_id ? 'self' : 'other-tab';
      const data = JSON.stringify({
        ...(event.payload as object),
        source,
        timestamp: new Date().toISOString(),
      });
      reply.raw.write(`event: ${event.type}\n`);
      reply.raw.write(`data: ${data}\n\n`);
    });

    const heartbeat = setInterval(() => {
      reply.raw.write(': ping\n\n');
    }, HEARTBEAT_INTERVAL_MS);

    req.raw.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
}
