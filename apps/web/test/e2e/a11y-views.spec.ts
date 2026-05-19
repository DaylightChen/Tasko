/**
 * a11y-views.spec.ts
 *
 * Deferred from task-19: AxeBuilder scan across all 13 routes.
 * For each route, run axe-core and assert zero serious/critical violations.
 *
 * Requires: dev server running on localhost:5173, @axe-core/playwright installed.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { cleanupAll } from './_helpers/cleanup';
import { seedItem, seedProject } from './_helpers/setup';

const TODAY = new Date().toISOString().slice(0, 10);

test.describe('Accessibility — axe scan across all routes', () => {
  let projectId: string;

  test.beforeAll(async () => {
    await cleanupAll();
    const project = await seedProject({ name: 'A11y Test Project', is_hierarchical: false });
    projectId = project.id;
    await seedItem({ title: 'A11y item 1', due_date: TODAY, project_id: projectId });
  });

  test.afterAll(async () => {
    await cleanupAll();
  });

  const routes: Array<{ path: string; label: string }> = [
    { path: '/today', label: 'Today' },
    { path: '/tomorrow', label: 'Tomorrow' },
    { path: '/next-7-days', label: 'Next 7 Days' },
    { path: '/inbox', label: 'Inbox' },
    { path: '/all', label: 'All' },
    { path: '/trash', label: 'Trash' },
    { path: '/settings', label: 'Settings' },
    { path: '/calendar/month', label: 'Calendar Month' },
    { path: '/calendar/week', label: 'Calendar Week' },
  ];

  for (const { path, label } of routes) {
    test(`${label} (${path}) has no critical/serious a11y violations`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const critical = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');

      if (critical.length > 0) {
        const summary = critical
          .map((v) => `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} node(s))`)
          .join('\n');
        expect.soft(critical.length, `Critical/serious axe violations on ${path}:\n${summary}`).toBe(0);
      }

      expect(critical.length).toBe(0);
    });
  }

  test('Project view has no critical/serious a11y violations', async ({ page }) => {
    await page.goto(`/project/${projectId}`);
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const critical = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(critical.length).toBe(0);
  });

  test('Project kanban view has no critical/serious a11y violations', async ({ page }) => {
    await page.goto(`/project/${projectId}/kanban`);
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const critical = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(critical.length).toBe(0);
  });
});
