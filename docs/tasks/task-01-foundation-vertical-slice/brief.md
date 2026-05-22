# Task 01 — Foundation: vertical slice

> Written in the plan phase. Immutable during implement-phase execution. An agent with zero prior context must be able to execute this task by reading only this file and the files it references.

## Goal

Scaffold the Tasko monorepo and prove the full stack works end-to-end with the smallest viable feature: a `GET /api/health` endpoint on the Fastify server that returns `{ ok: true, version, uptime_s }`, and a Vite-served React SPA that calls it on mount and displays "Tasko service: OK" (or an error state if unreachable). At the end of this task, `pnpm install && pnpm dev` brings up two processes (server on `:7373`, Vite dev on `:5173` proxying `/api` to `:7373`) and the browser shows the health string. No real features — but TypeScript strict, Biome, Vitest, pnpm workspaces, design tokens CSS, and the inter-process plumbing are all proven. Every later task imports from `@tasko/types` and uses these tokens.

## Context files

- `docs/engineering/2026-05-18-architecture.md#1-tech-stack` — locked stack picks (TypeScript 5 strict, pnpm 9, Node 20 LTS, Fastify 5, Vite 5, React 19, Biome 1, Vitest 2, etc.).
- `docs/engineering/2026-05-18-architecture.md#3-module-boundaries` — directory layouts for `apps/server`, `apps/web`, `packages/types`.
- `docs/engineering/2026-05-18-architecture.md#7-build--dev-workflow` — `pnpm dev` (concurrently), `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm start` scripts.
- `docs/engineering/2026-05-18-code-architecture.md#1-repo--workspaces` — concrete `package.json` shapes for root, `packages/types`, `apps/server`, `apps/web`.
- `docs/engineering/2026-05-18-code-architecture.md#3-1-boot----bin-tasko-server-ts` — server boot entry point.
- `docs/engineering/2026-05-18-code-architecture.md#3-3-server-bootstrap----server-ts` — Fastify bootstrap shape (we only need `registerHealthRoute` in this task; other routes are added in later tasks).
- `docs/engineering/2026-05-18-frontend-architecture.md#2-provider-tree` — provider tree shape (we ship a minimal version in this task; full version in task 04).
- `docs/engineering/2026-05-18-frontend-architecture.md#18-build-configuration` — Vite + Biome + TS configs.
- `docs/engineering/2026-05-18-api.md#10-1--get--api-health----liveness` — exact response shape: `{ ok, version, data_dir, item_count, uptime_s }`. In this task, `data_dir` is the resolved CLI/env path (default `~/Documents/.tasko-data`); `item_count` is `0` (the indexer doesn't exist yet — return `0` as a placeholder until task 02 wires it).
- `docs/engineering/2026-05-18-open-questions.md#0-binding-resolutions-user-2026-05-18` — binding resolutions: data dir default `~/Documents/.tasko-data`, port default `7373`, server errors out if port taken (no fallback).
- `docs/ux/design-language.md` — the source of truth for tokens. Convert every token in §1 (typography), §2 (colors), §3 (spacing), §4 (radius), §5 (elevation), §6 (motion), §7 (icons reference list) into CSS custom properties in `apps/web/src/styles/tokens.css`.

## Downstream dependencies

- **Task 02** will fill in `packages/types/src/*` (zod schemas) and the `apps/server/src/store/*` modules. Keep the workspace import path `@tasko/types` working from both `apps/server` and `apps/web`.
- **Task 03+** will register additional routes via `registerXxxRoutes(app)` in `apps/server/src/server.ts`. Keep `buildServer(config)` exported and the Fastify `app` decoration pattern (`app.decorate('config', config)`) in place.
- **Task 04** will replace the minimal SPA shell with the full provider tree (TanStack Router, Query, theming). Keep `apps/web/src/main.tsx` simple; just mount React and one health-check probe component.
- **All later web tasks** consume tokens from `apps/web/src/styles/tokens.css`. The `:root[data-theme='light']` / `:root[data-theme='dark']` attribute selectors must be in place; the `themeStore` ships in task-04.
- **All Vitest tests** rely on the configuration shipped here.

## Steps

1. **Root monorepo init** — at the repo root, create:
   - `package.json` per `code-architecture.md` §1.1 (private root with workspaces `apps/*`, `packages/*`, scripts `dev`, `build`, `start`, `test`, `test:e2e`, `typecheck`, `lint`, `format`; devDeps `biome ^1.9`, `concurrently ^9`, `typescript ^5.6`).
   - `pnpm-workspace.yaml`:
     ```yaml
     packages:
       - 'apps/*'
       - 'packages/*'
     ```
   - `tsconfig.base.json` per `frontend-architecture.md` §18.3 (strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes, noImplicitOverride, useUnknownInCatchVariables, target ES2022, module ESNext, moduleResolution Bundler, skipLibCheck, esModuleInterop, resolveJsonModule, isolatedModules, forceConsistentCasingInFileNames).
   - `biome.json` per `frontend-architecture.md` §18.2.
   - `.gitignore` covering `node_modules/`, `dist/`, `.turbo/`, `.DS_Store`, `*.log`, `coverage/`, `playwright-report/`, `test-results/`. Keep the existing `.gitignore` content if any.
   - `README.md` — a stub: project name, "Single-user local-first task tracker. v1 in progress.", and a placeholder for run instructions to be expanded in task-20.

2. **`packages/types/` skeleton** — create:
   - `packages/types/package.json` per `code-architecture.md` §1.2. Dependency: `zod ^3.23`.
   - `packages/types/tsconfig.json` extending base, output `dist/`, declaration true, but `main` and `types` point to `./src/index.ts` for in-monorepo consumption.
   - `packages/types/src/index.ts` — empty exports for now: `export {};`. Real schemas land in task-02.

3. **`apps/server/` skeleton** — create:
   - `apps/server/package.json` per `code-architecture.md` §1.3. Runtime deps: `@tasko/types: workspace:*`, `fastify ^5`, `@fastify/cors ^11`, `@fastify/static ^8`, `pino ^9`, `pino-pretty ^11`, `ulid ^3`, `zod ^3.23`, `chokidar ^4`, `p-limit ^6`. (Some of these aren't used until later tasks; install all now so subsequent tasks don't need to revisit `package.json`.)
   - `apps/server/tsconfig.json` extending base, `module: NodeNext`, `moduleResolution: NodeNext`, `outDir: dist`, `rootDir: src`, `types: ["node"]`. Include `src` and `test`.
   - `apps/server/src/config/load.ts`:
     ```ts
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
     ```
   - `apps/server/src/server.ts` — `buildServer(config)` that creates the Fastify instance, registers CORS for `http://127.0.0.1:5173` and `http://${host}:${port}`, decorates `app.config`, and mounts the health route. Set the error handler to envelope errors as `{ error: { code, message } }` (basic version — task 03 will expand the error-envelope handler):
     ```ts
     import Fastify, { FastifyInstance } from 'fastify';
     import cors from '@fastify/cors';
     import { ServerConfig } from './config/load.js';
     import { registerHealthRoute } from './routes/health.js';

     export async function buildServer(config: ServerConfig): Promise<FastifyInstance> {
       const app = Fastify({ logger: { level: config.logLevel, transport: process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' } } });
       app.decorate('config', config);
       await app.register(cors, { origin: [`http://${config.host}:${config.port}`, 'http://127.0.0.1:5173'], credentials: false });
       app.setErrorHandler((err, _req, reply) => {
         app.log.error(err);
         reply.code(500).send({ error: { code: 'INTERNAL', message: 'Server error.' } });
       });
       registerHealthRoute(app);
       return app;
     }
     // Fastify type augmentation:
     declare module 'fastify' {
       interface FastifyInstance { config: ServerConfig }
     }
     ```
   - `apps/server/src/routes/health.ts`:
     ```ts
     import { FastifyInstance } from 'fastify';
     const startedAt = Date.now();
     export function registerHealthRoute(app: FastifyInstance) {
       app.get('/api/health', async () => ({
         ok: true,
         version: '1.0.0',
         data_dir: app.config.dataDir,
         item_count: 0,           // populated in task 02 when indexer exists
         uptime_s: Math.floor((Date.now() - startedAt) / 1000),
       }));
     }
     ```
   - `apps/server/src/bin/tasko-server.ts`:
     ```ts
     #!/usr/bin/env node
     import { buildServer } from '../server.js';
     import { loadConfig } from '../config/load.js';

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
     ```
   - `apps/server/test/unit/health.spec.ts` — Vitest test using Fastify's `inject`:
     ```ts
     import { describe, it, expect } from 'vitest';
     import { buildServer } from '../../src/server';
     import { loadConfig } from '../../src/config/load';

     describe('GET /api/health', () => {
       it('returns ok with the expected shape', async () => {
         const config = loadConfig([], { TASKO_DATA_DIR: '/tmp/tasko-test' });
         const app = await buildServer({ ...config, logLevel: 'fatal' });
         const res = await app.inject({ method: 'GET', url: '/api/health' });
         expect(res.statusCode).toBe(200);
         const body = JSON.parse(res.body);
         expect(body.ok).toBe(true);
         expect(body.version).toBe('1.0.0');
         expect(body.data_dir).toBe('/tmp/tasko-test');
         await app.close();
       });
     });
     ```
   - `apps/server/vitest.config.ts` — minimal, `test: { environment: 'node', include: ['test/**/*.spec.ts'] }`.

4. **`apps/web/` skeleton** — create:
   - `apps/web/package.json` per `code-architecture.md` §1.4 (full dep list — install all now). Runtime: `@tasko/types: workspace:*`, `react ^19`, `react-dom ^19`, `@tanstack/react-query ^5`, `@tanstack/react-router ^1`, `@tanstack/react-virtual ^3`, `zustand ^4.5`, `@dnd-kit/core ^6.1`, `@dnd-kit/sortable ^8`, `cmdk ^1`, `lucide-react ^0.450`, `@floating-ui/react ^0.27`, `react-day-picker ^9`, `marked ^14`, `dompurify ^3`, `zod ^3.23`. Dev: `@playwright/test ^1.45`, `@testing-library/react ^16`, `@testing-library/jest-dom ^6`, `@types/react ^19`, `@types/react-dom ^19`, `@types/dompurify ^3`, `@vitejs/plugin-react ^4`, `msw ^2`, `vite ^5`, `vitest ^2`, `jsdom ^25`.
   - `apps/web/tsconfig.json` per `frontend-architecture.md` §18.3.
   - `apps/web/vite.config.ts` per `frontend-architecture.md` §18.1.
   - `apps/web/index.html` — `<div id="root"></div>`, link to `/src/main.tsx`.
   - `apps/web/src/styles/tokens.css` — **the design tokens layer**. Translate every token from `docs/ux/design-language.md` §1-7 into CSS custom properties under `:root[data-theme='light']` and `:root[data-theme='dark']`. Include the typography ramp variables (e.g., `--text-body-size`, `--text-body-line-height`, `--text-body-weight`, `--text-body-tracking`) for both desktop and mobile (use a `@media (max-width: 768px)` block for the mobile overrides). Include motion duration tokens (`--motion-instant: 80ms`, `--motion-fast: 120ms`, etc.) and easing tokens. Include radius and spacing tokens. Default `:root` (no theme attribute) falls back to light values.
   - `apps/web/src/styles/base.css` — CSS reset (the minimal modern reset: `*, *::before, *::after { box-sizing: border-box }`, `body { margin: 0; font-family: var(--font-sans); ... }`, etc.), global typography defaults sourced from tokens, link reset.
   - `apps/web/src/styles/theme.css` — initial `:root` rule that defaults to `data-theme='light'` if unset. The `themeStore` in task-04 mutates `document.documentElement.dataset.theme`.
   - `apps/web/src/main.tsx`:
     ```tsx
     import { StrictMode } from 'react';
     import { createRoot } from 'react-dom/client';
     import './styles/tokens.css';
     import './styles/base.css';
     import './styles/theme.css';
     import { App } from './app';

     const root = createRoot(document.getElementById('root')!);
     root.render(<StrictMode><App /></StrictMode>);
     ```
   - `apps/web/src/app.tsx` — minimal: fetches `/api/health` on mount, renders "Tasko service: OK" on success or "Tasko service: not running. Start the server and refresh." on failure. Use plain `fetch` for this one task; the typed `apiCall` wrapper lands in task-04.
     ```tsx
     import { useEffect, useState } from 'react';
     export function App() {
       const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
       useEffect(() => {
         fetch('/api/health').then(r => r.ok ? setStatus('ok') : setStatus('error')).catch(() => setStatus('error'));
       }, []);
       return (
         <main id="main" style={{ padding: 'var(--space-6)' }}>
           <h1 style={{ fontSize: 'var(--text-h1-size)' }}>Tasko</h1>
           <p>{status === 'loading' ? 'Checking server…' : status === 'ok' ? 'Tasko service: OK' : 'Tasko service: not running. Start the server and refresh.'}</p>
         </main>
       );
     }
     ```
   - `apps/web/vitest.config.ts` — `test: { environment: 'jsdom', setupFiles: ['./test/setup.ts'], include: ['src/**/*.test.{ts,tsx}'] }`. Create `apps/web/test/setup.ts` with `import '@testing-library/jest-dom/vitest';`.
   - `apps/web/src/app.test.tsx` — Vitest + Testing Library smoke test (mock fetch, assert "Tasko service: OK" rendered).

5. **Workspace install + verify** — From the repo root:
   - `pnpm install`.
   - `pnpm --filter @tasko/types build` (compiles or just type-checks; the package's main points at src so build is type-only).
   - `pnpm --filter @tasko/server typecheck`, `pnpm --filter @tasko/web typecheck` — both pass.
   - `pnpm --filter @tasko/server test` — health spec passes.
   - `pnpm --filter @tasko/web test` — app smoke test passes.
   - `pnpm lint` — Biome reports no issues.
   - `pnpm --filter @tasko/server dev &` then `pnpm --filter @tasko/web dev &` — confirm both come up. `curl http://127.0.0.1:7373/api/health` returns the JSON. Open `http://127.0.0.1:5173` and confirm "Tasko service: OK".

