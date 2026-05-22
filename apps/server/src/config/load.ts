/**
 * Default data dir is `~/Documents/.tasko-data` per
 * `docs/engineering/2026-05-18-open-questions.md` §0 (user binding resolution 2026-05-18).
 * The decision log entry on `~/.tasko` is superseded.
 */
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface ServerConfig {
  dataDir: string;
  port: number;
  host: string;
  initIfMissing: boolean;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug';
}

export function loadConfig(argv: string[], env: NodeJS.ProcessEnv): ServerConfig {
  // Parse --data-dir <path>, --port <n>, --host <addr>, --init, --log-level <level>.
  // Fallback to env: TASKO_DATA_DIR, TASKO_PORT, TASKO_HOST, TASKO_LOG_LEVEL.
  // Defaults: ~/Documents/.tasko-data, 7373, 127.0.0.1, info. Server errors out (no
  // fallback) if port is invalid or already in use — that surfaces at .listen() time.
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
  };
  const dataDir = get('--data-dir') ?? env.TASKO_DATA_DIR ?? join(homedir(), 'Documents', '.tasko-data');
  const port = Number(get('--port') ?? env.TASKO_PORT ?? 7373);
  const host = get('--host') ?? env.TASKO_HOST ?? '127.0.0.1';
  const initIfMissing = argv.includes('--init');
  const logLevel = (get('--log-level') ?? env.TASKO_LOG_LEVEL ?? 'info') as ServerConfig['logLevel'];
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${port}`);
  }
  return { dataDir, port, host, initIfMissing, logLevel };
}
