import { access } from 'node:fs/promises';
import cors from '@fastify/cors';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { ServerConfig } from './config/load.js';
import { envelope } from './middleware/error-envelope.js';
import { type Broker, buildBroker } from './middleware/sse-broker.js';
import { registerBulkRoutes } from './routes/bulk.js';
import { registerConfigRoutes } from './routes/config.js';
import { registerFolderRoutes } from './routes/folders.js';
import { registerHealthRoute } from './routes/health.js';
import { registerItemRoutes } from './routes/items.js';
import { registerProjectRoutes } from './routes/projects.js';
import { registerTagRoutes } from './routes/tags.js';
import { registerTrashRoutes } from './routes/trash.js';
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

  const broker = buildBroker();

  app.decorate('config', config);
  app.decorate('indexer', indexer);
  app.decorate('broker', broker);

  await app.register(cors, {
    origin: [`http://${config.host}:${config.port}`, 'http://127.0.0.1:5173'],
    credentials: false,
  });

  // Routes
  registerHealthRoute(app);
  registerItemRoutes(app);
  registerTrashRoutes(app);
  registerProjectRoutes(app);
  registerFolderRoutes(app);
  registerTagRoutes(app);
  registerConfigRoutes(app);
  registerBulkRoutes(app);

  // 404 handler for unmatched routes
  app.setNotFoundHandler((_req, reply) => {
    void reply.code(404).send({ error: { code: 'INTERNAL', message: 'Route not found.' } });
  });

  // Error envelope — replaces the default error handler
  app.setErrorHandler(envelope);

  return app;
}

// Fastify type augmentation:
declare module 'fastify' {
  interface FastifyInstance {
    config: ServerConfig;
    indexer: Indexer;
    broker: Broker;
  }
}
