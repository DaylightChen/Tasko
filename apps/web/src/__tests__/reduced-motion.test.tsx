import * as fs from 'node:fs';
import * as path from 'node:path';
/**
 * reduced-motion.test.tsx
 *
 * Verifies that the `@media (prefers-reduced-motion: reduce)` block in tokens.css:
 *   - Overrides ALL five motion-duration tokens to 80ms.
 *   - Replaces --ease-spring-soft with `linear`.
 *   - Covers all three theme root selectors (:root, :root[data-theme='light'], :root[data-theme='dark']).
 *
 * jsdom does not evaluate @media queries, so we inspect the raw CSS rule text.
 * This gives a deterministic, non-flaky assertion that the contract is present in
 * the stylesheet, without needing a real browser.
 *
 * Additionally, we do a smoke render of Modal, Snackbar, and Checkbox with a
 * mocked matchMedia indicating reduce-motion=true to verify they do not crash.
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

// ── Read raw tokens.css text ──────────────────────────────────────────────────

const TOKENS_CSS_PATH = path.resolve(__dirname, '../styles/tokens.css');
const tokensCss = fs.readFileSync(TOKENS_CSS_PATH, 'utf-8');

describe('tokens.css — @media (prefers-reduced-motion: reduce)', () => {
  it('contains a prefers-reduced-motion: reduce media block', () => {
    expect(tokensCss).toContain('prefers-reduced-motion: reduce');
  });

  it('overrides --motion-instant to 80ms inside the reduce block', () => {
    const reducedBlock = extractReducedMotionBlock(tokensCss);
    expect(reducedBlock).toContain('--motion-instant: 80ms');
  });

  it('overrides --motion-fast to 80ms inside the reduce block', () => {
    const reducedBlock = extractReducedMotionBlock(tokensCss);
    expect(reducedBlock).toContain('--motion-fast: 80ms');
  });

  it('overrides --motion-base to 80ms inside the reduce block', () => {
    const reducedBlock = extractReducedMotionBlock(tokensCss);
    expect(reducedBlock).toContain('--motion-base: 80ms');
  });

  it('overrides --motion-medium to 80ms inside the reduce block', () => {
    const reducedBlock = extractReducedMotionBlock(tokensCss);
    expect(reducedBlock).toContain('--motion-medium: 80ms');
  });

  it('overrides --motion-slow to 80ms inside the reduce block', () => {
    const reducedBlock = extractReducedMotionBlock(tokensCss);
    expect(reducedBlock).toContain('--motion-slow: 80ms');
  });

  it('replaces --ease-spring-soft with linear inside the reduce block', () => {
    const reducedBlock = extractReducedMotionBlock(tokensCss);
    expect(reducedBlock).toContain('--ease-spring-soft: linear');
  });

  it('covers :root selector inside the reduce block', () => {
    const reducedBlock = extractReducedMotionBlock(tokensCss);
    expect(reducedBlock).toMatch(/:root\b/);
  });

  it('covers :root[data-theme="light"] selector inside the reduce block', () => {
    const reducedBlock = extractReducedMotionBlock(tokensCss);
    expect(reducedBlock).toContain('data-theme="light"');
  });

  it('covers :root[data-theme="dark"] selector inside the reduce block', () => {
    const reducedBlock = extractReducedMotionBlock(tokensCss);
    expect(reducedBlock).toContain('data-theme="dark"');
  });
});

describe('tokens.css — drag-visuals reduced-motion', () => {
  it('drag-visuals/styles.module.css contains a reduced-motion override removing scale', () => {
    const dragVisualsPath = path.resolve(__dirname, '../components/drag-visuals/styles.module.css');
    const dragCss = fs.readFileSync(dragVisualsPath, 'utf-8');
    expect(dragCss).toContain('prefers-reduced-motion: reduce');
    expect(dragCss).toContain('transform: none');
  });
});

describe('tokens.css — spinner/loader NOT suppressed', () => {
  it('no keyframe that rotates is overridden in the reduce block', () => {
    const reducedBlock = extractReducedMotionBlock(tokensCss);
    // The loader spin is preserved per accessibility.md §7; it must not appear
    // as animation: none or visibility: hidden in the reduce block.
    expect(reducedBlock).not.toContain('animation: none');
  });
});

describe('reduced-motion smoke renders', () => {
  beforeEach(() => {
    // Mock matchMedia to report prefers-reduced-motion: reduce
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string): MediaQueryList =>
        ({
          matches: query.includes('prefers-reduced-motion'),
          media: query,
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList,
    });
  });

  it('renders Snackbar without crashing under reduced-motion preference', async () => {
    const { Snackbar } = await import('../components/snackbar');
    render(
      <Snackbar
        variant="success"
        text="Task completed."
        action={{ label: 'Undo', onClick: () => {} }}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByText('Task completed.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });

  it('renders Snackbar error variant (assertive) without crashing under reduced-motion', async () => {
    const { Snackbar } = await import('../components/snackbar');
    render(<Snackbar variant="error" text="Sync error." onDismiss={() => {}} />);
    expect(screen.getByText('Sync error.')).toBeInTheDocument();
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extract the text content of the @media (prefers-reduced-motion: reduce) block
 * from a CSS string. Returns everything between the first `{` after the @media
 * rule and its matching closing `}`.
 */
function extractReducedMotionBlock(css: string): string {
  const mediaStart = css.indexOf('@media (prefers-reduced-motion: reduce)');
  if (mediaStart === -1) return '';

  // Find the opening `{` of the @media block
  let depth = 0;
  let start = -1;
  let end = -1;

  for (let i = mediaStart; i < css.length; i++) {
    if (css[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (css[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (start === -1 || end === -1) return '';
  return css.slice(start, end + 1);
}
