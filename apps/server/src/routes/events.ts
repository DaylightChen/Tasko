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

    // Capture unsubscribe via mutable binding so the subscriber callback can
    // self-detach if its socket dies (write throws). Otherwise a dead
    // subscriber takes down the whole broker.publish call — and with it the
    // request that triggered the event — with a 500.
    let unsubscribe: () => void = () => {};
    let isAlive = true;
    const cleanup = () => {
      if (!isAlive) return;
      isAlive = false;
      unsubscribe();
    };

    unsubscribe = app.broker.subscribe((event) => {
      if (!isAlive) return;
      try {
        const source = event.tabId === tab_id ? 'self' : 'other-tab';
        const data = JSON.stringify({
          ...(event.payload as object),
          source,
          timestamp: new Date().toISOString(),
        });
        reply.raw.write(`event: ${event.type}\n`);
        reply.raw.write(`data: ${data}\n\n`);
      } catch {
        // Underlying socket is gone (closed tab, network drop, EPIPE).
        // Detach silently so future publishes don't keep throwing.
        cleanup();
      }
    });

    const heartbeat = setInterval(() => {
      if (!isAlive) return;
      try {
        reply.raw.write(': ping\n\n');
      } catch {
        clearInterval(heartbeat);
        cleanup();
      }
    }, HEARTBEAT_INTERVAL_MS);

    req.raw.on('close', () => {
      clearInterval(heartbeat);
      cleanup();
    });
  });
}
