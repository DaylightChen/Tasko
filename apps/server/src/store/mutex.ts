// A hand-rolled async lock — avoids a p-queue dependency for a single-writer mutex.
export interface Mutex {
  run<T>(fn: () => Promise<T>): Promise<T>;
}

export function buildMutex(): Mutex {
  let chain: Promise<unknown> = Promise.resolve();
  return {
    run: <T>(fn: () => Promise<T>): Promise<T> => {
      const next = chain.then(fn, fn);
      chain = next.catch(() => undefined);
      return next as Promise<T>;
    },
  };
}
