/**
 * broker-isolation.spec.ts
 *
 * Regression: a single broken subscriber must NOT take down broker.publish.
 * Without isolation, a thrown error from one SSE subscriber propagates up
 * through EventEmitter.emit and fails whichever request triggered the
 * publish (e.g. DELETE /api/items/:id → 500 INTERNAL).
 */
import { describe, expect, it, vi } from 'vitest';
import { buildBroker } from '../../src/middleware/sse-broker.js';

describe('Broker publish isolation', () => {
  it('publish does not throw when a subscriber throws', () => {
    const broker = buildBroker();
    broker.subscribe(() => {
      throw new Error('simulated SSE socket failure');
    });
    expect(() => broker.publish({ type: 't', payload: {}, tabId: null })).not.toThrow();
  });

  it('a throwing subscriber does not prevent other subscribers from receiving', () => {
    const broker = buildBroker();
    const healthy = vi.fn();
    broker.subscribe(() => {
      throw new Error('boom');
    });
    broker.subscribe(healthy);
    broker.publish({ type: 't', payload: { x: 1 }, tabId: null });
    expect(healthy).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe removes a subscriber from future publishes', () => {
    const broker = buildBroker();
    const fn = vi.fn();
    const unsub = broker.subscribe(fn);
    broker.publish({ type: 'a', payload: {}, tabId: null });
    unsub();
    broker.publish({ type: 'b', payload: {}, tabId: null });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
