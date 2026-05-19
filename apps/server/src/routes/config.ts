import type { Config } from '@tasko/types';
import { ConfigPatchSchema } from '@tasko/types';
import type { FastifyInstance } from 'fastify';

export function registerConfigRoutes(app: FastifyInstance): void {
  // GET /api/config
  app.get('/api/config', async (_req, reply) => {
    const index = app.indexer.getIndex();
    return reply.send(index.config);
  });

  // PATCH /api/config
  app.patch('/api/config', async (req, reply) => {
    const patch = ConfigPatchSchema.parse(req.body);

    const tabId = (req.headers['x-tasko-tab-id'] as string | undefined) ?? null;

    const updated = await app.indexer.withWriteLock(async (index, ops) => {
      const now = new Date().toISOString();
      const config: Config = {
        schema_version: index.config.schema_version,
        theme: patch.theme ?? index.config.theme,
        week_start: patch.week_start ?? index.config.week_start,
        last_modified: now,
      };

      await ops.writeConfig(config);
      app.broker.publish({ type: 'config.changed', payload: { config }, tabId });

      return config;
    });

    return reply.send(updated);
  });
}
