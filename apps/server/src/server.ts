import cors from '@fastify/cors';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { ServerConfig } from './config/load.js';
import { registerHealthRoute } from './routes/health.js';

export async function buildServer(config: ServerConfig): Promise<FastifyInstance> {
  const isProd = process.env.NODE_ENV === 'production';
  const app = Fastify({
    logger: isProd
      ? { level: config.logLevel }
      : { level: config.logLevel, transport: { target: 'pino-pretty' } },
  });
  app.decorate('config', config);
  await app.register(cors, {
    origin: [`http://${config.host}:${config.port}`, 'http://127.0.0.1:5173'],
    credentials: false,
  });
  app.setErrorHandler((err, _req, reply) => {
    app.log.error(err);
    reply.code(500).send({ error: { code: 'INTERNAL', message: 'Server error.' } });
  });
  registerHealthRoute(app);
  return app;
}

// Fastify type augmentation:
declare module 'fastify' {
  interface FastifyInstance {
    config: ServerConfig;
  }
}
