import { EventEmitter } from 'node:events';

export interface SSEEvent {
  type: string;
  payload: unknown;
  tabId: string | null;
}

export interface Broker {
  publish(event: SSEEvent): void;
  subscribe(handler: (e: SSEEvent) => void): () => void;
}

export function buildBroker(): Broker {
  const emitter = new EventEmitter();
  // Bump the default limit (10) — each open browser tab subscribes.
  emitter.setMaxListeners(1024);
  const EVENT = 'sse';

  return {
    publish(event: SSEEvent): void {
      // EventEmitter.emit propagates synchronous errors from listeners to the
      // caller. A single broken subscriber would otherwise fail whichever
      // request triggered publish (e.g. DELETE /api/items/:id → 500). Wrap
      // each listener in its own try so one bad SSE socket can't poison the
      // whole broker.
      const listeners = emitter.listeners(EVENT) as Array<(e: SSEEvent) => void>;
      for (const listener of listeners) {
        try {
          listener(event);
        } catch {
          // Subscriber is responsible for its own cleanup on error.
        }
      }
    },
    subscribe(handler: (e: SSEEvent) => void): () => void {
      emitter.on(EVENT, handler);
      return () => {
        emitter.off(EVENT, handler);
      };
    },
  };
}
