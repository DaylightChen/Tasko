import { defineConfig, devices } from '@playwright/test';

/**
 * Tasko E2E Playwright configuration.
 *
 * Requires the dev server to be running before tests execute. Use the
 * `pnpm dev:test` script, NOT `pnpm dev`, so the server points at the
 * project-local `.tasko-data-test/` instead of your real
 * `~/Documents/.tasko-data` — the e2e cleanup helpers wipe whatever data
 * dir the server is serving:
 *   Terminal 1: pnpm dev:test   (server :7373 + Vite :5173, isolated data)
 *   Terminal 2: pnpm test:e2e
 *
 * The `cleanupAll` helper also self-guards via `/api/health.data_dir` and
 * refuses to run against anything that isn't the project-local
 * `.tasko-data-test/`, so a stale `pnpm dev` can't be wiped accidentally.
 *
 * We do NOT use webServer auto-start here because a full production build
 * (pnpm build && pnpm start) is slow and fragile in a local-only project.
 * See docs/known-issues.md for the E2E manual-server requirement.
 */
export default defineConfig({
  testDir: 'test/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
