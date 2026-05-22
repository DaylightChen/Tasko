import { existsSync } from 'node:fs';
import { access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { ServerConfig } from './config/load.js';
import { envelope } from './middleware/error-envelope.js';
import { type Broker, buildBroker } from './middleware/sse-broker.js';
import { registerBulkRoutes } from './routes/bulk.js';
import { registerConfigRoutes } from './routes/config.js';
import { registerEventsRoute } from './routes/events.js';
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

  // Tolerate `Content-Type: application/json` with an empty body. Fastify v5's
  // default JSON parser throws FST_ERR_CTP_EMPTY_JSON_BODY in that case, which
  // bites DELETE / no-body requests where a client still advertises JSON.
  // Treat an empty body the same as undefined.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    const raw = typeof body === 'string' ? body : '';
    if (raw.trim() === '') {
      done(null, undefined);
      return;
    }
    try {
      done(null, JSON.parse(raw));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  // Error envelope — set early so it applies to every route + plugin context
  // registered after this point.
  app.setErrorHandler(envelope);

  // Routes
  registerHealthRoute(app);
  registerEventsRoute(app);
  registerItemRoutes(app);
  registerTrashRoutes(app);
  registerProjectRoutes(app);
  registerFolderRoutes(app);
  registerTagRoutes(app);
  registerConfigRoutes(app);
  registerBulkRoutes(app);

  // Serve the built web SPA at `/` if its dist directory can be located. The
  // server runs from one of two known layouts:
  //   (a) source/dev:      apps/server/dist/server.js → apps/web/dist/
  //   (b) bundled release: <root>/server.js          → <root>/web/
  // Honor TASKO_SPA_DIR for unusual deployments. If no candidate has an
  // index.html, skip static serving and keep the JSON 404 behavior (so the
  // API still works headless and tests don't depend on a built SPA).
  const spaRoot = resolveSpaRoot();

  if (spaRoot) {
    app.log.info(`Serving web SPA from ${spaRoot}`);
    await app.register(fastifyStatic, { root: spaRoot });
  }

  // 404 handler for unmatched routes. `/api/*` always returns the error
  // envelope; everything else falls back to the SPA's index.html when the
  // SPA is present (so client-side routes like /today, /calendar work on
  // direct hit / refresh).
  app.setNotFoundHandler((req, reply) => {
    const isApi = req.url.startsWith('/api/');
    if (!isApi && spaRoot && req.method === 'GET') {
      void reply.type('text/html').sendFile('index.html', spaRoot);
      return;
    }
    void reply.code(404).send({ error: { code: 'INTERNAL', message: 'Route not found.' } });
  });

  return app;
}

function resolveSpaRoot(): string | null {
  const serverDir = dirname(fileURLToPath(import.meta.url));
  const candidates: string[] = [];
  if (process.env.TASKO_SPA_DIR) candidates.push(process.env.TASKO_SPA_DIR);
  // apps/server/dist → apps/web/dist (source/dev layout)
  candidates.push(join(serverDir, '..', '..', 'web', 'dist'));
  // <root>/server.js + <root>/web (bundled release layout)
  candidates.push(join(serverDir, 'web'));
  // <root>/bin/server.js + <root>/web (alt bundled layout)
  candidates.push(join(serverDir, '..', 'web'));
  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'index.html'))) return candidate;
  }
  return null;
}

// Fastify type augmentation:
declare module 'fastify' {
  interface FastifyInstance {
    config: ServerConfig;
    indexer: Indexer;
    broker: Broker;
  }
}
