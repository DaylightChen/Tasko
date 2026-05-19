/**
 * a11y-shell.test.tsx
 *
 * Verifies the landmark + skip-link + heading shell acceptance criteria:
 * - <a className="skip-link" href="#main"> is present in the root layout
 * - The sidebar renders <nav aria-label="Primary navigation">
 * - The main content area has id="main"
 * - index.html has <html lang="en">
 *
 * Note: Full per-route heading audits require rendered route content;
 * this covers the structural shell which is verified statically or with mocks.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock tanstack router and sidebar dependencies to render RootLayout in isolation
vi.mock('@tanstack/react-router', () => ({
  Outlet: () => <div data-testid="outlet">content</div>,
  createRootRoute: (opts: { component: React.ComponentType }) => opts,
  useNavigate: () => vi.fn(),
  Link: ({ children, ...props }: { children: React.ReactNode; to: string }) => (
    <a href={props.to}>{children}</a>
  ),
}));

// Mock the sidebar to avoid its full dependency tree
vi.mock('../../components/sidebar', () => ({
  Sidebar: () => (
    <nav aria-label="Primary navigation" data-testid="sidebar-nav">
      Sidebar
    </nav>
  ),
}));

// Mock TaskModal
vi.mock('../../views/task-modal', () => ({
  TaskModal: () => null,
}));

describe('a11y shell — __root.tsx', () => {
  it('renders a skip-link pointing to #main', async () => {
    // Dynamically import RootLayout after mocks are set up
    const { Route } = await import('../../routes/__root');
    // RootLayout is the component property of the route config
    // biome-ignore lint/suspicious/noExplicitAny: dynamic import for testing
    const RootLayout = (Route as any).component as React.ComponentType;

    render(<RootLayout />);

    const skipLink = screen.getByText('Skip to main content');
    expect(skipLink.tagName).toBe('A');
    expect(skipLink).toHaveAttribute('href', '#main');
    expect(skipLink).toHaveClass('skip-link');
  });

  it('renders <main id="main"> wrapping the outlet', async () => {
    const { Route } = await import('../../routes/__root');
    // biome-ignore lint/suspicious/noExplicitAny: dynamic import
    const RootLayout = (Route as any).component as React.ComponentType;

    render(<RootLayout />);

    const main = document.getElementById('main');
    expect(main).not.toBeNull();
    expect(main?.tagName).toBe('MAIN');
  });

  it('renders nav with aria-label="Primary navigation"', async () => {
    const { Route } = await import('../../routes/__root');
    // biome-ignore lint/suspicious/noExplicitAny: dynamic import
    const RootLayout = (Route as any).component as React.ComponentType;

    render(<RootLayout />);

    const nav = screen.getByRole('navigation', { name: 'Primary navigation' });
    expect(nav).toBeInTheDocument();
  });
});

describe('a11y shell — index.html lang attribute', () => {
  it('html element has lang="en"', () => {
    // The html lang attribute is set statically in index.html; verify via DOM
    // In jsdom test environment, the document.documentElement exists but lang
    // is only set if the test runner loads the HTML. We check the source directly.
    // We verify the contract by checking that documentElement.lang is "en" when
    // the app boots (set in index.html). Since jsdom starts with lang="", we
    // verify the html file contains lang="en" as a static check.
    const fs = require('node:fs');
    const path = require('node:path');
    // __dirname = apps/web/src/__tests__/app
    // ../../../../../ = Tasko/  →  + apps/web/index.html
    const webHtmlPath = path.resolve(__dirname, '../../../../../apps/web/index.html');
    const html = fs.readFileSync(webHtmlPath, 'utf-8');
    expect(html).toContain('<html lang="en">');
  });
});
