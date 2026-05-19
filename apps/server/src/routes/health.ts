import type { FastifyInstance } from 'fastify';

const startedAt = Date.now();

export function registerHealthRoute(app: FastifyInstance) {
  app.get('/api/health', async () => ({
    ok: true,
    version: '1.0.0',
    data_dir: app.config.dataDir,
    item_count: 0, // populated in task 02 when indexer exists
    uptime_s: Math.floor((Date.now() - startedAt) / 1000),
  }));
}