6. **Document the data-dir binding decision** — at the top of `apps/server/src/config/load.ts`, add a JSDoc comment block citing the binding resolution: "Default data dir is `~/Documents/.tasko-data` per `docs/engineering/2026-05-18-open-questions.md` §0 (user binding resolution 2026-05-18). The decision log entry on `~/.tasko` is superseded."

## Acceptance criteria

- [ ] `pnpm install` completes without errors at the repo root.
- [ ] `pnpm --filter @tasko/server typecheck` reports 0 errors.
- [ ] `pnpm --filter @tasko/web typecheck` reports 0 errors.
- [ ] `pnpm --filter @tasko/types build` succeeds.
- [ ] `pnpm --filter @tasko/server test` — `health.spec.ts` passes; status 200, response includes `ok: true`, `version: '1.0.0'`, `data_dir: '/tmp/tasko-test'`.
- [ ] `pnpm --filter @tasko/web test` — `app.test.tsx` passes; the smoke test sees "Tasko service: OK" after a mocked `/api/health` fetch resolves.
- [ ] `pnpm lint` — Biome reports zero issues; `pnpm format` is a no-op (codebase already formatted).
- [ ] `pnpm dev` (root script) starts both processes; `curl -s http://127.0.0.1:7373/api/health | grep '"ok":true'` matches; opening `http://127.0.0.1:5173` in a browser shows "Tasko service: OK".
- [ ] `apps/web/src/styles/tokens.css` defines every named token from `docs/ux/design-language.md` §2.1–§2.9, §3, §4, §5, §6.1, §6.2 as CSS custom properties under `:root[data-theme='light']` and `:root[data-theme='dark']`. A grep for `--color-canvas` returns hits in both rules. The mobile typography ramp lives under `@media (max-width: 768px)`.
- [ ] `package.json` at the repo root has `workspaces: ["apps/*", "packages/*"]` and the scripts listed in step 1.
- [ ] `apps/web/vite.config.ts` proxies `/api` to `http://127.0.0.1:7373`.
- [ ] The `@tasko/types` import works from both `apps/server/src/server.ts` and `apps/web/src/main.tsx` (smoke import an empty export in each to verify resolution).

## Output files

- Created:
  - `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `biome.json`, `.gitignore`, `README.md`
  - `packages/types/package.json`, `packages/types/tsconfig.json`, `packages/types/src/index.ts`
  - `apps/server/package.json`, `apps/server/tsconfig.json`, `apps/server/vitest.config.ts`
  - `apps/server/src/config/load.ts`, `apps/server/src/server.ts`, `apps/server/src/routes/health.ts`, `apps/server/src/bin/tasko-server.ts`
  - `apps/server/test/unit/health.spec.ts`
  - `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/vitest.config.ts`, `apps/web/index.html`
  - `apps/web/src/styles/tokens.css`, `apps/web/src/styles/base.css`, `apps/web/src/styles/theme.css`
  - `apps/web/src/main.tsx`, `apps/web/src/app.tsx`, `apps/web/src/app.test.tsx`
  - `apps/web/test/setup.ts`
- Modified: none.
