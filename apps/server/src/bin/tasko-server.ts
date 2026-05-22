#!/usr/bin/env node
import { loadConfig } from '../config/load.js';
import { buildServer } from '../server.js';

const config = loadConfig(process.argv.slice(2), process.env);
const server = await buildServer(config);
try {
  await server.listen({ port: config.port, host: config.host });
  server.log.info(`Tasko listening on http://${config.host}:${config.port}`);
  server.log.info(`Data directory: ${config.dataDir}`);
} catch (err) {
  server.log.error(err);
  process.exit(1);
}
