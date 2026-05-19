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
  const EVENT = 'sse';

  return {
    publish(event: SSEEvent): void {
      emitter.emit(EVENT, event);
    },
    subscribe(handler: (e: SSEEvent) => void): () => void {
      emitter.on(EVENT, handler);
      return () => {
        emitter.off(EVENT, handler);
      };
    },
  };
}
