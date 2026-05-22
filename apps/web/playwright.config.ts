import { defineConfig, devices } from '@playwright/test';

/**
 * Tasko E2E Playwright configuration.
 *
 * Requires the dev server to be running before tests execute:
 *   Terminal 1: pnpm dev   (starts server on :7373 + Vite on :5173)
 *   Terminal 2: pnpm test:e2e
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
