import { access } from 'node:fs/promises';
import cors from '@fastify/cors';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { ServerConfig } from './config/load.js';
import { registerHealthRoute } from './routes/health.js';
import { ensureDir } from './store/fs-store.js';
import { type Indexer, buildIndexer } from './store/indexer.js';
import { buildPaths } from './store/paths.js';

export async function buildServer(config: ServerConfig): Promise<FastifyInstance> {
  const isProd = process.env.NODE_ENV === 'production';
  const app = Fastify({
    logger: isProd
      ? { level: config.logLevel }
      : { level: config.logLevel, transport: { target: 'pino-pretty' } },
  });

  if (config.initIfMissing) {
    // Create the data directory and all required subdirectories.
    const paths = buildPaths(config.dataDir);
    await ensureDir(paths.dataDir);
    await ensureDir(paths.itemsDir);
    await ensureDir(paths.trashDir);
    await ensureDir(paths.projectsDir);
    await ensureDir(paths.foldersDir);
    await ensureDir(paths.tagsDir);
  } else {
    // Verify the data directory exists; exit cleanly with a clear message if not.
    try {
      await access(config.dataDir);
    } catch {
      throw new Error(`Data directory does not exist: ${config.dataDir}. Run with --init to create it.`);
    }
  }

  const indexer = buildIndexer(config.dataDir, app.log);
  const bootStats = await indexer.bootstrap();
  app.log.info(
    `Index ready: ${bootStats.items} items, ${bootStats.projects} projects, ` +
      `${bootStats.folders} folders, ${bootStats.tags} tags, ${bootStats.trashed} trashed.`,
  );
  for (const w of bootStats.warnings) {
    app.log.warn(w);
  }

  app.decorate('config', config);
  app.decorate('indexer', indexer);

  await app.register(cors, {
    origin: [`http://${config.host}:${config.port}`, 'http://127.0.0.1:5173'],
    credentials: false,
  });

  app.setErrorHandler((err, _req, reply) => {
    app.log.error(err);
    void reply.code(500).send({ error: { code: 'INTERNAL', message: 'Server error.' } });
  });

  registerHealthRoute(app);
  return app;
}

// Fastify type augmentation:
declare module 'fastify' {
  interface FastifyInstance {
    config: ServerConfig;
    indexer: Indexer;
  }
}
